import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import slugify from 'slugify';

@Injectable()
export class ChatbootService {

  private groq: Groq;

  // Cache de consultas SQL para paginación sin gastar tokens
  private queryCache = new Map<string, { sql: string; createdAt: number }>();
  private readonly ITEMS_PER_PAGE = 5;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutos

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {
    const apiKey =
      this.configService.get<string>('GROQ_API_KEY');

    this.groq = new Groq({
      apiKey: apiKey
    });

    // Limpiar cache expirado cada 5 minutos
    setInterval(() => this.cleanExpiredCache(), 5 * 60 * 1000);
  }

  /**
   * Primera consulta: IA genera SQL, ejecuta y devuelve página 1
   */
  async chat(userMessage: string) {

    const schema = this.getSchema();

    console.log('=== CHATBOT: Nueva consulta ===');
    console.log('Mensaje:', userMessage);

    // 1. IA genera SQL (SIN LIMIT, lo agregamos nosotros)
    const sqlResp =
      await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `
Eres experto en MySQL.

Esquema:
${schema}

Reglas:
- SOLO SELECT
- Nunca INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE
- Sin backticks de markdown
- Responde UNICAMENTE con el SQL limpio, sin explicaciones
- Siempre haz LEFT JOIN con article_images para traer la imagen principal (is_main = 1)
- Siempre haz LEFT JOIN con brands para traer el nombre de la marca
- Siempre haz LEFT JOIN con categories para traer el nombre de la categoría
- Siempre incluye: a.id, a.description, a.public_price, ai.url AS imagen, b.name AS marca, c.name AS categoria
- Filtra a.status = 1 para solo mostrar artículos activos
- NO agregues LIMIT ni OFFSET, eso lo manejo yo
`
          },
          {
            role: 'user',
            content: userMessage
          }
        ]
      });

    let sql =
      sqlResp.choices[0]
        .message.content
        ?.trim() || '';

    // Limpiar markdown
    if (sql.includes('```')) {
      const match = sql.match(/```(?:sql)?\s*([\s\S]*?)\s*```/i);
      if (match) sql = match[1].trim();
    }

    console.log('SQL generado:', sql);

    // Protección
    if (/(insert|update|delete|drop|alter|truncate)/i.test(sql)) {
      return {
        respuesta: 'Lo siento, esa consulta no está permitida.',
        productos: [],
        total: 0,
        pagina: 1,
        porPagina: this.ITEMS_PER_PAGE,
        hayMas: false,
      };
    }

    // Quitar LIMIT/OFFSET si la IA lo agregó de todos modos
    sql = sql.replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?/gi, '');

    // 2. Contar total de resultados
    const total = await this.countResults(sql);

    // 3. Ejecutar con paginación (página 1)
    const productos = await this.executePagedQuery(sql, 1);

    // 4. Guardar SQL en cache para "ver más" (sin gastar tokens)
    const consultaId = randomUUID();
    this.queryCache.set(consultaId, {
      sql,
      createdAt: Date.now(),
    });

    // 5. IA genera solo el texto de respuesta
    const respuesta = await this.generateResponseText(
      userMessage,
      total,
      productos.slice(0, 3),
    );

    const hayMas = total > this.ITEMS_PER_PAGE;

    return {
      message: respuesta,
      type: 'product_list',

      data: productos,

      meta: {
        total,
        hasMore: hayMas,
        nextCursor:
          productos.length > 0
            ? productos[productos.length - 1].id
            : null,

        queryId:
          hayMas
            ? consultaId
            : null,
      }
    };

  }

  /**
   * "Ver más": usa el SQL cacheado, SIN llamar a la IA (ahorra tokens)
   */
  async verMas(consultaId: string, pagina: number) {

    const cached = this.queryCache.get(consultaId);

    if (!cached) {
      return {
        error: 'La consulta ha expirado. Por favor, haz una nueva pregunta.',
        productos: [],
        total: 0,
        pagina,
        porPagina: this.ITEMS_PER_PAGE,
        hayMas: false,
      };
    }

    console.log(`=== CHATBOT: Ver más (página ${pagina}) ===`);

    const total = await this.countResults(cached.sql);
    const productos = await this.executePagedQuery(cached.sql, pagina);
    const hayMas = pagina * this.ITEMS_PER_PAGE < total;

    return {
      productos,
      total,
      pagina,
      porPagina: this.ITEMS_PER_PAGE,
      hayMas,
      ...(hayMas ? { consultaId } : {}),
    };
  }

  // ── Métodos privados ──────────────────────────────

  private async countResults(sql: string): Promise<number> {
    try {
      const countSql = `SELECT COUNT(*) as total FROM (${sql}) AS counted`;
      const countResult: any[] =
        await this.prisma.$queryRawUnsafe(countSql);
      return Number(countResult[0]?.total || 0);
    } catch (err) {
      console.error('Error contando resultados:', err.message);
      return 0;
    }
  }

  private formatProductRoute(id: number): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://192.168.18.35:3000/';
    const cleanFrontendUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
    return `${cleanFrontendUrl}/productos/${id}`;
  }

  private formatImageUrl(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const appUrl = this.configService.get<string>('APP_URL') || '';
    const cleanAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanAppUrl}${cleanPath}`;
  }

  private async executePagedQuery(sql: string, page: number) {
    const offset = (page - 1) * this.ITEMS_PER_PAGE;
    const pagedSql = `${sql} LIMIT ${this.ITEMS_PER_PAGE} OFFSET ${offset}`;

    try {
      const results: any[] =
        await this.prisma.$queryRawUnsafe(pagedSql);

      return results.map((row: any) => {
        const id = typeof row.id === 'bigint' ? Number(row.id) : row.id;
        const nombre = row.description || '';
        return {
          id,
          nombre,
          precio: row.public_price ? Number(row.public_price) : 0,
          imagen: this.formatImageUrl(row.imagen || row.image_url),
          marca: row.marca || null,
          categoria: row.categoria || null,
          ruta: this.formatProductRoute(id),
        };
      });
    } catch (err) {
      console.error('Error ejecutando consulta paginada:', err.message);
      return [];
    }
  }

  private async generateResponseText(
    userMessage: string,
    total: number,
    sampleProducts: any[],
  ): Promise<string> {
    try {
      const resp = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `
