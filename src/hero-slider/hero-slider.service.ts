import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateHeroSliderDto } from './dto/create-hero-slider.dto';
import { UpdateHeroSliderDto } from './dto/update-hero-slider.dto';

@Injectable()
export class HeroSliderService {
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

  async create(createHeroSliderDto: CreateHeroSliderDto, file?: Express.Multer.File) {
    let imageUrl = '';
    if (file) {
      imageUrl = `/storage/hero-slider/${file.filename}`;
    }

    const slide = await this.prisma.hero_slides.create({
      data: {
        title: createHeroSliderDto.title,
        subtitle: createHeroSliderDto.subtitle,
        image: imageUrl,
        link: createHeroSliderDto.link,
        order: Number(createHeroSliderDto.order),
        active: createHeroSliderDto.active !== false,
        name: "",
      },
    });

    return {
      ...slide,
      id: slide.id.toString(),
      image: this.formatImageUrl(slide.image),
    };
  }

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 10, search } = params;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    if (search) {
      where.title = { contains: search };
    }

    const [slides, total] = await Promise.all([
      this.prisma.hero_slides.findMany({
        where,
        skip,
        take,
        orderBy: { order: 'asc' },
      }),
      this.prisma.hero_slides.count({ where }),
    ]);

    return {
      data: slides.map((slide) => ({
        ...slide,
        id: slide.id.toString(),
        image: this.formatImageUrl(slide.image),
      })),
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const slide = await this.prisma.hero_slides.findUnique({
      where: { id: BigInt(id) },
    });

    if (!slide) {
      throw new NotFoundException('Hero slider no encontrado');
    }

    return {
      ...slide,
      id: slide.id.toString(),
      image: this.formatImageUrl(slide.image),
    };
  }

  async update(id: string, updateHeroSliderDto: UpdateHeroSliderDto, file?: Express.Multer.File) {
    const slideId = BigInt(id);
    const existing = await this.prisma.hero_slides.findUnique({
      where: { id: slideId },
    });

    if (!existing) {
      throw new NotFoundException('Hero slider no encontrado');
    }

    let imageUrl = existing.image;
    if (file) {
      imageUrl = `/storage/hero-slider/${file.filename}`;
    }

    const slide = await this.prisma.hero_slides.update({
      where: { id: slideId },
      data: {
        title: updateHeroSliderDto.title !== undefined ? updateHeroSliderDto.title : existing.title,
        subtitle: updateHeroSliderDto.subtitle !== undefined ? updateHeroSliderDto.subtitle : existing.subtitle,
        link: updateHeroSliderDto.link !== undefined ? updateHeroSliderDto.link : existing.link,
        order: updateHeroSliderDto.order !== undefined ? Number(updateHeroSliderDto.order) : existing.order,
        active: updateHeroSliderDto.active !== undefined ? updateHeroSliderDto.active : existing.active,
        image: imageUrl,
      },
    });

    return {
      ...slide,
      id: slide.id.toString(),
      image: this.formatImageUrl(slide.image),
    };
  }

  async remove(id: string) {
    const slideId = BigInt(id);
    const slide = await this.prisma.hero_slides.delete({
      where: { id: slideId },
    });

    return {
      ...slide,
      id: slide.id.toString(),
    };
  }
}
