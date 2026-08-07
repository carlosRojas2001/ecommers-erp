-- Importa solamente article_images desde backend_hsgestion_test.
-- La relación article_id se reconstruye contra los artículos del destino.
-- Ejecutar conectado al mismo servidor MariaDB.

USE backend_hsgestion;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS backend_hsgestion.article_images
  LIKE backend_hsgestion_test.article_images;

CREATE TEMPORARY TABLE article_image_article_map (
  source_article_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  destination_article_id BIGINT UNSIGNED NOT NULL
);

-- Primera opción: cod_fab es la clave estable del artículo.
INSERT INTO article_image_article_map (source_article_id, destination_article_id)
SELECT s.id, MIN(d.id)
FROM backend_hsgestion_test.articles s
INNER JOIN backend_hsgestion_test.article_images si ON si.article_id = s.id
INNER JOIN backend_hsgestion.articles d
  ON d.cod_fab = s.cod_fab
WHERE s.cod_fab IS NOT NULL AND s.cod_fab <> ''
GROUP BY s.id
HAVING COUNT(DISTINCT d.id) = 1;

-- Respaldo: description, únicamente si produce una coincidencia única.
INSERT INTO article_image_article_map (source_article_id, destination_article_id)
SELECT s.id, MIN(d.id)
FROM backend_hsgestion_test.articles s
INNER JOIN backend_hsgestion_test.article_images si ON si.article_id = s.id
INNER JOIN backend_hsgestion.articles d ON d.description = s.description
WHERE s.description IS NOT NULL AND s.description <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM article_image_article_map m
    WHERE m.source_article_id = s.id
  )
GROUP BY s.id
HAVING COUNT(DISTINCT d.id) = 1;

-- Verificación: debe devolver 0 antes de confirmar la transacción.
SELECT COUNT(*) AS unmapped_source_articles
FROM backend_hsgestion_test.article_images si
LEFT JOIN article_image_article_map m ON m.source_article_id = si.article_id
WHERE m.source_article_id IS NULL;

-- No se copia id: el destino genera sus propios IDs.
-- La condición evita duplicar una imagen si el script se ejecuta nuevamente.
INSERT INTO backend_hsgestion.article_images
  (article_id, url, public_id, position, is_main, created_at)
SELECT DISTINCT
  m.destination_article_id,
  si.url,
  si.public_id,
  si.position,
  si.is_main,
  si.created_at
FROM backend_hsgestion_test.article_images si
INNER JOIN article_image_article_map m ON m.source_article_id = si.article_id
WHERE NOT EXISTS (
  SELECT 1
  FROM backend_hsgestion.article_images di
  WHERE di.article_id = m.destination_article_id
    AND di.url = si.url
    AND (di.public_id = si.public_id OR (di.public_id IS NULL AND si.public_id IS NULL))
    AND di.position = si.position
    AND di.is_main = si.is_main
);

COMMIT;

DROP TEMPORARY TABLE article_image_article_map;
