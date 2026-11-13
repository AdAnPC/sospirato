import { asc, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateProductBody,
  CreateProductResponse,
  GetProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { db, sospiratoProductsTable } from "@workspace/db";

const router: IRouter = Router();
const postgresIntegerMax = 2_147_483_647;

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(sospiratoProductsTable)
    .orderBy(desc(sospiratoProductsTable.isActive), asc(sospiratoProductsTable.name));

  res.json(GetProductsResponse.parse(products));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.price > postgresIntegerMax) {
    res.status(400).json({ error: "Product price exceeds the supported amount" });
    return;
  }

  const [product] = await db
    .insert(sospiratoProductsTable)
    .values({
      name: parsed.data.name.trim(),
      price: parsed.data.price,
      category: parsed.data.category?.trim() || null,
    })
    .returning();

  res.status(201).json(CreateProductResponse.parse(product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (
    parsed.data.price !== undefined &&
    parsed.data.price > postgresIntegerMax
  ) {
    res.status(400).json({ error: "Product price exceeds the supported amount" });
    return;
  }

  const updates = {
    ...parsed.data,
    ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
    ...(parsed.data.category !== undefined
      ? { category: parsed.data.category?.trim() || null }
      : {}),
  };

  const [product] = await db
    .update(sospiratoProductsTable)
    .set(updates)
    .where(eq(sospiratoProductsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(UpdateProductResponse.parse(product));
});

export default router;
