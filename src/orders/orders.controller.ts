import { Controller, Get, Post, Body, Param, Res, Query, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { GetClient } from '../auth/decorators/get-client.decorator';

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

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('id') id: string, @GetClient() user: any) {
    const isAdmin = user.role === 'admin';
    return this.ordersService.findAll(id, user.id, isAdmin);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @GetClient() user: any,
  ) {
    return this.ordersService.findOne(+id, user.id, user.role === 'admin');
  }

  @UseGuards(JwtAuthGuard)
  @Get('pdf/:id')
  generatePdf(
    @Param('id') id: string,
    @Res() res: Response,
    @GetClient() user: any,
  ) {
    return this.ordersService.generatePdf(+id, res, user.id, user.role === 'admin');
  }

  @UseGuards(JwtAuthGuard)
  @Get('detalle/:id')
  detalleOrdenes(
    @Param('id') id: string,
    @GetClient() user: any,
  ) {
    return this.ordersService.detalleOrdenes(+id, user.id, user.role === 'admin');
  }
}
