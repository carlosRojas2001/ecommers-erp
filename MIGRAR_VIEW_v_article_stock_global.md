# Migrar VIEW `v_article_stock_global` - backend_hsgestion -> otra BD

> **Origen:** `backend_hsgestion.v_article_stock_global` (623 filas en prod)
> **Destino:** `backend_hsgestion_test` o cualquier otra BD (actualmente 0 VIEWS en test)
> **Motor:** MariaDB/MySQL en `192.168.18.100` - `root/samanthafox`
> **Fecha:** 2026-08-27

## 1. Qué hace este VIEW

No es tabla física, es un **kárdex global calculado al vuelo** por `article_id`. Cada `SELECT * FROM view` recalcula:

*   **+ Entradas:** `entry_guides` x `entry_guide_article` x `ingress_reasons.stock` WHERE `status=1`
*   **- Ventas:** `sales` x `sale_article` WHERE `status=1` AND `document_type_id NOT IN (7,8,16)`
*   **+ Notas Crédito con stock:** `sales` JOIN `note_reasons` WHERE `stock=1` AND `document_type_id=7`
*   **+/- Despachos:** `dispatch_notes` x `dispatch_article` x `emission_reasons.stock` WHERE `status=1` AND `stock <>0`

```sql
-- Verificación rápida (solo lectura)
SHOW FULL TABLES IN backend_hsgestion WHERE TABLE_TYPE LIKE 'VIEW';
SHOW FULL TABLES IN backend_hsgestion_test WHERE TABLE_TYPE LIKE 'VIEW';
SELECT * FROM backend_hsgestion.v_article_stock_global LIMIT 5;
-- prod: 8327 | 0, 8328 | 0, ... total 623 filas
```

## 2. Definición exacta en producción

> Obtenida con `SHOW CREATE VIEW backend_hsgestion.v_article_stock_global\G`

```sql
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `backend_hsgestion`.`v_article_stock_global` AS 
select `a`.`id` AS `article_id`,
coalesce((select sum(`ir`.`stock` * `ega`.`quantity`) from ((`backend_hsgestion`.`entry_guides` `eg` join `backend_hsgestion`.`entry_guide_article` `ega` on(`eg`.`id` = `ega`.`entry_guide_id`)) join `backend_hsgestion`.`ingress_reasons` `ir` on(`ir`.`id` = `eg`.`ingress_reason_id`)) where `ega`.`article_id` = `a`.`id` and `eg`.`status` = 1),0) 
- coalesce((select sum(`sa`.`quantity`) from (`backend_hsgestion`.`sales` `s` join `backend_hsgestion`.`sale_article` `sa` on(`s`.`id` = `sa`.`sale_id`)) where `sa`.`article_id` = `a`.`id` and `s`.`status` = 1 and `s`.`document_type_id` not in (7,8,16)),0) 
+ coalesce((select sum(`sa`.`quantity`) from ((`backend_hsgestion`.`sales` `s` join `backend_hsgestion`.`sale_article` `sa` on(`s`.`id` = `sa`.`sale_id`)) join `backend_hsgestion`.`note_reasons` `nr` on(`nr`.`id` = `s`.`note_reason_id`)) where `sa`.`article_id` = `a`.`id` and `s`.`status` = 1 and `s`.`document_type_id` = 7 and `nr`.`stock` = 1),0) 
+ coalesce((select sum(case when `er`.`stock` = 1 then `da`.`quantity` when `er`.`stock` = -1 then -`da`.`quantity` else 0 end) from ((`backend_hsgestion`.`dispatch_notes` `dn` join `backend_hsgestion`.`dispatch_article` `da` on(`dn`.`id` = `da`.`dispatch_id`)) join `backend_hsgestion`.`emission_reasons` `er` on(`er`.`id` = `dn`.`emission_reason_id`)) where `da`.`article_id` = `a`.`id` and `dn`.`status` = 1 and `er`.`stock` <> 0 and `er`.`id` <> 4 and `dn`.`document_type_id` = 9),0) AS `saldo` 
from `backend_hsgestion`.`articles` `a`;
```

## 3. Cómo copiar a otra BD

### Opción A - Rápida (mantiene referencia a producción) - NO recomendada para test
> El VIEW en `test` seguirá leyendo de `backend_hsgestion` aunque lo consultes desde `test`.

```bash
# 1. Dump solo estructura del VIEW
mysqldump --skip-ssl -h 192.168.18.100 -u root -psamanthafox --no-data backend_hsgestion v_article_stock_global > view.sql
cat view.sql

# 2. Crear en destino tal cual (apuntará a prod)
mariadb --skip-ssl -h 192.168.18.100 -u root -psamanthafox backend_hsgestion_test < view.sql
```

### Opción B - Correcta desacoplada (RECOMENDADA)
> El VIEW en destino lee sus propias tablas. **Quita el prefijo `backend_hsgestion.`**.

