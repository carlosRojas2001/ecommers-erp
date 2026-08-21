import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisClientType } from "redis";
import { PrismaService } from "src/prisma/prisma.service";

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
    token = token.toLowerCase().trim();

    if (token.length <= 3) return token;

    if (token.endsWith('s')) {
      return token.slice(0, -1);
    }

    return token;
  }

  async construirVocabulario() {
    const filas: any[] = await this.prisma.$queryRaw`
      SELECT DISTINCT description FROM articles
    `;

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

    const tokensNormalizados = tokens.map(t =>
      this.normalizarToken(t)
    );

    const resultados = await this.redisClient.smIsMember(
      'vocabulario:articulos',
      tokensNormalizados,
    );

    return tokensNormalizados.filter((_, i) => resultados[i]);
  }

  async buscarArticulos(queryOriginal: string, req:any) {
     const tokens = queryOriginal
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2)
      .map(t => this.normalizarToken(t));

     const tokensValidos = await this.filtrarTokensValidos(tokens);

   if (tokensValidos.length === 0) {
        return {
        message: 'Lo siento, no hay productos disponibles',
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

     const booleanQuery = tokensValidos.map(t => `+${t}*`).join(' ');
    
      const [ data = [], totalResult ] = await Promise.all([

      await this.prisma.$queryRaw`
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
       INNER JOIN brands b ON b.id = a.brand_id
       INNER JOIN article_images i ON i.article_id = a.id 
       INNER JOIN categories c ON c.id = a.category_id
       WHERE MATCH(a.description) AGAINST (${booleanQuery} IN BOOLEAN MODE)
  
       LIMIT 20`,

     this.prisma.$queryRaw<{ total: bigint }[]>`
       SELECT COUNT(*) AS total
       FROM articles
       WHERE MATCH(description) AGAINST (${booleanQuery} IN BOOLEAN MODE)`
     ])
  
     const total = Number(totalResult[0]?.total ?? 0);
     const tipo_de_cambio:any =  await   this.prisma.exchange_rates.findFirst({orderBy: { date: 'desc' }});
     const frontendUrl = this.configService.get<string>('FRONTEND_URL');
     const appURL = this.configService.get<string>('APP_URL');
 
     return {
             message: data?.length === 0 && Array.isArray(data) ?"Lo siento no hay producto disponible"  :"Aqui tienes los resultados " ,
             type: "product_list",
             data: data.map((item:any) => ({
                ...item,
                precio: Number((Number(item?.precio) * Number(tipo_de_cambio?.sale_rate)).toFixed(2)),
                imagen: appURL + item?.imagen,
                ruta: frontendUrl + "productos/" + item?.ruta
             })),
             meta:{
              total,
              hasMore: total > data.length,
              nextCursor: null,
              queryId: null
              }
            }
  }
}



    //  ORDER BY relevancia DESC
//    MATCH(description) AGAINST (${booleanQuery} IN BOOLEAN MODE) AS relevancia