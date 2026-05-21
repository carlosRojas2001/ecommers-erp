import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FindArticlesQueryDto } from './dto/find-articles-query.dto';
import { ArticleMapper } from './mappers/article.mapper';
import { SYNONYM_MAP } from './utils/search-synonyms';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService,
              private configService: ConfigService,
  ) { }

  async findAll(params: FindArticlesQueryDto) {
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
      type,
      aleatorio,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {
      status: 1, // Solo activos
      venta: true, // Solo para venta
    };

    if (search) {
      const rawTerms = search.toLowerCase().trim().split(/\s+/); 

      where.AND = rawTerms.map((originalTerm) => {
        let term = originalTerm;
        if (term.endsWith('s') && term.length > 4) term = term.slice(0, -1);
        if (term.endsWith('es') && term.length > 5) term = term.slice(0, -2);

        const relatedTerms = Array.from(
          new Set([
            originalTerm,
            term,
            ...(SYNONYM_MAP[originalTerm] || []),
            ...(SYNONYM_MAP[term] || []),
          ]), 
        ).filter((t) => t.length >= 4);

        // Si no quedan términos válidos, usar el término original directamente
        const termsToSearch = relatedTerms.length > 0 ? relatedTerms : [originalTerm];

        return {
          OR: termsToSearch.flatMap((t) => [
            // 1. Coincidencia directa en Categoría o Marca
            { categories: { name: { contains: t } } },
            { brands: { name: { contains: t } } },

            // 2. Coincidencia en Descripción, excluyendo accesorios relacionados
            {
              AND: [
                { description: { contains: t } },
                { description: { not: { contains: `para ${t}` } } },
                { description: { not: { contains: `compatible ${t}` } } },
                { description: { not: { contains: `compatible con ${t}` } } },
                { description: { not: { contains: `uso en ${t}` } } },
              ],
            },

            // 3. Coincidencia en Código de Fabricante
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

    // ── Inteligencia de Type Filter ──────────────────────────────────────────
    if (search && type) { 
      if (type === 'brand') {
        const brand = await this.prisma.brands.findFirst({
          where: { name: { contains: search } },
          select: { id: true },
        });
        if (brand) where.brand_id = brand.id;
      } else if (type === 'category') {
        const category = await this.prisma.categories.findFirst({
          where: { name: { contains: search } },
          select: { id: true },
        });
        if (category) where.category_id = category.id;
      } else if (type === 'subcategory') {
        const subcategory = await this.prisma.sub_categories.findFirst({
          where: { name: { contains: search } },
          select: { id: true },
        });
        if (subcategory) where.sub_category_id = subcategory.id;
      }
    }

    let orderBy: any = { date_at: 'desc' }; 
    if (sort === 'price_asc') orderBy = { public_price: 'asc' };
    if (sort === 'price_desc') orderBy = { public_price: 'desc' };
    if (sort === 'newest') orderBy = { date_at: 'desc' };

    const [articles, total] = await Promise.all([
      type === 'combo' ? Promise.resolve([]) : this.prisma.articles.findMany({
        where,
        skip: aleatorio ? undefined : skip,
        take: aleatorio ? 100 : limit,
        orderBy,
        include: {
          categories: true,
          brands: true,
          article_images: true,
          reviews: {
            where: { status: 1 },
            select: { rating: true },
          },
        },
      }),
      type === 'combo' ? Promise.resolve(0) : this.prisma.articles.count({ where }),
    ]);

    let finalArticles = articles;
    if (aleatorio) {
      finalArticles = articles.sort(() => Math.random() - 0.5).slice(0, limit);
    }

    // ── Combos (build_pc_tabla) ────────────────────────────────────────────── 
    const needCombos = !!(search || categoryId || subCategoryId || brandId); 
    const comboOrConditions: any[] = [];

    if (search) {
      const searchTerms = search.toLowerCase().trim().split(/\s+/);
      const isComputerSearch = searchTerms.some(t => 
        ['computadora', 'computadoras', 'pc', 'desktop', 'computador', 'laptop', 'notebook'].includes(t)
      );

      if (isComputerSearch) {
        comboOrConditions.push({ status: true }); 
      } else {
        comboOrConditions.push({ name: { contains: search } });
        comboOrConditions.push({ description: { contains: search } });
      }
    }

    if (categoryId || subCategoryId || brandId || (type === 'category' && where.category_id)) {
      const articleFilter: any = {};
      const finalCatId = categoryId || (type === 'category' ? where.category_id : undefined);
      const finalSubCatId = subCategoryId || (type === 'subcategory' ? where.sub_category_id : undefined);
      const finalBrandId = brandId || (type === 'brand' ? where.brand_id : undefined);

      if (finalCatId) articleFilter.category_id = BigInt(finalCatId);
      if (finalSubCatId) articleFilter.sub_category_id = BigInt(finalSubCatId);
      if (finalBrandId) articleFilter.brand_id = BigInt(finalBrandId);

      comboOrConditions.push({
        build_detail_pc_tabla: { some: { articles: articleFilter } },
      });
    }
  
    const comboWhere: any =
      comboOrConditions.length > 1
        ? { OR: comboOrConditions }
        : comboOrConditions.length === 1
          ? comboOrConditions[0]
          : {};

    const skipCombos = type === 'article' || (type === 'brand' && !brandId) || (type === 'category' && !categoryId); 

    const rawCombos = (needCombos && !skipCombos) || type === 'combo'
      ? await this.prisma.build_pc_tabla.findMany({
          where: comboWhere,
          take: aleatorio ? 50 : limit,
          include: {
            build_detail_pc_tabla: {
              include: {
                articles: {
                  include: {
                    article_images: {
                      orderBy: { position: 'asc' },
                    },
                    categories: true,
                    brands: true,
                  },
                },
              },
            },
          },
        })
      : [];

    const dollarRate = await this.getDollarRate();
    const baseUrl = this.configService.get('APP_URL') || 'http://192.168.18.26:3000';

    // ── Resolver nombres de filtros aplicados ─────────────────────────────
    const appliedFilters: { type: string; id: string; name: string }[] = [];

    if (categoryId) {
      const cat = await this.prisma.categories.findUnique({ where: { id: BigInt(categoryId) }, select: { name: true } });
      appliedFilters.push({ type: 'category', id: String(categoryId), name: cat?.name ?? 'Desconocida' });
    }
    if (subCategoryId) {
      const sub = await this.prisma.sub_categories.findUnique({ where: { id: BigInt(subCategoryId) }, select: { name: true } });
      appliedFilters.push({ type: 'subcategory', id: String(subCategoryId), name: sub?.name ?? 'Desconocida' });
    }
    if (brandId) {
      const br = await this.prisma.brands.findUnique({ where: { id: BigInt(brandId) }, select: { name: true } });
      appliedFilters.push({ type: 'brand', id: String(brandId), name: br?.name ?? 'Desconocida' });
    }

    let finalCombos = rawCombos;
    if (aleatorio) {
      finalCombos = rawCombos.sort(() => Math.random() - 0.5).slice(0, limit);
    }

    let itemType = 'article';
    if (type && ['brand', 'category', 'subcategory'].includes(type)) {
      itemType = type;
    } else if (appliedFilters.length > 0) {
      itemType = appliedFilters[0].type;
    }

    const data = finalArticles.map((article) =>
      ArticleMapper.toArticleResponse(article, dollarRate, baseUrl, itemType)
    );

    const formattedCombos = finalCombos.map((combo) =>
      ArticleMapper.toComboResponse(combo, dollarRate, baseUrl)
    );

    const dataWithCombos = [...data, ...formattedCombos];

    return {
      data: dataWithCombos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        applied_filters: appliedFilters.length > 0 ? appliedFilters : undefined,
      },
    };
  }

  async findOne(id: number) {
    const article = await this.prisma.articles.findUnique({
      where: { id: BigInt(id) },
      include: {
        categories: true,
        brands: true, 
        article_images: true,
        reviews: {
          where: { status: 1 },
          select: { rating: true },
        },
      },
    });
 
    const dollarRate = await this.getDollarRate();
    const baseUrl = this.configService.get('APP_URL') || 'http://192.168.18.26:3000';

    if (article) {
      let subCategory: any = null;
      if (article.sub_category_id) {
        subCategory = await this.prisma.sub_categories.findUnique({
          where: { id: article.sub_category_id },
        });
      }

      return ArticleMapper.toArticleResponse(article, dollarRate, baseUrl, 'article', subCategory);
    }

    // Si no es artículo, buscar en combos
    const combo = await this.prisma.build_pc_tabla.findUnique({
      where: { id: BigInt(id) },
      include: {
        build_detail_pc_tabla: {
          include: {
            articles: {
              include: {
                article_images: {
                  orderBy: { position: 'asc' },
                },
                categories: true,
                brands: true,
              },
            },
          },
        },
      },
    });

    if (combo) {
      return ArticleMapper.toComboResponse(combo, dollarRate, baseUrl);
    }
    return null;
  }

  async uploadBuildImage(id: number, file: Express.Multer.File) {
    const buildId = BigInt(id);

    // Verificar si el build existe
    const build = await this.prisma.build_pc_tabla.findUnique({
      where: { id: buildId },
    });

    if (!build) {
      throw new NotFoundException(`El build con ID ${id} no existe`);
    }

    const imageUrl = `/storage/builds/${file.filename}`;

    // Actualizar el build con la nueva imagen
    const updatedBuild = await this.prisma.build_pc_tabla.update({
      where: { id: buildId },
      data: { image_build: imageUrl },
    });

    const baseUrl = this.configService.get('APP_URL') || 'http://192.168.18.26:3000';

    return {
      ...updatedBuild,
      id: updatedBuild.id.toString(),
      company_id: updatedBuild.company_id.toString(),
      image_build: ArticleMapper.formatImageUrl(updatedBuild.image_build, baseUrl),
    };
  }

  async findBySlug(slug: string) {
    const id = slug.split('-').pop();

    if (!id || isNaN(Number(id))) {
      throw new NotFoundException('Slug inválido');
    }

    const producto = await this.prisma.articles.findUnique({
      where: {
        id: BigInt(id),
      },
      include: {
        categories: true,
        brands: true,
        article_images: true,
        reviews: {
          where: { status: 1 },
          select: { rating: true },
        },
      },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    const dollarRate = await this.getDollarRate();
    const baseUrl = this.configService.get('APP_URL') || 'http://192.168.18.26:3000';

    return ArticleMapper.toArticleResponse(producto, dollarRate, baseUrl, 'article');
  }

  private async getDollarRate(): Promise<number> {
    const exchangeRate = await this.prisma.exchange_rates.findFirst({
      orderBy: {
        date: 'desc',
      },
    });
    return exchangeRate ? Number(exchangeRate.sale_rate) : 0;
  }
}