Crea el archivo `view_desacoplado.sql`:

```sql
CREATE OR REPLACE VIEW `v_article_stock_global` AS
select `a`.`id` AS `article_id`,
coalesce((select sum(`ir`.`stock` * `ega`.`quantity`) from ((`entry_guides` `eg` join `entry_guide_article` `ega` on(`eg`.`id` = `ega`.`entry_guide_id`)) join `ingress_reasons` `ir` on(`ir`.`id` = `eg`.`ingress_reason_id`)) where `ega`.`article_id` = `a`.`id` and `eg`.`status` = 1),0) 
- coalesce((select sum(`sa`.`quantity`) from (`sales` `s` join `sale_article` `sa` on(`s`.`id` = `sa`.`sale_id`)) where `sa`.`article_id` = `a`.`id` and `s`.`status` = 1 and `s`.`document_type_id` not in (7,8,16)),0) 
+ coalesce((select sum(`sa`.`quantity`) from ((`sales` `s` join `sale_article` `sa` on(`s`.`id` = `sa`.`sale_id`)) join `note_reasons` `nr` on(`nr`.`id` = `s`.`note_reason_id`)) where `sa`.`article_id` = `a`.`id` and `s`.`status` = 1 and `s`.`document_type_id` = 7 and `nr`.`stock` = 1),0) 
+ coalesce((select sum(case when `er`.`stock` = 1 then `da`.`quantity` when `er`.`stock` = -1 then -`da`.`quantity` else 0 end) from ((`dispatch_notes` `dn` join `dispatch_article` `da` on(`dn`.`id` = `da`.`dispatch_id`)) join `emission_reasons` `er` on(`er`.`id` = `dn`.`emission_reason_id`)) where `da`.`article_id` = `a`.`id` and `dn`.`status` = 1 and `er`.`stock` <> 0 and `er`.`id` <> 4 and `dn`.`document_type_id` = 9),0) AS `saldo` 
from `articles` `a`;
```

Ejecución:

```bash
# En la BD destino (ej: backend_hsgestion_test)
mariadb --skip-ssl -h 192.168.18.100 -u root -psamanthafox backend_hsgestion_test < view_desacoplado.sql

# Validar
mariadb --skip-ssl -h 192.168.18.100 -u root -psamanthafox -e "SHOW FULL TABLES IN backend_hsgestion_test WHERE TABLE_TYPE LIKE 'VIEW'; SELECT * FROM backend_hsgestion_test.v_article_stock_global LIMIT 5;"
```

Si tu destino tiene otro nombre (ej: `backend_hsgestion_test2` o `ecommers_db`):

```sql
CREATE OR REPLACE VIEW `ecommers_db`.`v_article_stock_global` AS select ... from `ecommers_db`.`articles` `a` ...
-- O simplemente conéctate a esa BD y ejecuta sin prefijo
```

## 4. Validación post-migración

```sql
SELECT 'prod' as origen, COUNT(*) as filas FROM backend_hsgestion.v_article_stock_global
UNION ALL
SELECT 'test', COUNT(*) FROM backend_hsgestion_test.v_article_stock_global;

-- Comparar saldo de un artículo
SELECT * FROM backend_hsgestion.v_article_stock_global WHERE article_id = 100;
SELECT * FROM backend_hsgestion_test.v_article_stock_global WHERE article_id = 100;

-- Ver que la nueva vista apunta a tablas locales y no a prod
SHOW CREATE VIEW backend_hsgestion_test.v_article_stock_global\G
```

## 5. Trade-offs y Recomendación de Arquitectura

| Aspecto | VIEW actual | Alternativa Recomendada |
|---------|-------------|-------------------------|
| **Frescura** | Siempre al día (cálculo en vivo) | Tabla materializada `article_stock_cache` + Job cada 5 min / trigger |
| **Performance** | 4 subqueries correlacionadas por fila. OK para 623 artículos, lento con >5k o reportes masivos | Lectura O(1) indexada |
| **Multi-tenant** | Hardcodeado a `backend_hsgestion` | Debe filtrar por `company_id`/`branch_id` si hay sucursales |
| **E-commerce** | No filtra stock por sucursal visible | Para `ecommers-erp` crea `v_article_stock_visible` JOIN `visible_articles` |

**Para ecommers-erp (NestJS/Prisma):** No repliques el VIEW tal cual en Postgres. Crea un `StockService` que calcule saldo con Prisma agregations o una vista materializada en Postgres. Este `.md` te sirve como especificación de la lógica de negocio a portar.

## 6. Rollback

```sql
DROP VIEW IF EXISTS backend_hsgestion_test.v_article_stock_global;
DROP VIEW IF EXISTS `otra_bd`.`v_article_stock_global`;
```

---
*Generado: 2026-08-27 - Fuente: `SHOW CREATE VIEW` en 192.168.18.100*
