import {IsArray,IsNotEmpty,IsNumber,IsOptional,IsPositive,ValidateNested,} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsNumber()
  @IsNotEmpty()
  article_id: number;

  @IsNumber()
  @IsPositive()
  quantity: number;

  // @IsNumber()
  // @IsPositive()
  // @IsOptional()
  // unit_price?: number;

}

export class CreateOrderDto {
  @IsNumber()
  @IsNotEmpty()
  client_id: number;



  @IsArray()
  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}