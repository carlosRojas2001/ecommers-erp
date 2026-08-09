import { Module } from '@nestjs/common';
import { ConsultaService } from './consulta.service';
import { ConsultaController } from './consulta.controller';

@Module({
  controllers: [ConsultaController],
  providers: [ConsultaService],
})
export class ConsultaModule {}
