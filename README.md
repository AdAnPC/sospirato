# Sospirato Ventas

Sistema para que Sospirato COL registre ventas rápidamente y consulte totales, productos e historial.

## Requisitos y comandos

- Deno 2.9 o posterior
- `deno task install` — instala las dependencias en el `node_modules` compartido de la raíz
- `deno task dev` — inicia la aplicación de ventas
- `deno task dev:mockup` — inicia el entorno de mockups
- `deno task db:up` — inicia PostgreSQL local con Docker Compose
- `deno task api` — inicia la API en el puerto `5000` (configurable con `PORT`)
- `deno task typecheck` — revisa los tipos de todos los paquetes
- `deno task build` — revisa los tipos y compila las aplicaciones web
- `deno task codegen` — regenera los clientes y esquemas desde OpenAPI
- `deno task db:push` — aplica el esquema de base de datos en desarrollo

La base de datos local predeterminada usa PostgreSQL en `127.0.0.1:5433`; inicia primero el contenedor con `deno task db:up`. `DATABASE_URL` permite reemplazarla. `PORT` y `BASE_PATH` son opcionales para las aplicaciones web; por defecto usan el puerto `5173` y la ruta `/`.

## Estructura

- `artifacts/sospirato-ventas/` — interfaz de ventas
- `artifacts/api-server/` — API Express ejecutada sobre el runtime Deno
- `artifacts/mockup-sandbox/` — vista y herramientas para mockups
- `lib/api-spec/` — contrato OpenAPI y generación de cliente
- `lib/db/` — esquema PostgreSQL y Drizzle ORM

## Decisiones de producto

- Los precios y totales se guardan como pesos colombianos enteros.
- Cada línea conserva el nombre y el precio del producto al momento de la venta.
- Las ventas se anulan sin borrar su historial; las anuladas no cuentan en los totales.
- El resumen diario y semanal usa la zona horaria de Bogotá.
- El registro habitual de una venta debe ser posible con tres clics.

Todo el proyecto corre sobre Deno. La aplicación aún no tiene inicio de sesión; agrega autenticación antes de publicar datos privados.
