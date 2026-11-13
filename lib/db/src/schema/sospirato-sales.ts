import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const sospiratoProductsTable = pgTable(
  "sospirato_products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    category: text("category"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("sospirato_products_active_idx").on(table.isActive)],
);

export const sospiratoSalesTable = pgTable(
  "sospirato_sales",
  {
    id: serial("id").primaryKey(),
    total: integer("total").notNull(),
    paymentMethod: text("payment_method").notNull(),
    customerName: text("customer_name"),
    note: text("note"),
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    index("sospirato_sales_created_at_idx").on(table.createdAt),
    index("sospirato_sales_status_idx").on(table.status),
  ],
);

export const sospiratoSaleItemsTable = pgTable(
  "sospirato_sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sospiratoSalesTable.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(
      () => sospiratoProductsTable.id,
      { onDelete: "set null" },
    ),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    subtotal: integer("subtotal").notNull(),
  },
  (table) => [
    index("sospirato_sale_items_sale_id_idx").on(table.saleId),
    index("sospirato_sale_items_product_name_idx").on(table.productName),
  ],
);
