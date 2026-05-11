// src/common/interceptors/serialize.interceptor.ts
import {
  UseInterceptors,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToInstance } from 'class-transformer';

export function Serialize(dto: any) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

class SerializeInterceptor implements NestInterceptor {
  constructor(private dto: any) {}

  intercept(context: ExecutionContext, handler: CallHandler): Observable<any> {
    return handler.handle().pipe(
      map((data: any) => {
        // Si la respuesta tiene 'data' y 'meta' (paginación)
        if (data?.data && data?.meta) {
          // Serializar cada item: los combos (type='combo') se pasan sin transformar
          const serializedData = (data.data as any[]).map((item) => {
            if (item?.type === 'combo') return item; // combo: pasar tal cual
            return plainToInstance(this.dto, item, {
              excludeExtraneousValues: true,
            });
          });

          return {
            data: serializedData,
            meta: data.meta,
          };
        }

        // Si es un solo objeto o array simple
        if (data?.type === 'combo') return data;

        return plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
        });
      }),
    );
  }
}
