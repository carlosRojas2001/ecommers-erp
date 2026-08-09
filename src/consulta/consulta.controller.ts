import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ConsultaService } from './consulta.service';


@Controller('consulta')
export class ConsultaController {
  constructor(private readonly consultaService: ConsultaService) {}

  @Get('sunat/:ruc')
  consultarRuc(@Param('ruc') ruc: string) {
    return this.consultaService.consultarRuc(ruc);
  }
}
