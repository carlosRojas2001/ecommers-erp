import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OrdersService {

  constructor(private prisma: PrismaService) { }

  async create(createOrderDto: CreateOrderDto) {

    let totales = 0;

    for (const item of createOrderDto.items) {
      
      const consulta = await this.prisma.articles.findUnique({
        where: {
          id: item.article_id,
        },
      });
      const unit_price = consulta?.public_price;
      const subtotal = (Number(unit_price) || 0) * Number(item.quantity);

      totales += subtotal;
    }
     
    const orders = await this.prisma.orders.create({
      data: {
        client_id: createOrderDto.client_id,
        
        total:totales,
      },
      include:{
        clients:true,
      }
    });
      console.log(orders?.clients?.document_number)

      if (orders?.clients?.document_number == "") throw new UnauthorizedException('Debes tener registro de dni')
      
    const item_irderns = await Promise.all(
      createOrderDto.items.map(async (item: any) => {
        
        const article = await this.prisma.articles.findUnique({
          where: {
            id: item.article_id,
          },
        });
        const unit_price = article?.public_price;
        const subtotal = (Number(unit_price) || 0) * Number(item.quantity);
        
        return this.prisma.order_items.create({
          data: {
            quantity: item.quantity,
            unit_price:unit_price || 0,
            subtotal:subtotal,

            orders: {
              connect: { id: orders.id, },
            },
            articles: {
              connect: { id: item.article_id },
            },
          },
        });
      }),
    );
    return {
      orders: {...orders, item_irderns},
    };

  }
async findAll(id?: string) {

  const where = id
    ? `WHERE c.id = '${id}'`
    : '';

  const order = await this.prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      o.id,
      o.client_id,
      o.total,
      o.status,
      c.id AS client_id,
      c.names AS client_name,
      o.created_at,

      JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', oi.id,
          'article_id', oi.article_id,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'subtotal', oi.subtotal,
          'article_description', a.description
        )
      ) AS items

    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN articles a ON a.id = oi.article_id
    LEFT JOIN clients c ON c.id = o.client_id

    ${where}

    GROUP BY o.id
  `);

  return order;
}

async  findOne(id: number) {
    const respuesta = await this.prisma.$queryRaw<any[]>`
SELECT 
  o.id,
  o.client_id,
  c.names AS client_names,
  c.lastnames AS client_lastnames,
  o.total,
  o.status,
  o.created_at
 
