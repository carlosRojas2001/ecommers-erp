-- =====================================================================
-- Migración: nuevos estados de pedidos y reclamos + términos y condiciones
-- Fecha: 2026-08-15
-- BD: backend_hsgestion (compartida e-commerce + ERP)
--
-- Estados de orders:
--   pending/paid/processing/shipped/delivered/cancelled/procesado
--   → nuevo / proceso / factura / entregado / anulado
--
-- Estados de complaints:
--   pendiente/atendido/cerrado → nuevo / revisado / procesado
--
-- Ejecutar ANTES de `prisma db push` (que ajustará los enums al valor final).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ORDERS: ampliar enum → migrar valores → cerrar enum
-- ---------------------------------------------------------------------

-- 1.1 Ampliar enum (superset para que los UPDATE no fallen)
ALTER TABLE `orders`
  MODIFY COLUMN `status` ENUM(
    'pending','paid','processing','shipped','delivered','cancelled','procesado',
    'nuevo','proceso','factura','entregado','anulado'
  ) NULL DEFAULT 'nuevo';

-- 1.2 Migrar valores (el orden de los WHEN importa)
UPDATE `orders` SET `status` = CASE
  WHEN `status` = 'cancelled' OR `is_cancelled` = 1 THEN 'anulado'
  WHEN `status` IN ('delivered','shipped') THEN 'entregado'
  WHEN `status` = 'procesado' OR `sale_id` IS NOT NULL THEN 'factura'
  WHEN `status` IN ('paid','processing') THEN 'proceso'
  ELSE 'nuevo'
END;

-- 1.3 Sincronizar bandera de anulación
UPDATE `orders` SET `is_cancelled` = 1 WHERE `status` = 'anulado' AND `is_cancelled` = 0;

-- 1.4 Cerrar enum a los valores finales (igual que prisma/schema.prisma)
ALTER TABLE `orders`
  MODIFY COLUMN `status` ENUM('nuevo','proceso','factura','entregado','anulado') NULL DEFAULT 'nuevo';

-- ---------------------------------------------------------------------
-- 2) COMPLAINTS: ampliar enum → migrar valores → cerrar enum
-- ---------------------------------------------------------------------

-- 2.1 Ampliar enum
ALTER TABLE `complaints`
  MODIFY COLUMN `status` ENUM('pendiente','atendido','cerrado','nuevo','revisado','procesado') NOT NULL DEFAULT 'nuevo';

-- 2.2 Migrar valores
UPDATE `complaints` SET `status` = CASE
  WHEN `status` = 'pendiente' THEN 'nuevo'
  WHEN `status` = 'atendido' THEN 'revisado'
  WHEN `status` = 'cerrado' THEN 'procesado'
  ELSE 'nuevo'
END;

-- 2.3 Cerrar enum
ALTER TABLE `complaints`
  MODIFY COLUMN `status` ENUM('nuevo','revisado','procesado') NOT NULL DEFAULT 'nuevo';

-- ---------------------------------------------------------------------
-- 3) TÉRMINOS Y CONDICIONES (tabla nueva, editable vía /api/terms)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `terms_conditions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(150) NOT NULL DEFAULT 'Términos y Condiciones',
  `content` TEXT NOT NULL,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `terms_conditions` (`title`, `content`)
SELECT
  'Términos y Condiciones',
  '1. Aceptación
Al realizar una compra en nuestra tienda en línea, usted acepta los presentes Términos y Condiciones.

2. Pedidos
Todo pedido generado está sujeto a confirmación de stock y verificación de datos del cliente (DNI para boleta, RUC para factura).

3. Precios y moneda
Los precios se expresan en Soles (PEN). Los productos con precio en dólares se convierten al tipo de cambio de venta vigente.

4. Facturación
La factura electrónica se emite una vez procesado el pedido, conforme a la normativa de SUNAT.

5. Entrega
Los tiempos de entrega se coordinan con el cliente luego de la facturación del pedido.

6. Anulaciones
Los pedidos pueden ser anulados siempre que no hayan sido facturados.

7. Reclamos
Puede registrar sus reclamos a través del Libro de Reclamaciones disponible en el sitio web, conforme al Código de Protección al Consumidor.'
WHERE NOT EXISTS (SELECT 1 FROM `terms_conditions`);

-- ---------------------------------------------------------------------
-- 4) Verificación
-- ---------------------------------------------------------------------
SELECT status, COUNT(*) AS total FROM `orders` GROUP BY status;
SELECT status, COUNT(*) AS total FROM `complaints` GROUP BY status;
SELECT id, title, updated_at FROM `terms_conditions`;
