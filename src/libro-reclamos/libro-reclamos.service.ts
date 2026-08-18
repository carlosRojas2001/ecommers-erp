// src/libro-reclamos/libro-reclamos.service.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ComplaintCounterService } from './services/complaint-counter.service';
import { StorageService } from './services/storage.service';
import { RecaptchaService } from './services/recaptcha.service';
import { ComplaintCreatedEvent } from './events/complaint-created.event';
import { CreateLibroReclamoDto } from './dto/create-libro-reclamo.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LibroReclamosService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private counterService: ComplaintCounterService,
    private storageService: StorageService,
    private recaptchaService: RecaptchaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    dto: CreateLibroReclamoDto,
    files: {
      evidence?: Express.Multer.File[];
      signature?: Express.Multer.File[];
    },
    customerId: number | null,
  ) {
    // 1. reCAPTCHA se valida ANTES de tocar la BD/transacción
    await this.recaptchaService.verify(dto.recaptcha_token);

    // 2. Archivos se suben fuera de la transacción de BD (I/O de disco no debe alargar el lock)
    const evidencePath = files.evidence?.[0]
      ? await this.storageService.saveFile(files.evidence[0], 'evidence')
      : null;
    const signaturePath = files.signature?.[0]
      ? await this.storageService.saveFile(files.signature[0], 'signature')
      : null;

    // 3. Transacción atómica: numeración + insert
    const complaint = await this.prisma.$transaction(async (tx) => {
      const numberComplaint = await this.counterService.getNextNumber(tx);

      return tx.complaints.create({
        data: {
          number_complaint: numberComplaint,
          customer_name: dto.customer_name,
          customer_lastname: dto.customer_lastname,
          dni_ruc: dto.dni_ruc,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          parent_data: dto.parent_data,
          well_hired: dto.well_hired,
          description: dto.description,
          detail_complaint: dto.detail_complaint,
          order: dto.order,
          amount: dto.amount,
          type_complaint: dto.type_complaint,
          observations: dto.observations,
          evidence_path: evidencePath,
          signature_path: signaturePath,
          customer_id: customerId,
          status: 'NUEVO',
          date_complaint: new Date(),
        },
      });
    });

    // 4. Evento async — no bloquea la respuesta
    this.eventEmitter.emit(
      'complaint.created',
      new ComplaintCreatedEvent(
        Number(complaint.id),
        complaint.number_complaint,
        complaint.email,
        complaint.customer_name,
      ),
    );

    return complaint;
  }

  async findAll(status?: string, page = 1, limit = 20) {
    const where: any = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.complaints.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.complaints.count({ where }),
    ]);

    const appUrl = this.config.get<string>('APP_URL');
    //  console.log('APP_URL leído:', appUrl);
    const dataWithFullUrls = data.map((c) => ({
      ...c,
      id: Number(c.id),
      evidence_path: c.evidence_path ? `${appUrl}${c.evidence_path}` : null,
      signature_path: c.signature_path ? `${appUrl}${c.signature_path}` : null,
    }));

    return { data: dataWithFullUrls, total, page, limit };
  }

  async updateStatus(
    id: number,
    status: 'NUEVO' | 'REVISADO' | 'PROCESADO',
    observations?: string,
  ) {
    const data: {
      status: 'NUEVO' | 'REVISADO' | 'PROCESADO';
      observations?: string;
    } = {
      status,
    };

    if (observations !== undefined) {
      data.observations = observations;
    }

    return this.prisma.complaints.update({
      where: { id },
      data,
    });
  }
}
