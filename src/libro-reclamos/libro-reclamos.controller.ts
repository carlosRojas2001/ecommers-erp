// src/libro-reclamos/libro-reclamos.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';

import { LibroReclamosService } from './libro-reclamos.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateLibroReclamoDto } from './dto/create-libro-reclamo.dto';

@Controller('complaints')
export class ComplaintsController {
  constructor(private libroReclamosService: LibroReclamosService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests/min por IP
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'evidence', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]))
  async create(
    @Body() dto: CreateLibroReclamoDto,
    @UploadedFiles() files: { evidence?: Express.Multer.File[]; signature?: Express.Multer.File[] },
    @Req() req: any,
  ) {
    const customerId = req.user?.id ?? null;
    const complaint = await this.libroReclamosService.create(dto, files, customerId);

    return {
      id: Number(complaint.id),
      number_complaint: complaint.number_complaint,
      created_at: complaint.created_at,
    };
  }

  // --- Admin ---

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll(@Query('status') status?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.libroReclamosService.findAll(status, Number(page), Number(limit));
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateStatus(@Param('id') id: string, @Body('status') status: 'pendiente' | 'atendido' | 'cerrado') {
    return this.libroReclamosService.updateStatus(Number(id), status);
  }
}