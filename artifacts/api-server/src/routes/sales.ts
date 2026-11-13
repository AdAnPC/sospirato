import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CancelSaleParams,
  CancelSaleResponse,
  CreateSaleBody,
  CreateSaleResponse,
  GetSalesQueryParams,
  GetSalesResponse,
} from "@workspace/api-zod";
import {
  db,
  sospiratoProductsTable,
  sospiratoSaleItemsTable,
  sospiratoSalesTable,
} from "@workspace/db";

const router: IRouter = Router();
const postgresIntegerMax = 2_147_483_647;

function parseLocalDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00-05:00`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

function nextLocalDate(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

async function getSaleWithItems(id: number) {
  const [sale] = await db
    .select()
    .from(sospiratoSalesTable)
    .where(eq(sospiratoSalesTable.id, id));

  if (!sale) return undefined;

  const items = await db
    .select()
    .from(sospiratoSaleItemsTable)
    .where(eq(sospiratoSaleItemsTable.saleId, id))
    .orderBy(asc(sospiratoSaleItemsTable.id));

  return { ...sale, items };
}

router.get("/sales", async (req, res): Promise<void> => {
  const fromValue =
    typeof req.query.from === "string" ? req.query.from : undefined;
  const toValue = typeof req.query.to === "string" ? req.query.to : undefined;
  const parsed = GetSalesQueryParams.safeParse({
    from: fromValue,
    to: toValue,
    limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
  });

  if (
    !parsed.success ||
    (req.query.from !== undefined && fromValue === undefined) ||
    (req.query.to !== undefined && toValue === undefined)
  ) {
    res.status(400).json({ error: "Invalid date range or limit" });
    return;
  }

  const from = fromValue ? parseLocalDate(fromValue) : undefined;
  const to = toValue ? parseLocalDate(toValue) : undefined;
  if (
    (fromValue && !from) ||
    (toValue && !to) ||
    (from && to && from > to)
  ) {
    res.status(400).json({ error: "Invalid date range or limit" });
    return;
  }

  const conditions: SQL[] = [];
  if (from) conditions.push(gte(sospiratoSalesTable.createdAt, from));
  if (to) conditions.push(lt(sospiratoSalesTable.createdAt, nextLocalDate(to)));

  const sales = await db
    .select()
    .from(sospiratoSalesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sospiratoSalesTable.createdAt))
    .limit(parsed.data.limit ?? 100);

  if (sales.length === 0) {
    res.json(GetSalesResponse.parse([]));
    return;
  }

  const saleIds = sales.map((sale) => sale.id);
  const items = await db
    .select()
    .from(sospiratoSaleItemsTable)
    .where(inArray(sospiratoSaleItemsTable.saleId, saleIds))
    .orderBy(asc(sospiratoSaleItemsTable.id));
  const itemsBySale = new Map<number, typeof items>();
  for (const item of items) {
    const existing = itemsBySale.get(item.saleId) ?? [];
    existing.push(item);
    itemsBySale.set(item.saleId, existing);
  }

  res.json(
    GetSalesResponse.parse(
      sales.map((sale) => ({ ...sale, items: itemsBySale.get(sale.id) ?? [] })),
    ),
  );
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
  const products = await db
    .select()
    .from(sospiratoProductsTable)
    .where(
      and(
        inArray(sospiratoProductsTable.id, productIds),
        eq(sospiratoProductsTable.isActive, true),
      ),
    );
  const productsById = new Map(products.map((product) => [product.id, product]));

  if (productsById.size !== productIds.length) {
    res.status(400).json({ error: "One or more products are unavailable" });
    return;
  }

  const lines = parsed.data.items.map((item) => {
    const product = productsById.get(item.productId)!;
    return {
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      subtotal: product.price * item.quantity,
    };
  });
  const total = lines.reduce((sum, item) => sum + item.subtotal, 0);

  if (
    lines.some((item) => item.subtotal > postgresIntegerMax) ||
    total > postgresIntegerMax
  ) {
    res.status(400).json({ error: "Sale total exceeds the supported amount" });
    return;
  }

  const sale = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sospiratoSalesTable)
      .values({
        total,
        paymentMethod: parsed.data.paymentMethod,
        customerName: parsed.data.customerName?.trim() || null,
        note: parsed.data.note?.trim() || null,
      })
      .returning();
    const createdItems = await tx
      .insert(sospiratoSaleItemsTable)
      .values(lines.map((line) => ({ ...line, saleId: created.id })))
      .returning();

    return { ...created, items: createdItems };
  });

  res.status(201).json(CreateSaleResponse.parse(sale));
});

router.post("/sales/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(sospiratoSalesTable)
    .where(eq(sospiratoSalesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  if (existing.status === "completed") {
    await db
      .update(sospiratoSalesTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(sospiratoSalesTable.id, params.data.id));
  }

  const sale = await getSaleWithItems(params.data.id);
  res.json(CancelSaleResponse.parse(sale));
});

export default router;
