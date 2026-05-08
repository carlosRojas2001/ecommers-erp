import {IsArray,IsNotEmpty,IsNumber,IsPositive,ValidateNested,} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsNumber()
  @IsNotEmpty()
  article_id: number;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  unit_price: number;
}

export class CreateOrderDto {
  @IsNumber()
  @IsNotEmpty()
  client_id: number;
  
  // @IsNumber()
  // @IsNotEmpty()
  // total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}