# Integracion de ordenes en soles

## Estado de la orden

Al crear una orden ya no se usa `processing`. Las órdenes nuevas se registran con estado `pending`.

- `pending` / `paid` / `processing` / `shipped` → el ERP las muestra como **"nuevo"**.
- `delivered` → el ERP lo muestra como **"procesado"** (ventas ya la procesó).
- `cancelled` → **"cancelado"**.

> A la vez, al crearse la orden el ecommerce graba una notificación `nuevo` (tabla `notifications`), que el ERP consume vía `GET /api/notifications`.

## Endpoint

```http
GET https://pruebas.hsperu.pe/api/backend/orders
```

Para consultar una orden especifica:

```http
GET https://pruebas.hsperu.pe/api/backend/orders?id=6
```

## Campos monetarios

Los campos originales se mantienen para compatibilidad:

- `total`: total original guardado en la orden.
- `unit_price`: precio unitario original del articulo.
- `subtotal`: subtotal original del articulo.

El backend agrega los valores convertidos a soles:

- `total_soles`: total de la orden en soles.
- `unit_price_soles`: precio unitario en soles.
- `subtotal_soles`: subtotal en soles.

La conversion usa el ultimo `sale_rate` disponible en `exchange_rates`.

## Moneda del articulo

En cada elemento de `items`, `currency_type_id` indica la moneda original:

- `1`: soles.
- `2`: dolares.

El frontend debe mostrar los campos `_soles` y no volver a aplicar el tipo de cambio.

## Ejemplo de respuesta

```json
[
  {
    "id": "6",
    "client_id": "37",
    "total": "21.60",
    "total_soles": 73.32,
    "status": "processing",
    "created_at": "2026-08-06T15:11:02.000Z",
    "items": [
      {
        "id": "10",
        "article_id": "8468",
        "quantity": 1,
        "unit_price": "21.60",
        "unit_price_soles": 73.32,
        "subtotal": "21.60",
        "subtotal_soles": 73.32,
        "currency_type_id": "2",
        "article_description": "ADAPTADOR HUB UGREEN USB 3.0"
      }
    ]
  }
]
```

## Implementacion sugerida

Para mostrar el total de la orden:

```tsx
<span>S/ {Number(order.total_soles).toFixed(2)}</span>
```

Para mostrar los precios de cada articulo:

```tsx
<span>S/ {Number(item.unit_price_soles).toFixed(2)}</span>
<span>S/ {Number(item.subtotal_soles).toFixed(2)}</span>
```

No usar `total`, `unit_price` ni `subtotal` para mostrar precios en soles, porque esos campos conservan la moneda original.
