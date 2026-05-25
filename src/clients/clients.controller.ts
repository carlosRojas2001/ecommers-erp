import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('clientes')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Patch('sunat')
  @UseGuards(AuthGuard('jwt'))
  consulltaConSunat(
  @Request() req: any,
  @Body() query:any){

    return this.clientsService.consultaEditarClientSunat(req?.user,query)
  }

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
