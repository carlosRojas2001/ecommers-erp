# Documentación: Módulo de Órdenes

## Descripción
El módulo de **Órdenes** gestiona la creación de pedidos y la generación de comprobantes de pago (facturas y boletas).

---

## Endpoints

> **Prefijo global:** todas las rutas del backend se sirven bajo `/api` (ej. `http://localhost:3000/api/orders`).

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| `POST` | `/api/orders` | Crear nueva orden | JWT |
| `GET` | `/api/orders` | Listar órdenes (del cliente autenticado o todas si es admin). `?id={client_id}` filtra por cliente. `?page={n}` y `?limit={n}` para paginación | JWT |
| `GET` | `/api/orders/:id` | Obtener orden por ID (dueño o admin) | JWT |
| `GET` | `/api/orders/detalle/:id` | Detalle completo de orden (dueño o admin) | JWT |
| `GET` | `/api/orders/pdf/:id` | Generar PDF de la orden (dueño o admin) | JWT |
| `GET` | `/api/orders/mas-vendidos-productos` | Productos más vendidos (agregación global, sin datos de clientes) | JWT |

---

## Crear Orden

### Endpoint

```
POST /api/orders
```

### Headers

```
Content-Type: application/json
Authorization: Bearer {token}
```

### Campos del body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `document_type_id` | number | **Sí** | Tipo de comprobante: `1` = Factura, `3` = Boleta |
| `terms` | boolean | **Sí** | Aceptación de términos y condiciones. Debe ser exactamente `true`; de lo contrario retorna `400` |
| `items` | array | **Sí** | Lista de productos a comprar |
| `items[].article_id` | number | **Sí** | ID del artículo/producto |
| `items[].quantity` | number | **Sí** | Cantidad a comprar (mínimo 1, máximo 9999) |
| `client_id` | number | No | Solo usado por **admins** para crear una orden a nombre de otro cliente. Para clientes normales se toma del JWT (se ignora si se envía) |

> **Seguridad:** el `client_id` de la orden se determina por el token JWT. Un cliente no puede crear órdenes a nombre de otro (intento controlado por IDOR).

---

## Tipos de Comprobante

| Valor | Tipo | Documento del cliente | Ejemplo |
|-------|------|----------------------|---------|
| `1` | **Factura** | RUC (11 dígitos) | `20614604825` |
| `3` | **Boleta** | DNI (8 dígitos) | `12345678` |

> **Importante:** El cliente debe tener registrado el documento correspondiente antes de crear la orden.

---

## Ejemplos de Solicitud

### Crear Factura

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "document_type_id": 1,
    "terms": true,
    "items": [
      {
        "article_id": 10,
        "quantity": 2
      },
      {
        "article_id": 25,
        "quantity": 1
      }
    ]
  }'
```

### Crear Boleta

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "document_type_id": 3,
    "terms": true,
    "items": [
      {
        "article_id": 10,
        "quantity": 1
      }
    ]
  }'
```

---

## Respuesta Exitosa

> **Nota de moneda:** Tanto el `total` como los precios de cada ítem (`unit_price` y `subtotal`) **siempre se devuelven en Soles (PEN)**. Si un artículo está en dólares, el backend aplica la tasa de cambio del día automáticamente. El `total` almacenado en la base de datos también se guarda en Soles.

```json
{
  "orders": {
    "id": 1,
    "client_id": 1,
    "document_type_id": 1,
    "status": "pending",
    "total": 4500.00,
    "created_at": "2026-08-11T10:30:00.000Z",
    "clients": {
      "id": 1,
      "names": "Juan",
      "lastnames": "Pérez",
      "document_number": "20614604825"
    },
    "document_types": {
      "id": 1,
      "name": "Factura"
    },
    "item_irderns": [
      {
        "id": 1,
        "article_id": 10,
        "quantity": 2,
        "unit_price": 1500.00,
        "subtotal": 3000.00
      },
      {
        "id": 2,
        "article_id": 25,
        "quantity": 1,
        "unit_price": 1500.00,
        "subtotal": 1500.00
      }
    ]
  }
}
```

---

