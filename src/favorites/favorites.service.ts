import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async addFavorite(clientId: number, articleId: string) {
    try {
      const favorite = await this.prisma.favorites.create({
        data: {
          client_id: BigInt(clientId),
          article_id: BigInt(articleId),
        },
      });
      return this.serialize(favorite);
    } catch (error) {
      // P2002 es error de restricción única en Prisma
      if (error.code === 'P2002') {
        throw new ConflictException('Este producto ya está en tus favoritos');
      }
      throw error;
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
            // sub_categories: true,
            brands: true,
          },
        },
      },
    });

    return favorites.map((fav) => ({
      ...this.serialize(fav),
      article: this.serializeArticle(fav.articles),
    }));
  }

  async isFavorite(clientId: number, articleId: string) {
    const favorite = await this.prisma.favorites.findUnique({
      where: {
        client_id_article_id: {
          client_id: BigInt(clientId),
          article_id: BigInt(articleId),
        },
      },
    });

    if (!favorite) return null;
    return this.serialize(favorite);
  }

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

  private serializeArticle(article: any) {
    if (!article) return null;
    return {
      ...article,
      id: article.id.toString(),
      brand_id: article.brand_id?.toString(),
      category_id: article.category_id?.toString(),
      sub_category_id: article.sub_category_id?.toString(),
      // Decimal a number
      public_price: article.public_price
        ? parseFloat(article.public_price.toString())
        : null,
      // Concatenar URL de imagen
      image_url: article.image_url
        ? article.image_url.startsWith('http')
          ? article.image_url
          : `${process.env.APP_URL || 'http://localhost:3000'}${article.image_url}`
        : null,
      // Relaciones
      categories: article.categories
        ? { ...article.categories, id: article.categories.id.toString() }
        : null,
      sub_categories: article.sub_categories
        ? {
            ...article.sub_categories,
            id: article.sub_categories.id.toString(),
            category_id: article.sub_categories.category_id.toString(),
          }
        : null,
      brands: article.brands
        ? { ...article.brands, id: article.brands.id.toString() }
        : null,
    };
  }
}
