# Documentación: Consultas y Libro de Reclamaciones

## 1. Módulo de Consultas (SUNAT)

### Descripción
El módulo de **Consultas** permite verificar datos de empresas consultando la API de SUNAT. Se usa típicamente para validar el RUC antes de generar una **factura**.

> **Nota:** Este endpoint solo consulta datos de SUNAT. No genera facturas ni boletas. Para eso ver sección 3.

### Endpoint

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| `GET` | `/consulta/sunat/:ruc` | Consulta datos de empresa por RUC | No requerida |

### Parámetros

| Parámetro | Tipo | Requerido | Validación | Descripción |
|-----------|------|-----------|------------|-------------|
| `ruc` | `string` (path) | Sí | 11 dígitos numéricos | Número de RUC a consultar |

### Ejemplo de llamada

```bash
# Consultar RUC de empresa
curl http://localhost:3000/consulta/sunat/20614604825
```

### Respuesta exitosa

```json
{
  "ruc": "20614604825",
  "razon_social": "CYBERHOUSE TEC S.A.C.",
  "estado": "ACTIVO",
  "condicion": "HABIDO",
  "direccion": "AV. INCA GARCILASO DE LA VEGA NRO. 1348",
  "ubigeo": "150101",
  "departamento": "LIMA",
  "provincia": "LIMA",
  "distrito": "LIMA",
  "tipo_contribuyente": "SOCIEDAD ANONIMA CERRADA",
  "es_agente_retencion": 0,
  "es_buen_contribuyente": 0,
  "es_agente_percepcion": 0
}
```

### Errores posibles

| Código | Mensaje | Causa |
|--------|---------|-------|
| `400` | El RUC debe tener exactamente 11 dígitos numéricos | Formato de RUC inválido |
| `404` | Registro no encontrado en SUNAT | RUC no existe en SUNAT |
| `502` | No se pudo conectar con el servicio SUNAT | Error de conexión con API externa |

### Tipos de documento aceptados

| Tipo | Dígitos | Ejemplo |
|------|---------|---------|
| **DNI** | 8 | `12345678` |
| **RUC** | 11 | `20614604825` |

> El campo `dni_ruc` acepta indistintamente DNI o RUC. Si el cliente es persona natural con negocio, puede ingresar su RUC.

### Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `EXTERNAL_API_URL` | URL base de la API externa de consulta |
| `EXTERNAL_API_TOKEN` | Token de autorización (opcional) |

---

## 2. Módulo de Libro de Reclamaciones

### Descripción
El módulo de **Libro de Reclamaciones** implementa el registro de reclamos y quejas conforme a la Ley N° 29571 (Código de Protección y Defensa del Consumidor). Permite a los clientes registrar reclamos/quejas con evidencias y firma, y a los administradores gestionarlos.

### Ubicación
```
src/libro-reclamos/
├── libro-reclamos.controller.ts      # Controlador principal
├── libro-reclamos.service.ts         # Servicio principal
├── libro-reclamos.module.ts          # Módulo NestJS
├── dto/
│   ├── create-libro-reclamo.dto.ts   # DTO de creación
│   └── update-libro-reclamo.dto.ts   # DTO de actualización
├── entities/
│   └── libro-reclamo.entity.ts       # Entidad
├── events/
│   └── complaint-created.event.ts    # Evento de reclamo creado
├── listeners/
│   └── complaint.listener.ts         # Listener de eventos
└── services/
    ├── complaint-counter.service.ts  # Servicio de numeración
    ├── mail.service.ts               # Servicio de correo
    ├── recaptcha.service.ts          # Servicio de reCAPTCHA
    └── storage.service.ts            # Servicio de almacenamiento
```

### Endpoints

#### 2.1 Crear Reclamo (Público)

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| `POST` | `/complaints` | Registrar nuevo reclamo/queja | Opcional (JWT) |