Eres un asistente amigable de un ecommerce.
Responde claro y breve en español.
NO listes los productos, solo da un resumen de lo encontrado.
Ejemplo: "Encontré 5 productos de tipo mouse disponibles."
`
          },
          {
            role: 'user',
            content: `
Pregunta del cliente: ${userMessage}
Total de productos encontrados: ${total}
Muestra: ${JSON.stringify(sampleProducts)}
`
          }
        ] 
      });

      return resp.choices[0].message.content || 'Sin respuesta';
    } catch {
      return `Encontré ${total} resultado(s) para tu búsqueda.`;
    }
  }

  private cleanExpiredCache() {
    const now = Date.now();
    for (const [key, val] of this.queryCache.entries()) {
      if (now - val.createdAt > this.CACHE_TTL) {
        this.queryCache.delete(key);
      }
    }
  }

  private getSchema() {
    return `
Tabla "articles" (artículos/productos) alias: a
- id: bigint (PK)
- cod_fab: varchar (código fabricante)
- description: varchar (nombre/descripción del artículo)
- brand_id: bigint (FK -> brands.id)
- category_id: bigint (FK -> categories.id)
- sub_category_id: bigint (FK -> sub_categories.id)
- public_price: decimal (precio de venta al público)
- purchase_price: decimal (precio de compra)
- venta: boolean (disponible para venta)
- status: tinyint (1=activo, 0=inactivo)
- image_url: varchar (imagen directa, puede ser null)
- is_new_for_web: boolean
- has_offer: boolean
- offer_price_percent: decimal

Tabla "article_images" (imágenes de artículos) alias: ai
- id: bigint (PK)
- article_id: bigint (FK -> articles.id)
- url: varchar(500) (URL de la imagen)
- position: int (orden)
- is_main: boolean (true = imagen principal)

Tabla "categories" (categorías) alias: c
- id: bigint (PK)
- name: varchar
- status: int (1=activo)

Tabla "brands" (marcas) alias: b
- id: bigint (PK)
- name: varchar
- status: int (1=activo)

Tabla "sub_categories" (subcategorías) alias: sc
- id: bigint (PK)
- name: varchar
- category_id: bigint (FK -> categories.id)
`;
  }
}
