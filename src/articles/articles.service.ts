import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Article } from './entities/article.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class ArticlesService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) { }
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    categoryId?: number;
    subCategoryId?: number;
    brandId?: number;
    inStock?: boolean;
    sort?: string;
    exclude?: number;
    nuevos?: boolean;
    ofertas?: boolean;
  }) {
    const {
      page = 1,
      limit = 10,
      search,
      minPrice,
      maxPrice,
      categoryId,
      subCategoryId,
      brandId,
      inStock,
      sort,
      exclude,
      nuevos,
      ofertas,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {
      status: 1, // Solo activos
      venta: true, // Solo para venta
    };

    if (search) {
      const rawTerms = search.toLowerCase().trim().split(/\s+/);

      const synonymMap: Record<string, string[]> = {
        laptop: ['notebook', 'laptop', 'computadora', 'portatil'],
        laptops: ['notebook', 'laptop', 'computadora', 'portatil'],
        notebook: ['laptop', 'notebook', 'portatil'],
        computadora: ['pc', 'laptop', 'computador'],
        computadoras: ['pc', 'laptop', 'computador'],
        celular: ['telefono', 'smartphone', 'movil'],
        celulares: ['telefono', 'smartphone', 'movil'],
      };

      where.AND = rawTerms.map((originalTerm) => {
        let term = originalTerm;
        if (term.endsWith('s') && term.length > 4) term = term.slice(0, -1);
        if (term.endsWith('es') && term.length > 5) term = term.slice(0, -2);

        const relatedTerms = Array.from(
          new Set([
            originalTerm,
            term,
            ...(synonymMap[originalTerm] || []),
            ...(synonymMap[term] || []),
          ]),
        );

        return {
          OR: relatedTerms.flatMap((t) => [
            // 1. Coincidencia directa en Categoría, Marca o Subcategoría (ALTA RELEVANCIA)
            { categories: { name: { contains: t } } },
            // { sub_categories: { name: { contains: t } } },
            { brands: { name: { contains: t } } },

            // 2. Coincidencia en Descripción, pero FILTRANDO "accesorios" (Ruido)
            // Si el término es 'laptop', no queremos que traiga 'Cargador PARA laptop'
            {
              AND: [
                { description: { contains: t } },
                { description: { not: { contains: `para ${t}` } } },
                { description: { not: { contains: `compatible ${t}` } } },
                { description: { not: { contains: `compatible con ${t}` } } },
                { description: { not: { contains: `uso en ${t}` } } },
              ],
            },

            // 3. Coincidencia en Código de Fabricante (Siempre relevante)
            { cod_fab: { contains: t } },
          ]),
        };
      });
    }

    if (categoryId) where.category_id = BigInt(categoryId);
    if (subCategoryId) where.sub_category_id = BigInt(subCategoryId);
    if (brandId) where.brand_id = BigInt(brandId);

    if (minPrice || maxPrice) {
      where.public_price = {
        gte: minPrice ? Number(minPrice) : undefined,
        lte: maxPrice ? Number(maxPrice) : undefined,
      };
    }

    //  schema original usa 'min_stock'
    if (inStock) {
      where.min_stock = { gt: 0 };
    }

    if (exclude) {
      where.id = { not: BigInt(exclude) };
    }

    if (nuevos) {
      where.is_new_for_web = true;
    }

    if (ofertas) {
      where.has_offer = true;
    }
    //  schema original usa 'date_at'
    let orderBy: any = { date_at: 'desc' };
    if (sort === 'price_asc') orderBy = { public_price: 'asc' };
    if (sort === 'price_desc') orderBy = { public_price: 'desc' };
    if (sort === 'newest') orderBy = { date_at: 'desc' };

    const [articles, total] = await Promise.all([
      this.prisma.articles.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          categories: true,
          // sub_categories: true,
          brands: true,
          article_images: true,
        },
      }),
      this.prisma.articles.count({ where }),
    ]);

   const exchangeRate = await this.prisma.exchange_rates.findFirst({
  orderBy: {
    date: 'desc',
  },
});

 const articulosRating:any[] =await Promise.all( articles.map(async (article) => {
  
  const rating:any[] = await this.prisma.reviews.findMany({
    where: {
      article_id: BigInt(article.id),
    },
  });
  console.log(rating);
  
  const average = rating.reduce((a, b) => a.rating + b.rating, 0) / rating.length;
  // return {
  //   ...article,
  //   rating: average,
  // };
 }));

