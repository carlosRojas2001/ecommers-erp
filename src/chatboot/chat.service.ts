import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisClientType } from "redis";
import { PrismaService } from "src/prisma/prisma.service";
import { randomUUID } from 'crypto';
import { normalizeToken as normalizeWithDict, getVariants } from './plural-variants';

@Injectable()
export class Chat implements OnModuleInit {
  
    

  constructor(
    @Inject('REDIS_CLIENT')
    private redisClient: RedisClientType,
    private prisma: PrismaService,
    private configService:ConfigService
  ) {}

  async onModuleInit() {
    await this.construirVocabulario();
  }

  private normalizarToken(token: string): string {
    // delega al diccionario plural-variants.ts (soporta singular/plural + sinónimos hw)
    return normalizeWithDict(token);
  }

  async construirVocabulario() {
    const filas: any[] = await this.prisma.$queryRaw`SELECT DISTINCT description FROM articles`;

    const vocabulario = new Set<string>();

    for (const fila of filas) {
      if (!fila.description) continue;

      fila.description
        .toLowerCase()
        .split(/[\s|,\-\/\.]+/)
        .filter((p: string) => p.length > 2)
        .map((p: string) => this.normalizarToken(p))
        .forEach((p: string) => vocabulario.add(p));
    }

    await this.redisClient.del('vocabulario:articulos');

    const arr = Array.from(vocabulario);

    if (arr.length > 0) {
      await this.redisClient.sAdd('vocabulario:articulos', arr);
    }
  }

  async filtrarTokensValidos(tokens: string[]): Promise<string[]> {
    if (tokens.length === 0) return [];

    const tokensNormalizados = tokens.map(t => this.normalizarToken(t));

    const resultados = await this.redisClient.smIsMember( 'vocabulario:articulos',tokensNormalizados,);

    return tokensNormalizados.filter((_, i) => resultados[i])}

  async buscarArticulos(queryOriginal: string) {

    const limit = 12;
    
     const tokens = queryOriginal.toLowerCase().split(/\s+/).filter(t => t.length > 2).map(t => this.normalizarToken(t));

      const tokensValidos = await this.filtrarTokensValidos(tokens);
      const tokensTexto = tokensValidos.join(' ');


    if (tokensValidos.length === 0) {
         return {
         message: 'Lo siento, no puedo resolver esa duda',
         type: 'product_list',
         data: [],
         meta: {
               total: 0,
               hasMore: false,
               nextCursor: null,
               queryId: null,
     },
   };
 }

      // Expandir cada token válido a todas sus variantes singular/plural/sinónimos
      // para que "rams" encuentre "ram/memorias" y "procesadores" encuentre "procesador/cpu"
      const booleanQuery = tokensValidos
        .map(valid => {
          const variants = Array.from(new Set(getVariants(valid).map(v => v.toLowerCase().trim()).filter(v => v.length > 2))).slice(0, 6);
          if (variants.length === 1) return `+${variants[0]}*`;
          // Grupo OR obligatorio: debe contener al menos una variante del concepto
          return `+(${variants.map(v => `${v}*`).join(' ')})`;
        })
        .join(' ');
    
      const [ data = [], totalResult ] = await Promise.all([

       this.prisma.$queryRaw`
       SELECT
        a.id,
        a.description AS nombre,
          MATCH(a.description) AGAINST (${queryOriginal} IN NATURAL LANGUAGE MODE) AS relevanciaDesc,
          MATCH(c.name) AGAINST (${queryOriginal} IN NATURAL LANGUAGE MODE) AS relevanciaCategoria,
            (c.name = UPPER(${tokensTexto})) AS categoriaExacta,
        a.public_price AS precio,
        (
          SELECT i.url
          FROM article_images i
          WHERE i.article_id = a.id
          LIMIT 1
        ) AS imagen,
        b.name AS marca,
        c.name AS categoria,
        a.slug AS ruta
     
       FROM articles a
       INNER JOIN brands b ON b.id = a.brand_id 
       INNER JOIN categories c ON c.id = a.category_id
        WHERE
        MATCH(c.name) AGAINST (${booleanQuery} IN BOOLEAN MODE)
        
          OR  MATCH(a.description) AGAINST (${booleanQuery} IN BOOLEAN MODE)
          ORDER BY
           categoriaExacta DESC,
          relevanciaCategoria DESC,
  relevanciaDesc DESC,
          a.id ASC
       
       LIMIT ${limit}
       ` as any,

     this.prisma.$queryRaw<{ total: bigint }[]>`
       SELECT COUNT(*) AS total
       FROM articles
       WHERE MATCH(description) AGAINST (${booleanQuery} IN BOOLEAN MODE)`

       
     ])
   
     const total = Number(totalResult[0]?.total ?? 0);
     const tipo_de_cambio:any =  await   this.prisma.exchange_rates.findFirst({orderBy: { date: 'desc' }}); 
     const appURL = this.configService.get<string>('APP_URL');
     
    

     const hasMore = total > data.length;

    const queryId = hasMore ? randomUUID() : null;  

     if (queryId) {
        await this.redisClient.set(`chat:query:${queryId}`,JSON.stringify({booleanQuery}),
        {
           EX: 60 * 10,
        },
  );
}
 
     return {
             message: data?.length === 0 && Array.isArray(data) ?"Lo siento no hay producto disponible"  :"Aqui tienes los resultados " ,
             type: "product_list",
             data: data.map((item:any) => ({
                ...item,
                precio: Number((Number(item?.precio) * (Number(tipo_de_cambio?.parallel_rate) || Number(tipo_de_cambio?.parallel_rate) || 0)).toFixed(2)),
                imagen: item?.imagen ? appURL + item.imagen : null,
      
             })),
             meta:{
              total,
              hasMore,
              nextCursor: null,
               queryId
              }
            }
  }

