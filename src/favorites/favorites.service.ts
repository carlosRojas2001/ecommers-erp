import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}
    /**
   * Serializa objetos que contienen BigInt para evitar errores de JSON
   */
  private serialize(obj: any) {
    if (!obj) return null;
    return {
      ...obj,
      id: obj.id?.toString(),
      client_id: obj.client_id?.toString(),
      article_id: obj.article_id?.toString(),
    };
  }

  async addFavorite(clientId: number, articleId: string) {
    try {
  //   // para combos------------------------------------------//
  //   const respuesta:any = await this.prisma.$queryRaw<any[]>`
  // SELECT 
  //   articles.id AS article_id,
  //   articles.public_price AS unit_price,
  //   build_detail_pc_tabla.quantity

  // FROM build_pc_tabla
  // INNER JOIN build_detail_pc_tabla 
  //   ON build_detail_pc_tabla.build_pc_id = build_pc_tabla.id
  // INNER JOIN articles 
  //   ON articles.id = build_detail_pc_tabla.article_id
  // WHERE build_pc_tabla.id = ${articleId}`;
  //   // const re =  respuesta.map(item=>item.article_id)
  //  console.log(respuesta)
  //   //------------------------------------------------------// 
      const favorite = await this.prisma.favorites.create({
        data: {
          client_id: BigInt(clientId),
          article_id: BigInt(articleId),
        },
      });
      return this.serialize(favorite);
    } catch (error) { 
      if (error.code === 'P2002') {
        throw new ConflictException('Este producto ya está en tus favoritos');
      }
      throw "No se encontro el articulo seleccionado";
    }
  }

  async removeFavorite(clientId: number, articleId: string) {
    try {
      await this.prisma.favorites.delete({
        where: {
          client_id_article_id: {
            client_id: BigInt(clientId),
            article_id: BigInt(articleId),
          },
        },
      });
      return { message: 'Producto eliminado de favoritos' };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('El producto no estaba en tus favoritos');
      }
      throw error;
    }
  }

  async getFavorites(clientId: number) {
    const favorites = await this.prisma.favorites.findMany({
      where: { client_id: BigInt(clientId) },
      include: {
        articles: {
          include: {
            categories: true,
            article_images: true,
            // sub_categories: true,
            brands: true,
          },
        },
      },
    });
    const exchangeRate = await this.prisma.exchange_rates.findFirst({
      orderBy: { date: 'desc' },
    });
    const dollarRate = exchangeRate ? Number(exchangeRate.sale_rate) : 0;

    return favorites.map((fav) => {
      const { articles, ...favData } = fav;
      return {
        ...this.serialize(favData),
        article: this.serializeArticle(articles, dollarRate)
      };
    });
  }

  async isFavorite(clientId: number, articleId: string) {
    const favorite = await this.prisma.favorites.findUnique({
      where: {
        client_id_article_id: {
          client_id: BigInt(clientId),
          article_id: BigInt(articleId),
        },
      },
      include: {
        articles: {
          include: {
            categories: true,
            article_images: true,
            brands: true,
          },
        },
      },
    });

    if (!favorite) return null;

    const exchangeRate = await this.prisma.exchange_rates.findFirst({
      orderBy: { date: 'desc' },
    });
    const dollarRate = exchangeRate ? Number(exchangeRate.sale_rate) : 0;

    const { articles, ...favData } = favorite;
    return {
      ...this.serialize(favData),
      article: this.serializeArticle(articles, dollarRate),
    };
  }

  private serializeArticle(article: any, dollarRate: number = 0) {
    if (!article) return null;
    const { image_url, ...articleData } = article;
    return {
      type: 'article' as const,
      name: article.description,
      ...articleData,
      id: article.id.toString(),
      brand_id: article.brand_id?.toString(),
      category_id: article.category_id?.toString(),
      sub_category_id: article.sub_category_id?.toString(),
      precio_public_soles: article.public_price ? parseFloat(article.public_price.toString()) * dollarRate : null,
      precio_porcentaje: ((Number(article.public_price) * dollarRate) * (Number(article.offer_price_percent || 0))).toFixed(2),
      article_images: (article.article_images || []).map((img: any) => ({
        ...img,
        url: this.formatImageUrl(img.url),
      })),
      public_price: article.public_price ? parseFloat(article.public_price.toString()) : null,
      categories: article.categories ? { ...article.categories, id: article.categories.id.toString() } : null,
      sub_categories: article.sub_categories ? { ...article.sub_categories, id: article.sub_categories.id.toString(), category_id: article.sub_categories.category_id.toString(), } : null,
      brands: article.brands ? { ...article.brands, id: article.brands.id.toString() } : null,
    };
  }

  private formatImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;

    const baseUrl =
      this.configService.get('APP_URL') || 'http://192.168.18.26:3000';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }
}
