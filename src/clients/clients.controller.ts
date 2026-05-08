import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clientes')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('by-google-id/:googleId')
  findByGoogleId(@Param('googleId') googleId: string) {
    return this.clientsService.findByGoogleId(googleId);
  }

  @Get('filter-email')
  findByEmail(@Query('email') email: string) {
    if (!email) {
      throw new BadRequestException('El correo es requerido');
    }
    return this.clientsService.findByEmail(email);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.clientsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(+id, dto);
  }
}
