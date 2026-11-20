import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl = process.env.DATABASE_URL ??
  "postgres://sospirato:sospirato@127.0.0.1:5433/sospirato";

export default defineConfig({
  schema: path.join(import.meta.dirname, "src/schema/*.ts").replaceAll("\\", "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