FROM orders o
LEFT JOIN clients c ON c.id = o.client_id
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN articles a ON a.id = oi.article_id
WHERE o.id = ${id}
GROUP BY o.id;
  `;
    if (!respuesta || respuesta.length === 0) {
      throw new BadRequestException('Orden no encontrada');
    }
    return respuesta[0];
  }
  async detalleOrdenes(id:number){
     const order = await this.prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      o.id,
      o.client_id,
      o.total,
      o.status,
      c.id AS client_id,
      c.names AS client_name,
      o.created_at,

      JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', oi.id,
          'article_id', oi.article_id,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'subtotal', oi.subtotal,
          'article_description', a.description
        )
      ) AS items

    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN articles a ON a.id = oi.article_id
    LEFT JOIN clients c ON c.id = o.client_id

    WHERE o.id = ${id}

    GROUP BY o.id
  `);

  return order[0];

  }


  async generatePdf(id: number, res: Response): Promise<void> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orden-${id}.pdf"`,
    ); 

    doc.on('error', (err) => {
      console.error('PDF error:', err);
      res.status(500).end();
    });

    res.on('error', (err) => {
      console.error('Response error:', err);
    });

    doc.pipe(res); 

    // Buscar datos de la orden en la base de datos
    const orders: any[] = await this.prisma.$queryRaw`
    SELECT 
      o.id,
      o.client_id,
      c.names AS client_names,
      c.lastnames AS client_lastnames,
      o.total,
      o.status,
      o.created_at,

      JSON_ARRAYAGG(
        JSON_OBJECT(
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'subtotal', oi.subtotal,
          'article_description', a.description
        )
      ) AS items

    FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN articles a ON a.id = oi.article_id
    WHERE o.id = ${id}
    GROUP BY o.id;
  `;

    if (!orders || orders.length === 0) {
      res.status(404).send('Orden no encontrada');
      return;
    }

    const order = orders[0]; 
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

    // --- ENCABEZADO ---
    // Colores y fuentes
    const colorPrimario = '#D32F2F'; // Rojo Cyberhouse
    const colorTexto = '#333333';
    const colorGris = '#777777';

    // Logo / Nombre de Empresa
    const logoPath = path.join(process.cwd(), 'storage', 'logociberhouse.jpeg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 30, { width: 180 });
    } else {
      doc.font('Helvetica-Bold').fontSize(24).fillColor(colorPrimario).text('CYBERHOUSE', 50, 50, { continued: true }).fillColor('#000000').text('TEC');
    }
    
    // Datos de la empresa
    doc.fontSize(10).fillColor(colorGris);
    let yCompany = 85;
    doc.text('RUC: 20614604825', 50, yCompany);
    yCompany += 15;
    doc.text('Dirección: AV. INCA GARCILASO DE LA VEGA NRO. 1348', 50, yCompany);
    yCompany += 12;
    doc.text('(INT 1049-1053 PISO 1 REF. TDA 1A 164-141) LIMA', 50, yCompany);
    yCompany += 15;
    doc.text('Teléfono: 981206097', 50, yCompany);
    yCompany += 20;

    doc.font('Helvetica-Bold').text('Cuentas Bancarias:', 50, yCompany);
    doc.font('Helvetica');
    yCompany += 12;
    doc.text('BCO. CREDITO SOLES: 191-7319236-0-75', 50, yCompany);
    yCompany += 12;
    doc.text('BCO. CREDITO DOLARES: 191-7320109-1-03', 50, yCompany);
    yCompany += 12;
    doc.text('BCO. CONTINENTAL SOLES: 0011-0175-0100099775', 50, yCompany);
    yCompany += 12;
    doc.text('BCO. CONTINENTAL DOLARES: 0011-0175-0100099783', 50, yCompany);

    // Datos del Comprobante (Alineado a la derecha)
    doc.font('Helvetica-Bold').fontSize(16).fillColor(colorTexto).text('COMPROBANTE DE ORDEN', 250, 50, { align: 'right' });
    
    doc.fontSize(12).fillColor(colorPrimario).text(`N° Orden: #${String(order.id).padStart(6, '0')}`, 250, 75, { align: 'right' });
    
    let fechaTexto = 'PROCESADO';
    if (order.created_at) {
      fechaTexto = new Date(order.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    doc.fontSize(10).fillColor(colorGris).text(`Fecha: ${fechaTexto}`, 250, 95, { align: 'right' });

    // Línea separadora
    const separatorY = yCompany + 20;
    doc.moveTo(50, separatorY).lineTo(545, separatorY).lineWidth(1).strokeColor('#E0E0E0').stroke();

    // --- DATOS DEL CLIENTE ---
    const clientName = `${order.client_names || ''} ${order.client_lastnames || ''}`.trim() || 'Cliente Desconocido';
    
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colorTexto).text('Facturado a:', 50, separatorY + 15);
    doc.font('Helvetica').fontSize(11).fillColor(colorGris).text(`Cliente: ${clientName}`, 50, separatorY + 35);
    doc.text(`Estado de Orden: PROCESADO`, 50, separatorY + 50);

    // --- TABLA DE PRODUCTOS ---
    let tableTop = separatorY + 80;
    
    // Fondo del encabezado de la tabla
    doc.rect(50, tableTop, 495, 25).fillColor(colorPrimario).fill();
    
    // Texto del encabezado de la tabla
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF');
    doc.text('DESCRIPCIÓN', 60, tableTop + 8);
    doc.text('CANT.', 320, tableTop + 8, { width: 50, align: 'center' });
    doc.text('PRECIO UNIT.', 380, tableTop + 8, { width: 70, align: 'right' });
    doc.text('SUBTOTAL', 460, tableTop + 8, { width: 75, align: 'right' });

    let y = tableTop + 35;
    doc.font('Helvetica').fontSize(10).fillColor(colorTexto);

    if (items && Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.article_description) continue;

        // Fila sombreada alterna
        if (i % 2 === 1) {
            doc.rect(50, y - 5, 495, 20).fillColor('#F9F9F9').fill();
            doc.fillColor(colorTexto);
        }

        doc.text(item.article_description.substring(0, 50), 60, y);
        doc.text(item.quantity.toString(), 320, y, { width: 50, align: 'center' });
        doc.text(`$${Number(item.unit_price).toFixed(2)}`, 380, y, { width: 70, align: 'right' });
        doc.text(`$${Number(item.subtotal).toFixed(2)}`, 460, y, { width: 75, align: 'right' });

        y += 20;
      }
    }

    // Línea separadora final de tabla
    doc.moveTo(50, y + 5).lineTo(545, y + 5).lineWidth(1).strokeColor('#E0E0E0').stroke();

    // --- TOTALES ---
    const totalTop = y + 15;
    
    // Recuadro para el total
    doc.rect(350, totalTop, 195, 30).fillColor('#F0F0F0').fill();
    
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colorTexto);
    doc.text('TOTAL:', 360, totalTop + 9);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(colorPrimario).text(`$${Number(order.total).toFixed(2)}`, 400, totalTop + 8, { width: 135, align: 'right' });

    // Mensaje de agradecimiento
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(colorGris);
    doc.text('¡Gracias por su preferencia!', 50, totalTop + 10);
    doc.text('Si tiene alguna duda sobre esta orden, por favor contáctenos.', 50, totalTop + 25);
    doc.text('Teléfono: 981206097', 50, totalTop + 50);

    // Pie de página
    const bottomY = doc.page.height - 50;
    doc.moveTo(50, bottomY - 10).lineTo(545, bottomY - 10).lineWidth(0.5).strokeColor('#E0E0E0').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#999999');
    doc.text('Este documento es un comprobante de orden generado electrónicamente.', 50, bottomY, { align: 'center', width: 495 });

    doc.end();
  }
  
  async masVendidos(){
    const respuesta = await this.prisma.$queryRaw<any[]>`
SELECT 
  a.description,  
  SUM(oi.quantity) AS total_vendido
FROM order_items oi
JOIN articles a ON a.id = oi.article_id
GROUP BY a.id
ORDER BY total_vendido DESC;
  `;
     return respuesta;
  }
}
