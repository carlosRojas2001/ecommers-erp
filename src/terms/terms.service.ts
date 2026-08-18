import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_TITLE = 'Términos y Condiciones';
const DEFAULT_CONTENT = `1. Aceptación
Al realizar una compra en nuestra tienda en línea, usted acepta los presentes Términos y Condiciones.

2. Pedidos
Todo pedido generado está sujeto a confirmación de stock y verificación de datos del cliente (DNI para boleta, RUC para factura).

3. Precios y moneda
Los precios se expresan en Soles (PEN). Los productos con precio en dólares se convierten al tipo de cambio de venta vigente.

4. Facturación
La factura electrónica se emite una vez procesado el pedido, conforme a la normativa de SUNAT.

5. Entrega
Los tiempos de entrega se coordinan con el cliente luego de la facturación del pedido.

6. Anulaciones
Los pedidos pueden ser anulados siempre que no hayan sido facturados.

7. Reclamos
Puede registrar sus reclamos a través del Libro de Reclamaciones disponible en el sitio web, conforme al Código de Protección al Consumidor.`;

@Injectable()
export class TermsService {
  constructor(private prisma: PrismaService) {}

  async findCurrent() {
    const terms = await this.prisma.terms_conditions.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!terms) {
      return this.prisma.terms_conditions.create({
        data: { title: DEFAULT_TITLE, content: DEFAULT_CONTENT },
      });
    }

    return terms;
  }

  async update(dto: { title?: string; content: string }) {
    const current = await this.findCurrent();

    return this.prisma.terms_conditions.update({
      where: { id: current.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        content: dto.content,
      },
    });
  }
}
