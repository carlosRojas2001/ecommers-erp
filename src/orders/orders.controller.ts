import { Controller, Get, Post, Body, Param, Res, Query, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { AuthGuard } from '@nestjs/passport';


@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('mas-vendidos-productos')
masVendidos() {
  return this.ordersService.masVendidos();
}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  findAll(
    @Query('id') id?: string,

  ) {
    return this.ordersService.findAll(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(+id);
  }


  @Get('pdf/:id')
generatePdf(@Param('id') id: string, @Res() res: Response) {
  return this.ordersService.generatePdf(+id, res);
}

@Get('detalle/:id')
detalleOrdenes(@Param('id') id: string) {
  return this.ordersService.detalleOrdenes(+id);
}


}
