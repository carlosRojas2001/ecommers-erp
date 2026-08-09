const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.$queryRawUnsafe("SHOW INDEX FROM reviews WHERE Key_name = 'reviews_client_id_article_id_unique'");
  console.log(rows.length ? 'INDEX OK' : 'INDEX FAIL');
  await prisma.$disconnect();
})();
