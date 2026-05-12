import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

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
    const doc = new PDFDocument({ margin: 50 });

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
    // Convertir items de texto a array si es necesario
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

    // Dibujar el PDF con los datos reales
    doc.fontSize(20).text('Comprobante de Orden', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Orden ID: #${order.id}`);

    // Manejo de fecha segura
    let fechaTexto = 'Desconocida';
    if (order.created_at) {
      fechaTexto = new Date(order.created_at).toLocaleDateString();
    }
    doc.text(`Fecha: ${fechaTexto}`);

    // Mostrar nombre del cliente en lugar del ID
    const clientName = `${order.client_names || ''} ${order.client_lastnames || ''}`.trim() || 'Cliente Desconocido';
    doc.text(`Cliente: ${clientName}`);

    doc.moveTo(50, 150).lineTo(550, 150).stroke();
    doc.moveDown(2);

    // Títulos de la tabla
    let tableTop = 180;
    doc.font('Helvetica-Bold');
    doc.text('Descripción', 50, tableTop);
    doc.text('Cant', 300, tableTop);
    doc.text('Precio', 380, tableTop);
    doc.text('Subtotal', 460, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Dibujar los items
    let y = tableTop + 25;
    doc.font('Helvetica');

    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.article_description) continue; // Evitar items vacíos si no hay productos

        doc.text(item.article_description.substring(0, 40), 50, y);
        doc.text(item.quantity.toString(), 300, y);
        doc.text(`$${Number(item.unit_price).toFixed(2)}`, 380, y);
        doc.text(`$${Number(item.subtotal).toFixed(2)}`, 460, y);

        y += 20;
      }
    }

    doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();
    doc.font('Helvetica-Bold');
    doc.text(`Total: $${Number(order.total).toFixed(2)}`, 380, y + 25);

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