  async verMas(consultaId: string, pagina: number) {
  const cache = await this.redisClient.get(
    `chat:query:${consultaId}`,
  );

  if (!cache) {
    return {
      message: 'La consulta ha expirado. Realiza una nueva búsqueda.',
      type: 'product_list',
      data: [],
      meta: {
        total: 0,
        hasMore: false,
        nextCursor: null,
        queryId: null,
        pagina: 0,
      },
    };
  }

  const { booleanQuery } = JSON.parse(cache);

  const limit = 12;
  const offset = (pagina - 1) * limit;

  const [data = [], totalResult] = await Promise.all([
    this.prisma.$queryRaw`
      SELECT
        a.id,
        a.description AS nombre,
        a.public_price AS precio,

        (
          SELECT i.url
          FROM article_images i
          WHERE i.article_id = a.id
          LIMIT 1
        ) AS imagen,

        b.name AS marca,
        c.name AS categoria,
        a.slug AS ruta

      FROM articles a

      INNER JOIN brands b
        ON b.id = a.brand_id

      INNER JOIN categories c
        ON c.id = a.category_id

      WHERE MATCH(a.description)
        AGAINST (${booleanQuery} IN BOOLEAN MODE)

      ORDER BY
  MATCH(a.description)
    AGAINST (${booleanQuery} IN BOOLEAN MODE) DESC,
  a.id ASC

      LIMIT ${limit}
      OFFSET ${offset}
    ` as any,

    this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total
      FROM articles
      WHERE MATCH(description)
        AGAINST (${booleanQuery} IN BOOLEAN MODE)
    `,
  ]);

  const total = Number(totalResult[0]?.total ?? 0);

  const hasMore = offset + data.length < total;

  const totalPaginas = Math.ceil(total / limit);

  const tipo_de_cambio: any =
    await this.prisma.exchange_rates.findFirst({
      orderBy: {
        date: 'desc',
      },
    });

  const appURL =
    this.configService.get<string>('APP_URL');

  return {
    message:
      data.length === 0
        ? 'No hay más productos'
        : 'Aquí tienes más resultados',

    type: 'product_list',

    data: data.map((item: any) => ({
      ...item,

      precio: Number(
        (
          Number(item.precio) *
          (Number(tipo_de_cambio?.parallel_rate) || Number(tipo_de_cambio?.parallel_rate) || 0)
        ).toFixed(2)
      ),

      imagen: item.imagen
        ? appURL + item.imagen
        : null,
    })),

    meta: {
      total,
      hasMore,
      queryId: hasMore ? consultaId : null,
      pagina,
      totalPaginas,
    },
  };
  }
}



    //  ORDER BY relevancia DESC
//    MATCH(description) AGAINST (${booleanQuery} IN BOOLEAN MODE) AS relevancia

// {
//   "data": [
//     { "id": 8865 },
//     { "id": 8866 },
//     { "id": 8867 },
//     { "id": 8868 },
//     { "id": 8869 }
//   ],
//   "meta": {
//     "total": 58,
//     "hasMore": true,
//     "nextCursor": "8869",
//     "queryId": "f4c26370-0eed-4993-b0ad-e3cf2358e94f"
//   }
// }