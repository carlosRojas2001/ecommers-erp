# Changelog

## [No publicado]

### Corregido
- **`calculateTotales` (issues #40):** El método `calculateTotales` en `src/orders/orders.service.ts` no realizaba la conversión de moneda de artículos en dólares a soles. Ahora obtiene la tasa de cambio actual, selecciona `currency_type_id` del artículo y utiliza `toSoles()` para convertir correctamente los precios antes de calcular el total. Esto asegura que el campo `total` almacenado en la base de datos en la tabla `orders` refleje el valor correcto en Soles.

### Cambiado
- **Eliminados `console.log` de debug:** Se removimos los `console.log('[DEBUG CREATE]...')` que quedaron en la función `create` del módulo de órdenes.

### Documentación
- **`ORDENES.md`:** Actualizada la sección "Respuesta Exitosa" para aclarar que los campos `total`, `unit_price` y `subtotal` en la respuesta de `POST /orders` siempre se devuelven en Soles (PEN), aplicando la tasa de cambio automáticamente para artículos en dólares.

### Actualizado
- **Estados de pedido:** Se reemplazó el enum `orders_status` por `nuevo`, `proceso`, `factura`, `entregado`, `anulado` (migración SQL en `scripts/2026-08-15-nuevos-estados-pedidos-reclamos.sql`).
- **Estados de reclamo:** Se replaced el enum `complaints_status` por `nuevo`, `revisado`, `procesado` y se añadió la columna `observations` (texto solución/observación) a la tabla `complaints`.
- **Términos y Condiciones:** Se añadió el módulo `terms` con endpoints `GET /api/terms` (público) y `PUT /api/terms` (admin) para gestionar el contenido editable.
- **Filtro de órdenes:** Se añadió el parámetro `?status=activo|anulado|todos` al endpoint `GET /api/orders` (default: `activo`).
- **Nuevo endpoint ERP:** `GET /api/reclamos-web` para listar reclamos desde el ERP, con filtro por estado.
- **Nuevo menú ERP:** "Listar Libro de Reclamos" en el menú Órdenes Web con permiso `reclamos_web.consultar`.
