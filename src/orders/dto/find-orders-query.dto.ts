import { IsIn, IsOptional } from 'class-validator';

export type OrderStatusFilter = 'activo' | 'anulado' | 'todos';

export class FindOrdersQueryDto {
  @IsOptional()
  @IsIn(['activo', 'anulado', 'todos'], {
    message: 'status debe ser activo, anulado o todos',
  })
  status?: OrderStatusFilter = 'activo';
}
