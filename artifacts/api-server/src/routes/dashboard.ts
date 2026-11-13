import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import {
  db,
  sospiratoSaleItemsTable,
  sospiratoSalesTable,
} from "@workspace/db";

const router: IRouter = Router();

function getBogotaDayLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Unable to calculate local date");
  return `${year}-${month}-${day}`;
}

function localMidnight(dateLabel: string): Date {
  return new Date(`${dateLabel}T00:00:00-05:00`);
}

function mondayLabel(dateLabel: string): string {
  const utcDate = new Date(`${dateLabel}T00:00:00Z`);
  const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  return utcDate.toISOString().slice(0, 10);
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayLabel = getBogotaDayLabel(now);
  const todayStart = localMidnight(todayLabel);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekStart = localMidnight(mondayLabel(todayLabel));
  const completedSales = eq(sospiratoSalesTable.status, "completed");

  const [todayTotals] = await db
    .select({
      total: sql<number>`coalesce(sum(${sospiratoSalesTable.total}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(sospiratoSalesTable)
    .where(
      and(
        completedSales,
        gte(sospiratoSalesTable.createdAt, todayStart),
        lt(sospiratoSalesTable.createdAt, tomorrowStart),
      ),
    );

  const [weekTotals] = await db
    .select({
      total: sql<number>`coalesce(sum(${sospiratoSalesTable.total}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(sospiratoSalesTable)
    .where(
      and(
        completedSales,
        gte(sospiratoSalesTable.createdAt, weekStart),
        lt(sospiratoSalesTable.createdAt, tomorrowStart),
      ),
    );

  const topProducts = await db
    .select({
      productName: sospiratoSaleItemsTable.productName,
      quantity: sql<number>`sum(${sospiratoSaleItemsTable.quantity})::int`,
      total: sql<number>`sum(${sospiratoSaleItemsTable.subtotal})::int`,
    })
    .from(sospiratoSaleItemsTable)
    .innerJoin(
      sospiratoSalesTable,
      eq(sospiratoSalesTable.id, sospiratoSaleItemsTable.saleId),
    )
    .where(
      and(
        completedSales,
        gte(sospiratoSalesTable.createdAt, weekStart),
        lt(sospiratoSalesTable.createdAt, tomorrowStart),
      ),
    )
    .groupBy(sospiratoSaleItemsTable.productName)
    .orderBy(desc(sql`sum(${sospiratoSaleItemsTable.subtotal})`))
    .limit(3);

  res.json(
    GetDashboardSummaryResponse.parse({
      todayTotal: todayTotals.total,
      todayCount: todayTotals.count,
      weekTotal: weekTotals.total,
      weekCount: weekTotals.count,
      topProducts,
    }),
  );
});

export default router;
