# Sospirato Ventas

Sistema para que Sospirato COL registre ventas rápidamente y consulte sus totales, productos e historial.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sospirato-ventas/src/App.tsx` — resumen, catálogo y registro de ventas
- `artifacts/api-server/src/routes/` — endpoints de productos, ventas y resumen
- `lib/api-spec/openapi.yaml` — contrato de la API y generación de hooks
- `lib/db/src/schema/sospirato-sales.ts` — tablas de productos, ventas y líneas de venta
- `artifacts/sospirato-ventas/src/index.css` — tema visual de la app

## Architecture decisions

- Los precios y totales se guardan como pesos colombianos enteros, no como decimales.
- Cada línea conserva el nombre y precio del producto al momento de la venta.
- Las ventas se anulan sin borrar su historial; las anuladas no cuentan en los totales.
- El resumen diario y semanal usa la zona horaria de Bogotá.

## Product

Registro rápido de ventas, catálogo editable, historial con búsqueda y fechas, anulación de ventas y totales del día y la semana.

## User preferences

El registro habitual de una venta debe ser posible con tres clics.

## Gotchas

- Agregar los productos reales al catálogo antes de intentar registrar ventas.
- La app no tiene inicio de sesión todavía; agregar autenticación antes de publicar datos privados.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
