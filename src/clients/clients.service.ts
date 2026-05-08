import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPaginationInfinity(params: {
    id?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { id, page = 1, limit = 10, search } = params;

    const skip = (page - 1) * limit;

    const where: any = { status: 1 };

    if (id) {
      where.id = BigInt(id);
    }

    if (search) {
      where.name = { contains: search };
    }

    const [data, total] = await Promise.all([
      this.prisma.clients.findMany({
        where,
        skip,
        take: limit,
        // orderBy: { name: 'asc' },
      }),
      this.prisma.clients.count({ where }),
    ]);

    return {
      data: data.map((client) => ({
        ...client,
        id: client.id.toString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  async findByEmail(email: string) {
    return this.prisma.clients.findUnique({ where: { email } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.clients.findUnique({ where: { google_id: googleId } });
  }

  async create(data: {
    names: string;
    lastnames: string;
    email: string;
    phone?: string;
    document_type?: string;
    document_number?: string;
    password?: string;
    googleId?: string;
  }) {
    return this.prisma.clients.create({
      data: {
        names: data.names,
        lastnames: data.lastnames,
        email: data.email,
        phone: data.phone,
        document_type: data.document_type,
        document_number: data.document_number,
        password: data.password,
        google_id: data.googleId,
      },
    });
  }

  async createFromGoogle(data: {
    name: string;
    email: string;
    googleId: string;
  }) {
    const parts = data.name.split(' ');
    const names = parts[0] || '';
    const lastnames = parts.slice(1).join(' ') || '';

    return this.create({
      names,
      lastnames,
      email: data.email,
      googleId: data.googleId,
    });
  }

  async findOne(id: number) {
    return this.prisma.clients.findUnique({ where: { id } });
  }

  async update(id: number, data: any) {
    return this.prisma.clients.update({
      where: { id },
      data,
    });
  }
}