**Rate Limit:** 5 peticiones por minuto por IP

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer {token}  (opcional)
```

**Campos del formulario:**

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `customer_name` | string | Sí | - | Nombre del cliente |
| `customer_lastname` | string | Sí | - | Apellido del cliente |
| `dni_ruc` | string | Sí | 8-11 caracteres | **DNI** (8 dígitos) o **RUC** (11 dígitos) del cliente |
| `email` | string | Sí | Formato email | Correo electrónico |
| `phone` | string | Sí | 9 dígitos | Número de teléfono |
| `address` | string | Sí | - | Dirección del cliente |
| `parent_data` | string | No | - | Datos del padre/tutor (menores) |
| `well_hired` | string | Sí | `producto` o `servicio` | Tipo de bien contratado |
| `description` | string | Sí | - | Descripción del producto/servicio |
| `detail_complaint` | string | Sí | - | Detalle del reclamo/queja |
| `order` | string | No | - | Número de pedido relacionado |
| `amount` | string | Sí | Número | Monto reclamado |
| `type_complaint` | string | Sí | `reclamo` o `queja` | Tipo de reclamación |
| `observations` | string | No | - | Observaciones adicionales |
| `recaptcha_token` | string | Sí | - | Token de reCAPTCHA v3 |
| `evidence` | file | No | JPG/PNG, máx 5MB | Evidencia fotográfica |
| `signature` | file | No | JPG/PNG/WEBP, máx 5MB | Firma del cliente |

**Respuesta exitosa (201):**
```json
{
  "id": 1,
  "number_complaint": "0001-2026",
  "created_at": "2026-08-11T10:30:00.000Z"
}
```

#### 2.2 Listar Reclamos (Admin)

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| `GET` | `/complaints` | Listar todos los reclamos | JWT + Admin |

**Query Parameters:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `status` | string | - | Filtrar por estado: `pendiente`, `atendido`, `cerrado` |
| `page` | number | 1 | Número de página |
| `limit` | number | 20 | Registros por página |

**Respuesta:**
```json
{
  "data": [
    {
      "id": 1,
      "number_complaint": "0001-2026",
      "customer_name": "Juan",
      "customer_lastname": "Pérez",
      "dni_ruc": "12345678",
      "email": "juan@email.com",
      "phone": "987654321",
      "address": "Av. Example 123",
      "well_hired": "producto",
      "description": "Laptop HP",
      "detail_complaint": "No enciende",
      "type_complaint": "reclamo",
      "status": "pendiente",
      "evidence_path": "http://localhost:3000/storage/complaints/evidence-xxx.jpg",
      "signature_path": "http://localhost:3000/storage/complaints/signature-xxx.png",
      "created_at": "2026-08-11T10:30:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

#### 2.3 Actualizar Estado (Admin)

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| `PATCH` | `/complaints/:id/status` | Actualizar estado del reclamo | JWT + Admin |

**Body:**
```json
{
  "status": "atendido"
}
```

**Estados válidos:**
- `pendiente` - Reclamo recién registrado
- `atendido` - Reclamo en proceso de atención
- `cerrado` - Reclamo resuelto

### Flujo de Creación

```
1. Cliente envía formulario con reCAPTCHA
         ↓
2. Verificación de reCAPTCHA (Google API)
         ↓
3. Subida de archivos (evidencia/firma)
         ↓
4. Transacción atómica:
   - Generación de número correlativo (ej: 0001-2026)
   - Inserción en base de datos
         ↓
5. Emisión de evento asíncrono
         ↓
6. Respuesta al cliente (id, number_complaint, created_at)
         ↓
7. (Async) Envío de emails:
   - Confirmación al cliente
   - Notificación interna al equipo
```

### Numeración de Reclamos

El sistema genera números correlativos anuales con formato: `{secuencia}-{año}`

- Ejemplo: `0001-2026`, `0002-2026`, `0003-2026`
- La secuencia se reinicia cada año
- Se usa `SELECT ... FOR UPDATE` para evitar concurrencia

### Servicios Auxiliares

#### RecaptchaService
- Verifica tokens de reCAPTCHA v3 con Google
- Score mínimo: 0.5
- Variable: `RECAPTCHA_SECRET_KEY`

#### StorageService
- Almacena archivos en `./storage/complaints/`
- Validación de tipo por magic bytes (no extensión)
- Tamaño máximo: 5MB
- Nombres únicos con UUID

#### MailService
- Envía email de confirmación al cliente
- Envía notificación interna al equipo
- Usa Nodemailer con SMTP

**Variables SMTP:**
| Variable | Descripción |
|----------|-------------|
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Puerto SMTP |
| `SMTP_SECURE` | SSL/TLS (`true`/`false`) |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `MAIL_FROM` | Remitente |
| `SUPPORT_EMAIL` | Email de notificaciones internas |

### Variables de Entorno Requeridas

```env
# Consulta SUNAT
EXTERNAL_API_URL=https://api.ejemplo.com
EXTERNAL_API_TOKEN=tu_token

# Libro de Reclamaciones
RECAPTCHA_SECRET_KEY=tu_secret_key
APP_URL=http://localhost:3000

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu@email.com
SMTP_PASS=tu_contraseña
MAIL_FROM=noreply@tudominio.com
SUPPORT_EMAIL=soporte@tudominio.com
```

### Base de Datos

#### Tabla: complaints
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | BigInt (PK) | Identificador único |
| `number_complaint` | String | Número correlativo (ej: 0001-2026) |
| `customer_name` | String | Nombre del cliente |
| `customer_lastname` | String | Apellido del cliente |
| `dni_ruc` | String | DNI o RUC |
| `email` | String | Correo electrónico |
| `phone` | String | Teléfono |
| `address` | String | Dirección |
| `parent_data` | String? | Datos del padre/tutor |
| `well_hired` | Enum | `producto` / `servicio` |
| `description` | String | Descripción del bien |
| `detail_complaint` | String | Detalle del reclamo |
| `order` | String? | Número de pedido |
| `amount` | Decimal | Monto reclamado |
| `type_complaint` | Enum | `reclamo` / `queja` |
| `observations` | String? | Observaciones |
| `evidence_path` | String? | Ruta de evidencia |
| `signature_path` | String? | Ruta de firma |
| `customer_id` | BigInt? | ID del cliente (si autenticado) |
| `status` | Enum | `pendiente` / `atendido` / `cerrado` |
| `date_complaint` | DateTime | Fecha del reclamo |
| `created_at` | DateTime | Fecha de registro |

#### Tabla: complaint_counters
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `year` | Int (PK) | Año |
| `seq` | Int | Último número de secuencia |

### Ejemplos de Uso

```bash
# Crear reclamo (con archivos)
curl -X POST http://localhost:3000/complaints \
  -F "customer_name=Juan" \
  -F "customer_lastname=Pérez" \
  -F "dni_ruc=12345678" \
  -F "email=juan@email.com" \
  -F "phone=987654321" \
  -F "address=Av. Example 123" \
  -F "well_hired=producto" \
  -F "description=Laptop HP Pavilion" \
  -F "detail_complaint=No enciende después de 2 días de compra" \
  -F "amount=2500" \
  -F "type_complaint=reclamo" \
  -F "recaptcha_token=TOKEN_AQUI" \
  -F "evidence=@/ruta/imagen.jpg"

# Listar reclamos (con token admin)
curl http://localhost:3000/complaints?status=pendiente&page=1&limit=10 \
  -H "Authorization: Bearer TU_TOKEN_ADMIN"

# Actualizar estado
curl -X PATCH http://localhost:3000/complaints/1/status \
  -H "Authorization: Bearer TU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"status": "atendido"}'
```

---

## 3. Facturas y Boletas (Módulo de Órdenes)

### Descripción
Las facturas y boletas se generan al crear una **Orden**. El tipo de comprobante se define con `document_type_id`.

### Diferencia entre Factura y Boleta

| Tipo | `document_type_id` | Documento requerido | Longitud |
|------|-------------------|---------------------|----------|
| **Factura** | `1` | RUC | 11 dígitos |
| **Boleta** | `3` | DNI | 8 dígitos |

### Endpoint para crear Orden

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| `POST` | `/orders` | Crear orden con factura o boleta | JWT |

### Campos requeridos

```json
{
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
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `client_id` | number | Sí | ID del cliente (debe tener RUC o DNI registrado) |
| `document_type_id` | number | Sí | `1` = Factura, `3` = Boleta |
| `items` | array | Sí | Lista de productos |
| `items[].article_id` | number | Sí | ID del artículo |
| `items[].quantity` | number | Sí | Cantidad |

### Flujo para crear Factura

```
1. Consultar RUC del cliente (opcional, para verificar):
   GET /consulta/sunat/20614604825

2. Registrar cliente con RUC en el sistema:
   POST /clients (con document_number = RUC de 11 dígitos)

3. Crear orden con document_type_id = 1:
   POST /orders
```

### Flujo para crear Boleta

```
1. Registrar cliente con DNI en el sistema:
   POST /clients (con document_number = DNI de 8 dígitos)

2. Crear orden con document_type_id = 3:
   POST /orders
```

### Ejemplos de uso

```bash
# Crear FACTURA (document_type_id = 1)
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "document_type_id": 1,
    "items": [
      {"article_id": 10, "quantity": 2},
      {"article_id": 25, "quantity": 1}
    ]
  }'

# Crear BOLETA (document_type_id = 3)
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 2,
    "document_type_id": 3,
    "items": [
      {"article_id": 10, "quantity": 1}
    ]
  }'
```

### Validaciones del sistema

| Escenario | Error |
|-----------|-------|
| No enviar `document_type_id` | `Debes indicar si es boleta o factura` |
| Factura sin RUC de 11 dígitos | `Para facturar necesitas registrar tu RUC (11 dígitos)` |
| Boleta sin DNI de 8 dígitos | `Para boleta necesitas registrar tu DNI (8 dígitos)` |
| Cliente sin documento | `Debes tener registro de dni` |

---

El Libro de Reclamaciones cumple con la **Ley N° 29571** (Código de Protección y Defensa del Consumidor) del Perú, que establece:

1. **Obligación de registro**: Todo proveedor debe mantener un libro de reclamaciones
2. **Plazo de respuesta**: 15 días hábiles para atender reclamos
3. **Conservación**: Los registros deben conservarse por 2 años mínimo
4. **Información al consumidor**: Debe informarse sobre el derecho a reclamar

---

## Seguridad

- **reCAPTCHA v3**: Protección contra bots en el registro de reclamos
- **Rate Limiting**: 5 peticiones/minuto por IP
- **Validación de archivos**: Verificación por magic bytes, no extensión
- **Transacciones atómicas**: Evita inconsistencias en la numeración
- **Guards JWT**: Endpoints administrativos requieren autenticación
- **Optional JWT**: Clientes autenticados se asocian automáticamente al reclamo
