import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsNumber()
  @IsNotEmpty()
  article_id!: number;

  @IsNumber()
  @IsPositive()
  @Max(9999)
  quantity!: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsNumber()
  client_id?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsNumber()
  @IsNotEmpty()
  document_type_id!: number;
}