## Validaciones

| Escenario | Error | Código |
|-----------|-------|--------|
| No enviar `document_type_id` | `Debes indicar si es boleta o factura` | 401 |
| Factura con cliente sin RUC (11 dígitos) | `Para facturar necesitas registrar tu RUC (11 dígitos)` | 401 |
| Boleta con cliente sin DNI (8 dígitos) | `Para boleta necesitas registrar tu DNI (8 dígitos)` | 401 |
| Cliente sin documento registrado | `Debes tener registro de dni` | 401 |
| Artículo no existe | Error de base de datos | 500 |

---

## Listar Órdenes

### Endpoint

```
GET /api/orders
GET /api/orders?id=123
GET /api/orders?page=2&limit=20
GET /api/orders?id=123&page=1&limit=10
```

> **Autenticación:** requiere JWT. Un cliente solo ve sus propias órdenes; un admin (`role === 'admin'`) ve todas o filtra por cliente con `?id={client_id}`.
> **Orden:** las órdenes se devuelven de la más reciente a la más antigua (`created_at DESC`).

### Parámetros opcionales

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | Filtrar por ID de cliente |
| `page` | number | Página a consultar (default `1`, mínimo `1`) |
| `limit` | number | Órdenes por página (default `10`, mínimo `1`, máximo `100`) |

### Respuesta

> **Paginada:** la respuesta es un objeto con `data` (array de órdenes de la página) y `meta` (información de paginación).

```json
{
  "data": [
    {
      "id": 1,
      "client_id": 1,
      "total": 4500.00,
      "status": "pending",
      "created_at": "2026-08-11T10:30:00.000Z",
      "client_name": "Juan Pérez",
      "items": [
        {
          "id": 1,
          "article_id": 10,
          "quantity": 2,
          "unit_price": 1500.00,
          "subtotal": 3000.00,
          "currency_type_id": 1,
          "article_description": "Laptop HP Pavilion"
        }
      ],
      "total_soles": 4500.00
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 35,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Campos de `meta`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `page` | number | Página actual |
| `limit` | number | Cantidad de órdenes por página |
| `total` | number | Total de órdenes que cumplen el filtro |
| `totalPages` | number | Total de páginas (`ceil(total / limit)`) |
| `hasNextPage` | boolean | `true` si existe una página siguiente |
| `hasPrevPage` | boolean | `true` si existe una página anterior |

> **Ejemplo:** si un cliente tiene 35 órdenes y se consulta `?page=2&limit=10`, se devuelven las órdenes 11–20 con `meta.total = 35`, `meta.totalPages = 4`, `hasNextPage = true`, `hasPrevPage = true`.

---

## Obtener Orden por ID

### Endpoint

```
GET /api/orders/:id
```

### Ejemplo

```bash
curl http://localhost:3000/api/orders/1
```

### Respuesta

```json
{
  "id": 1,
  "client_id": 1,
  "client_names": "Juan",
  "client_lastnames": "Pérez",
  "total": 4500.00,
  "status": "pending",
  "created_at": "2026-08-11T10:30:00.000Z"
}
```

---

## Detalle de Orden

### Endpoint

```
GET /api/orders/detalle/:id
```

### Ejemplo

```bash
curl http://localhost:3000/api/orders/detalle/1
```

> **Nota de moneda:** Los montos (`unit_price`, `subtotal` y `total`) **siempre se devuelven en Soles (PEN)**. Si un artículo está en dólares, el backend convierte usando la tasa de cambio del día (mismo comportamiento que `GET /orders`). Cada ítem incluye `currency_type_id` (moneda original del artículo).

### Respuesta

```json
{
  "id": 1,
  "client_id": 1,
  "total": 4500.00,
  "status": "pending",
  "client_name": "Juan Pérez",
  "created_at": "2026-08-11T10:30:00.000Z",
  "items": [
    {
      "id": 1,
      "article_id": 10,
      "quantity": 2,
      "unit_price": 1500.00,
      "subtotal": 3000.00,
      "currency_type_id": 1,
      "article_description": "Laptop HP Pavilion"
    }
  ]
}
```

---

## Generar PDF

### Endpoint

```
GET /api/orders/pdf/:id
```

### Ejemplo

```bash
# Descargar PDF
curl http://localhost:3000/api/orders/pdf/1 -o orden-1.pdf
```

### Respuesta
- Archivo PDF con el comprobante de la orden
- Incluye logo de la empresa, datos del cliente, productos y total

---

## Productos Más Vendidos

### Endpoint

```
GET /api/orders/mas-vendidos-productos
```

### Ejemplo

```bash
curl http://localhost:3000/api/orders/mas-vendidos-productos
```

### Respuesta

```json
[
  {
    "description": "Laptop HP Pavilion",
    "total_vendido": 150
  },
  {
    "description": "Monitor Samsung 24\"",
    "total_vendido": 89
  }
]
```

---

## Estados de Orden

| Estado | Descripción |
|--------|-------------|
| `pending` | Orden creada, pendiente de procesamiento |

---

## Monedas

El sistema soporta múltiples monedas:

| `currency_type_id` | Moneda |
|--------------------|--------|
| `1` | Soles (S/) |
| `2` | Dólares ($) |

> Si el producto está en dólares, el sistema convierte automáticamente a soles usando la tasa de cambio del día.

---

## Flujo Completo de Venta

```
1. Registrar cliente (si no existe)
   POST /api/clients
   - Para factura: registrar con RUC (11 dígitos)
   - Para boleta: registrar con DNI (8 dígitos)

