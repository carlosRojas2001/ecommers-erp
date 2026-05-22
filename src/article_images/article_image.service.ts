import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateArticleImageDto } from './dto/create-article_image.dto';
import { UpdateArticleImageDto } from './dto/update-article_image.to';

@Injectable()
export class ArticleImageService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private formatImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http')) {
      return url.replace(
        /http:\/\/localhost:\d+/g,
        this.configService.get('APP_URL') || 'http://192.168.18.26:3000',
      );
    }
    const baseUrl =
      this.configService.get('APP_URL') || 'http://192.168.18.26:3000';
    return `${baseUrl}${url}`;
  }

  async create(
    createArticleImageDto: CreateArticleImageDto,
    file?: Express.Multer.File,
  ) {
    const { article_id, is_main } = createArticleImageDto;
    const articleId = BigInt(article_id);

    // Generar URL si hay un archivo
    let imageUrl = createArticleImageDto.url;
    if (file) {
      imageUrl = `/storage/articles/${file.filename}`;
    }

    if (!imageUrl) {
      throw new Error('Debe proporcionar una URL o subir un archivo');
    }

    // 1. Calcular la siguiente posición automáticamente
    const lastImage = await this.prisma.article_images.findFirst({
      where: { article_id: articleId },
      orderBy: { position: 'desc' },
    });

    // Si no se envía posición, o se envía como null/undefined, usamos la automática
    const autoPosition = lastImage ? lastImage.position + 1 : 0;
    const finalPosition =
      createArticleImageDto.position === undefined ||
      createArticleImageDto.position === null ||
      createArticleImageDto.position === 0
        ? autoPosition
        : Number(createArticleImageDto.position); 

    // 2. Si esta imagen se marca como principal, desactivar 'is_main' en las otras 
    const shouldBeMain = is_main ?? autoPosition === 0;
    if (shouldBeMain) {
      await this.prisma.article_images.updateMany({
        where: { article_id: articleId },
        data: { is_main: false },
      });
    }

    // 3. Crear el registro de la imagen
    const image = await this.prisma.article_images.create({
      data: {
        article_id: articleId,
        url: imageUrl,
        public_id: createArticleImageDto.public_id,
        position: finalPosition,
        is_main: shouldBeMain,
      },
    });

    // 4. Si es la imagen principal, actualizamos el campo 'image_url' del artículo
    if (image.is_main) {
      await this.prisma.articles.update({
        where: { id: articleId },
        data: { image_url: image.url },
      });
    }

    return {
      ...image,
      id: image.id.toString(),
      article_id: image.article_id.toString(),
      url: this.formatImageUrl(image.url),
    };
  }

  async findAll(article_id?: string) {
    const where: any = {};
    if (article_id) {
      where.article_id = BigInt(article_id);
    }

    const images = await this.prisma.article_images.findMany({
      where,
    });
    return images.map((image) => ({
      ...image,
      id: image.id.toString(),
      article_id: image.article_id.toString(),
      url: this.formatImageUrl(image.url),
    }));
  }

  async findOne(id: string) {
    const image = await this.prisma.article_images.findUnique({
      where: { id: BigInt(id) },
    });
    if (!image) return null;
    return {
      ...image,
      id: image.id.toString(),
      article_id: image.article_id.toString(),
      url: this.formatImageUrl(image.url),
    };
  }

async update(
  id: string,
  updateArticleImageDto: UpdateArticleImageDto = {},
  file?: Express.Multer.File,
) {
  const imageId = BigInt(id);

  const dto = updateArticleImageDto;

  const data: any = { ...dto };

  //  file → url
  if (file) {
    data.url = `/storage/articles/${file.filename}`;
  }

  //  safe conversion
  const articleIdFromBody = dto.article_id
    ? BigInt(dto.article_id)
    : null;

  //  normalize is_main (YA ES BOOLEAN)
  const isMain = dto.is_main === true;

  if (isMain) {
    let articleId = articleIdFromBody;

    if (!articleId) {
      const current = await this.prisma.article_images.findUnique({
        where: { id: imageId },
      });

      if (!current) {
        throw new NotFoundException('Imagen no encontrada');
      }

      articleId = current.article_id;
    }

    await this.prisma.article_images.updateMany({
      where: { article_id: articleId },
      data: { is_main: false },
    });

    data.is_main = true;
  }

  const image = await this.prisma.article_images.update({
    where: { id: imageId },
    data,
  });

  if (image.is_main) {
    await this.prisma.articles.update({
      where: { id: image.article_id },
      data: { image_url: image.url },
    });
  }

  return {
    ...image,
    id: image.id.toString(),
    article_id: image.article_id.toString(),
    url: this.formatImageUrl(image.url),
  };
}

async setMain(id: string) {
  const imageId = BigInt(id);

  // 1. obtener imagen actual
  const image = await this.prisma.article_images.findUnique({
    where: { id: imageId },
  });

  if (!image) {
    throw new NotFoundException('Imagen no encontrada');
  }

  const articleId = image.article_id;

  // 2. quitar la principal actual
  await this.prisma.article_images.updateMany({
    where: { article_id: articleId },
    data: { is_main: false },
  });

  // 3. poner esta como principal
  const updated = await this.prisma.article_images.update({
    where: { id: imageId },
    data: { is_main: true },
  });

  // 4. actualizar portada del artículo
  await this.prisma.articles.update({
    where: { id: articleId },
    data: { image_url: updated.url },
  });

  return {
    ...updated,
    id: updated.id.toString(),
    article_id: updated.article_id.toString(),
  };
}

async remove(id: string) {
  try {
    const image = await this.prisma.article_images.delete({
      where: { id: BigInt(id) },
    });

    // SOLO si era principal
    if (image.is_main) {
      
      // buscar siguiente imagen disponible
      const nextMain = await this.prisma.article_images.findFirst({
        where: { article_id: image.article_id },
        orderBy: { created_at: 'asc' }, // mejor que position si no es confiable
      });

      if (nextMain) {
        // 1. marcarla como principal en imágenes
        await this.prisma.article_images.update({
          where: { id: nextMain.id },
          data: { is_main: true },
        });

        // 2. actualizar producto
        await this.prisma.articles.update({
          where: { id: image.article_id },
          data: { image_url: nextMain.url },
        });

      } else {
        // no hay imágenes
        await this.prisma.articles.update({
          where: { id: image.article_id },
          data: { image_url: null },
        });
      }
    }

    return {
      id: image.id.toString(),
      article_id: image.article_id.toString(),
      url: this.formatImageUrl(image.url),
    };

  } catch (error) {
    throw new NotFoundException('Imagen no encontrada');
  }
}
  
}
