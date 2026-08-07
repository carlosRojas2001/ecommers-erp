-- Copia las tablas agregadas por ecommers-erp desde la base de prueba
-- hacia la base de destino. Ejecutar en el mismo servidor MariaDB.
-- No copia articles, categories, brands ni sub_categories porque ya
-- existen en backend_hsgestion y contienen datos diferentes.

-- Estas columnas fueron agregadas por ecommers-erp a tablas que ya existian.
-- Solo se agrega/copia image_url; el resto de columnas y datos se conserva.
ALTER TABLE backend_hsgestion.categories
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) NULL AFTER updated_at;

ALTER TABLE backend_hsgestion.brands
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) NULL AFTER updated_at;

ALTER TABLE backend_hsgestion.sub_categories
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) NULL AFTER updated_at;

UPDATE backend_hsgestion.categories d
INNER JOIN backend_hsgestion_test.categories s ON s.id = d.id
SET d.image_url = s.image_url;

UPDATE backend_hsgestion.brands d
INNER JOIN backend_hsgestion_test.brands s ON s.id = d.id
SET d.image_url = s.image_url;

UPDATE backend_hsgestion.sub_categories d
INNER JOIN backend_hsgestion_test.sub_categories s ON s.id = d.id
SET d.image_url = s.image_url;

START TRANSACTION;

-- Crear la estructura de las tablas que no existen en el destino.
CREATE TABLE IF NOT EXISTS backend_hsgestion.clients
  LIKE backend_hsgestion_test.clients;

CREATE TABLE IF NOT EXISTS backend_hsgestion.article_images
  LIKE backend_hsgestion_test.article_images;

CREATE TABLE IF NOT EXISTS backend_hsgestion.hero_slides
  LIKE backend_hsgestion_test.hero_slides;

CREATE TABLE IF NOT EXISTS backend_hsgestion.favorites
  LIKE backend_hsgestion_test.favorites;

CREATE TABLE IF NOT EXISTS backend_hsgestion.reviews
  LIKE backend_hsgestion_test.reviews;

CREATE TABLE IF NOT EXISTS backend_hsgestion.orders
  LIKE backend_hsgestion_test.orders;

CREATE TABLE IF NOT EXISTS backend_hsgestion.order_items
  LIKE backend_hsgestion_test.order_items;

-- Mantener los IDs originales permite conservar las relaciones con articles.
-- INSERT IGNORE permite reanudar el script si una ejecución anterior quedó
-- incompleta; no reemplaza registros existentes en el destino.
INSERT IGNORE INTO backend_hsgestion.clients
SELECT * FROM backend_hsgestion_test.clients;

INSERT IGNORE INTO backend_hsgestion.article_images
SELECT * FROM backend_hsgestion_test.article_images;

INSERT IGNORE INTO backend_hsgestion.hero_slides
SELECT * FROM backend_hsgestion_test.hero_slides;

INSERT IGNORE INTO backend_hsgestion.favorites
SELECT * FROM backend_hsgestion_test.favorites;

INSERT IGNORE INTO backend_hsgestion.reviews
SELECT * FROM backend_hsgestion_test.reviews;

INSERT IGNORE INTO backend_hsgestion.orders
SELECT * FROM backend_hsgestion_test.orders;

INSERT IGNORE INTO backend_hsgestion.order_items
SELECT * FROM backend_hsgestion_test.order_items;

-- CREATE TABLE ... LIKE no garantiza copiar las claves foráneas.
-- Las agregamos explícitamente después de cargar los datos.
ALTER TABLE backend_hsgestion.article_images
  ADD CONSTRAINT fk_article_images_article
  FOREIGN KEY (article_id) REFERENCES backend_hsgestion.articles (id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE backend_hsgestion.favorites
  ADD CONSTRAINT favorites_article_id_fkey
  FOREIGN KEY (article_id) REFERENCES backend_hsgestion.articles (id)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT favorites_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES backend_hsgestion.clients (id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE backend_hsgestion.reviews
  ADD CONSTRAINT reviews_article_id_foreign
  FOREIGN KEY (article_id) REFERENCES backend_hsgestion.articles (id)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT reviews_client_id_foreign
  FOREIGN KEY (client_id) REFERENCES backend_hsgestion.clients (id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE backend_hsgestion.orders
  ADD CONSTRAINT fk_orders_client
  FOREIGN KEY (client_id) REFERENCES backend_hsgestion.clients (id)
  ON DELETE CASCADE;

ALTER TABLE backend_hsgestion.order_items
  ADD CONSTRAINT order_items_ibfk_1
  FOREIGN KEY (order_id) REFERENCES backend_hsgestion.orders (id)
  ON DELETE CASCADE,
  ADD CONSTRAINT order_items_ibfk_2
  FOREIGN KEY (article_id) REFERENCES backend_hsgestion.articles (id);

COMMIT;

-- Verificacion sugerida:
-- SELECT TABLE_NAME, TABLE_ROWS
-- FROM information_schema.tables
-- WHERE TABLE_SCHEMA = 'backend_hsgestion'
--   AND TABLE_NAME IN ('clients', 'article_images', 'hero_slides',
--                      'favorites', 'reviews', 'orders', 'order_items');
