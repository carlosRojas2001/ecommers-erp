# Documentación: Módulo de Órdenes

## Descripción
El módulo de **Órdenes** gestiona la creación de pedidos y la generación de comprobantes de pago (facturas y boletas).

---

## Endpoints

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| `POST` | `/orders` | Crear nueva orden | JWT |
| `GET` | `/orders` | Listar todas las órdenes | No |
| `GET` | `/orders/:id` | Obtener orden por ID | No |
| `GET` | `/orders/detalle/:id` | Detalle completo de orden | No |
| `GET` | `/orders/pdf/:id` | Generar PDF de la orden | No |
| `GET` | `/orders/mas-vendidos-productos` | Productos más vendidos | No |

---

## Crear Orden

### Endpoint

```
POST /orders
```

### Headers

```
Content-Type: application/json
Authorization: Bearer {token}
```

### Campos del body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `client_id` | number | **Sí** | ID del cliente que realiza la compra |
| `document_type_id` | number | **Sí** | Tipo de comprobante: `1` = Factura, `3` = Boleta |
| `items` | array | **Sí** | Lista de productos a comprar |
| `items[].article_id` | number | **Sí** | ID del artículo/producto |
| `items[].quantity` | number | **Sí** | Cantidad a comprar (mínimo 1) |

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
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "document_type_id": 1,
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
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 2,
    "document_type_id": 3,
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
GET /orders
GET /orders?id=123
```

### Parámetros opcionales

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | Filtrar por ID de cliente |

### Respuesta

```json
[
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
]
```

---

## Obtener Orden por ID

### Endpoint

```
GET /orders/:id
```

### Ejemplo

```bash
curl http://localhost:3000/orders/1
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
GET /orders/detalle/:id
```

### Ejemplo

```bash
curl http://localhost:3000/orders/detalle/1
```

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
      "article_description": "Laptop HP Pavilion"
    }
  ]
}
```

---

## Generar PDF

### Endpoint

```
GET /orders/pdf/:id
```

### Ejemplo

```bash
# Descargar PDF
curl http://localhost:3000/orders/pdf/1 -o orden-1.pdf
```

### Respuesta
- Archivo PDF con el comprobante de la orden
- Incluye logo de la empresa, datos del cliente, productos y total

---

## Productos Más Vendidos

### Endpoint

```
GET /orders/mas-vendidos-productos
```

### Ejemplo

```bash
curl http://localhost:3000/orders/mas-vendidos-productos
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
   POST /clients
   - Para factura: registrar con RUC (11 dígitos)
   - Para boleta: registrar con DNI (8 dígitos)

2. (Opcional) Verificar RUC en SUNAT
   GET /consulta/sunat/{ruc}

3. Crear orden
   POST /orders
   - document_type_id: 1 (factura) o 3 (boleta)
   - Enviar items con article_id y quantity

4. Obtener comprobante
   GET /orders/pdf/{id}
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
  const response = await fetch('http://localhost:3000/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer TU_TOKEN'
    },
    body: JSON.stringify({
      client_id: 1,
      document_type_id: 1,  // 1 = Factura
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
  const response = await fetch('http://localhost:3000/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer TU_TOKEN'
    },
    body: JSON.stringify({
      client_id: 2,
      document_type_id: 3,  // 3 = Boleta
      items: [
        { article_id: 10, quantity: 1 }
      ]
    })
  });
  
  const data = await response.json();
  console.log('Orden creada:', data);
};
```