2. (Opcional) Verificar RUC en SUNAT
   GET /api/consulta/sunat/{ruc}

3. Crear orden
   POST /api/orders
   - document_type_id: 1 (factura) o 3 (boleta)
   - Enviar items con article_id y quantity

4. Obtener comprobante
   GET /api/orders/pdf/{id}
```

---

## Conversión de Órdenes Web a Ventas (ERP)

Cuando una orden del e-commerce se convierte en una venta en el ERP (backend-hsgestion), el sistema realiza las siguientes validaciones:

### Para Factura (`document_type_id = 1`)
- El cliente debe tener RUC de 11 dígitos
- Si el cliente no existe en el ERP, se consulta SUNAT con el RUC
- Se obtiene: razón social, dirección, ubigeo, si es agente de retención
- Se crea el cliente con `customer_document_type_id = 2` (RUC)

### Para Boleta (`document_type_id = 3`)
- El cliente debe tener DNI de 8 dígitos
- Si el cliente no existe en el ERP, se crea con datos básicos (nombre, apellido)
- Se crea el cliente con `customer_document_type_id = 3` (DNI)

### Payload enviado al ERP

El endpoint `GET /api/orders-web/{id}/to-sale` del ERP retorna un payload con:

| Campo | Descripción |
|-------|-------------|
| `order_document_type_id` | Tipo de comprobante original: `1` = Factura, `3` = Boleta |
| `customer_id` | ID del cliente en el ERP |
| `customer.document_number` | RUC o DNI del cliente |
| `customer.name` | Nombre del cliente (para DNI) |
| `customer.lastname` | Apellido del cliente (para DNI) |
| `customer.company_name` | Razón social (para RUC, obtenida de SUNAT) |

---

## Ejemplo Completo con JavaScript/Fetch

```javascript
// Crear una factura
const crearFactura = async () => {
  const response = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer TU_TOKEN'
    },
    body: JSON.stringify({
      document_type_id: 1,  // 1 = Factura
      terms: true,          // aceptación de términos (obligatorio)
      items: [
        { article_id: 10, quantity: 2 },
        { article_id: 25, quantity: 1 }
      ]
    })
  });
  
  const data = await response.json();
  console.log('Orden creada:', data);
};

// Crear una boleta
const crearBoleta = async () => {
  const response = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer TU_TOKEN'
    },
    body: JSON.stringify({
      document_type_id: 3,  // 3 = Boleta
      terms: true,          // aceptación de términos (obligatorio)
      items: [
        { article_id: 10, quantity: 1 }
      ]
    })
  });
  
  const data = await response.json();
  console.log('Orden creada:', data);
};
```