console.log(articulosRating);


const dollarRate = exchangeRate ? Number(exchangeRate.sale_rate) : 0;

    const data = articles.map((article) => ({
      ...article,
      precio_public_soles:  article.public_price  ? parseFloat(article.public_price.toString()) * dollarRate : null,
      precio_porcentaje: ( (Number(article.public_price) * dollarRate ) * ( Number(article.offer_price_percent || 0) )).toFixed(2),
      is_new_for_web: article.is_new_for_web ? 1 : 0,
      has_offer: article.has_offer ? 1 : 0,
      offer_price_percent: article.offer_price_percent ? Number(article.offer_price_percent) : 0,
      categories: article.categories ? { ...article.categories, id: article.categories.id.toString(),} : null,
      brands: article.brands ? { ...article.brands, id: article.brands.id.toString(),} : null,
      public_price: article.public_price ? parseFloat(article.public_price.toString()) : null,
      // rating:
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const article = await this.prisma.articles.findUnique({
      where: { id: BigInt(id) },
      include: {
        categories: true,
        // sub_categories: true,
        brands: true,
        article_images: true,
      },
    });

    if (!article) return null;

    const exchangeRate = await this.prisma.exchange_rates.findFirst({
      orderBy: {
        date: 'desc',
      },
    });
    const dollarRate = exchangeRate
      ? Number(exchangeRate.sale_rate)
      : 0;
    return {
      ...article,
      precio_public_soles:  article.public_price  ? parseFloat(article.public_price.toString()) * dollarRate : null,
      precio_porcentaje: ( (Number(article.public_price) * dollarRate ) * ( Number(article.offer_price_percent || 0) )).toFixed(2),
      is_new_for_web: article.is_new_for_web ? 1 : 0,
      has_offer: article.has_offer ? 1 : 0,
      offer_price_percent: article.offer_price_percent ? Number(article.offer_price_percent) : 0,
      categories: article.categories ? { ...article.categories, id: article.categories.id.toString(),} : null,
      brands: article.brands ? { ...article.brands, id: article.brands.id.toString(),} : null,
      public_price: article.public_price ? parseFloat(article.public_price.toString()) : null,
    };
  }

  async findAllProcedure(
    search: string,
    categories: string,
    subCategories: string,
    brand: string,
    limit: number = 10,
    page: number = 1,
  ) {

const result: any = await this.prisma.$queryRawUnsafe(
  `CALL search_articles(?, ?, ?, ?, ?, ?)`,
  search,
  categories ? Number(categories) : null,
  subCategories ? Number(subCategories) : null,
  brand ? Number(brand) : null,
  limit,
  page,
);

console.log(JSON.stringify(result, null, 2));
  }
}










    // return {
    //   ...article,
    //   id: article.id.toString(),
    //   measurement_unit_id: article.measurement_unit_id?.toString(),
    //   brand_id: article.brand_id?.toString(),
    //   category_id: article.category_id?.toString(),
    //   sub_category_id: article.sub_category_id?.toString(),
    //   currency_type_id: article.currency_type_id?.toString(),
    //   company_type_id: article.company_type_id?.toString(),
    //   user_id: article.user_id?.toString(),
    //   last_supplier: article.last_supplier?.toString(),
    //   last_entry_guide: article.last_entry_guide?.toString(),
    //   article_type_id: article.article_type_id?.toString(),
    //   precio_public_soles:  article.public_price  ? parseFloat(article.public_price.toString()) * dollarRate : null,
    //   precio_porcentaje: ( (Number(article.public_price) * dollarRate ) * ( Number(article.offer_price_percent || 0) )).toFixed(2),
    //   is_new_for_web: article.is_new_for_web ? 1 : 0,
    //   has_offer: article.has_offer ? 1 : 0,
    //   offer_price_percent: article.offer_price_percent ? Number(article.offer_price_percent) : 0,
    //   categories: article.categories ? { ...article.categories, id: article.categories.id.toString(),} : null,
    //   brands: article.brands ? { ...article.brands, id: article.brands.id.toString(),} : null,
    //   public_price: article.public_price ? parseFloat(article.public_price.toString()) : null,
    //   purchase_price: article.purchase_price ? parseFloat(article.purchase_price.toString()) : null,
    //   distributor_price: article.distributor_price ? parseFloat(article.distributor_price.toString()) : null,
    //   authorized_price: article.authorized_price ? parseFloat(article.authorized_price.toString()) : null,
    //   article_images: article.article_images
    // };


//         const wildcard = `%${search}%`;
//     const startsWith = `${search}%`;

//     const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
//     const safePage = Number.isFinite(page) && page > 0 ? page : 1;
//     const offset = (safePage - 1) * safeLimit;

//     let filters = '';

// if (categories && !isNaN(Number(categories))) {
//   filters += ` AND a.category_id = ${Number(categories)} `;
// }
// if (subCategories && !isNaN(Number(subCategories))) {
//   filters += ` AND a.sub_category_id = ${Number(subCategories)} `;
// }
// if (brand && !isNaN(Number(brand))) {
//   filters += ` AND a.brand_id = ${Number(brand)} `;
// }

//     const baseQuery = `
//       SELECT
//         type, id, cod_fab, description, public_price,
//         stock, min_stock, status, venta,
//         brand_id, category_id, sub_category_id,
//         image_url, created_at, updated_at,
//         relevance
//       FROM (

//         --  COMBO
//         SELECT 'combo' AS type, b.id, NULL AS cod_fab, b.name AS description,
//               b.total_price AS public_price, NULL AS stock, NULL AS min_stock,
//               NULL AS status, NULL AS venta, NULL AS brand_id, NULL AS category_id,
//               NULL AS sub_category_id, NULL AS image_url,
//               b.created_at, b.updated_at, 1 AS relevance
//         FROM build_pc_tabla b
//         WHERE b.name LIKE ?

//         UNION ALL

//         --  ARTICLE NORMAL
//         SELECT 'article', a.id, a.cod_fab, a.description, a.public_price,
//               NULL, a.min_stock, a.status, a.venta, a.brand_id,
//               a.category_id, a.sub_category_id, a.image_url,
//               a.created_at, a.updated_at,
//               CASE
//                 WHEN a.cod_fab = ? THEN 100
//                 WHEN a.description LIKE ? THEN 90
//                 WHEN a.description LIKE ? THEN 70
//                 ELSE 50
//               END
//         FROM articles a
//         WHERE (
//     a.description LIKE ? 
//     OR a.cod_fab LIKE ? 
//     OR a.filt_NameEsp LIKE ?
//   )
//   ${filters}

//         UNION ALL

//         --  CATEGORY
//         SELECT 'category', a.id, a.cod_fab, a.description, a.public_price,
//               NULL, a.min_stock, a.status, a.venta, a.brand_id,
//               a.category_id, a.sub_category_id, a.image_url,
//               a.created_at, a.updated_at, 80
//         FROM articles a
//         INNER JOIN categories c ON a.category_id = c.id
//         WHERE c.name LIKE ?

//         UNION ALL

//         --  BRAND
//         SELECT 'brand', a.id, a.cod_fab, a.description, a.public_price,
//               NULL, a.min_stock, a.status, a.venta, a.brand_id,
//               a.category_id, a.sub_category_id, a.image_url,
//               a.created_at, a.updated_at, 70
//         FROM articles a
//         INNER JOIN brands br ON a.brand_id = br.id
//         WHERE br.name LIKE ?

//         UNION ALL

//         --  SUBCATEGORY
//         SELECT 'sub_category', a.id, a.cod_fab, a.description, a.public_price,
//               NULL, a.min_stock, a.status, a.venta, a.brand_id,
//               a.category_id, a.sub_category_id, a.image_url,
//               a.created_at, a.updated_at, 60
//         FROM articles a
//         INNER JOIN sub_categories sc ON a.sub_category_id = sc.id
//         WHERE sc.name LIKE ?

//       ) AS results

//       GROUP BY type, id, cod_fab, description, public_price,
//               stock, min_stock, status, venta,
//               brand_id, category_id, sub_category_id,
//               image_url, created_at, updated_at
//     `;

//     const params = [
//       wildcard, // combo
//       search, // cod_fab exact
//       startsWith, // description starts
//       wildcard, // description contains
//       wildcard, // WHERE description
//       wildcard, // cod_fab
//       wildcard, // filt_NameEsp
//       wildcard, // category
//       wildcard, // brand
//       wildcard, // subcategory
//     ];

//     const [rows, countResult] = await Promise.all([
//       this.prisma.$queryRawUnsafe<any[]>(
//         `${baseQuery}
//        ORDER BY 
//          CASE 
//            WHEN type = 'article' THEN 1
//            WHEN type = 'combo' THEN 2
//            WHEN type = 'category' THEN 3
//            WHEN type = 'brand' THEN 4
//            WHEN type = 'sub_category' THEN 5
//             ELSE 6
//          END,
//          relevance DESC
//        LIMIT ${safeLimit} OFFSET ${offset}`,
//         ...params,
//       ),
//       this.prisma.$queryRawUnsafe<any[]>(
//         `SELECT COUNT(*) as total FROM (${baseQuery}) AS counted`,
//         ...params,
//       ),
//     ]);
//     console.log(rows);
//     const total = Number(countResult[0]?.total ?? 0);
//     const results = rows ?? [];

//     // 1. Obtener IDs de los artículos encontrados para traer sus imágenes
//     const articleIds = results
//       .filter((row) => row.type !== 'combo')
//       .map((row) => BigInt(row.id));

//     if (articleIds.length > 0) {
//       const images = await this.prisma.article_images.findMany({
//         where: { article_id: { in: articleIds } },
//         orderBy: { position: 'asc' },
//       });

//       // 2. Agrupar imágenes por article_id
//       const imagesMap = images.reduce(
//         (acc, img) => {
//           const artId = img.article_id.toString();
//           if (!acc[artId]) acc[artId] = [];
//           acc[artId].push({
//             ...img,
//             id: img.id.toString(),
//             article_id: artId,
//             // Formatear URL si es necesario
//             url: img.url.startsWith('http')
//               ? img.url.replace(
//                 /http:\/\/localhost:\d+/g,
//                 this.configService.get('APP_URLS') ||
//                 'http://192.168.18.26:3000',
//               )
//               : `${this.configService.get('APP_URLS') || 'http://192.168.18.26:3000'}${img.url.startsWith('/') ? '' : '/'}${img.url}`,
//           });
//           return acc;
//         },
//         {} as Record<string, any[]>,
//       );

//       // 3. Adjuntar las imágenes a cada fila
//       results.forEach((row) => {
//         if (row.type !== 'combo') {
//           row.article_images = imagesMap[row.id.toString()] || [];
//           // Asegurar que id sea string para evitar problemas de BigInt
//           row.id = row.id.toString();
//           if (row.brand_id) row.brand_id = row.brand_id.toString();
//           if (row.category_id) row.category_id = row.category_id.toString();
//           if (row.sub_category_id)
//             row.sub_category_id = row.sub_category_id.toString();
//         }
//       });
//     }

//     // 4. Obtener detalles de combos si hay alguno
//     const comboIds = results
//       .filter((row) => row.type === 'combo')
//       .map((row) => BigInt(row.id));
//     if (comboIds.length > 0) {
//       const comboDetails = await this.prisma.build_detail_pc_tabla.findMany({
//         where: { build_pc_id: { in: comboIds } },
//         include: {
//           articles: {
//             include: { article_images: true },
//           },
//         },
//       });

//       // Agrupar detalles por combo_id
//       const comboMap = comboDetails.reduce(
//         (acc, detail) => {
//           const comboId = detail.build_pc_id.toString();
//           if (!acc[comboId]) acc[comboId] = [];

//           // Formatear el artículo dentro del combo
//           const art = detail.articles;
//           acc[comboId].push({
//             id: art.id.toString(),
//             description: art.description,
//             public_price: art.public_price
//               ? parseFloat(art.public_price.toString())
//               : 0,
//             article_images: art.article_images.map((img) => ({
//               ...img,
//               id: img.id.toString(),
//               article_id: img.article_id.toString(),
//               url: img.url.startsWith('http')
//                 ? img.url.replace(
//                   /http:\/\/localhost:\d+/g,
//                   this.configService.get('APP_URLS') ||
//                   'http://192.168.18.26:3000',
//                 )
//                 : `${this.configService.get('APP_URLS') || 'http://192.168.18.26:3000'}${img.url.startsWith('/') ? '' : '/'}${img.url}`,
//             })),
//           });
//           return acc;
//         },
//         {} as Record<string, any[]>,
//       );

//       // Adjuntar a los resultados
//       results.forEach((row) => {
//         if (row.type === 'combo') {
//           row.items = comboMap[row.id.toString()] || [];
//           row.id = row.id.toString();
//         }
//       });
//     }

//     return {
//       data: results,
//       meta: {
//         total,
//         page: safePage,
//         limit: safeLimit,
//         lastPage: Math.ceil(total / safeLimit),
//       },
//     };