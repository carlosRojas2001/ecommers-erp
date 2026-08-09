import { Test, TestingModule } from '@nestjs/testing';
import { ConsultaController } from './consulta.controller';
import { ConsultaService } from './consulta.service';

describe('ConsultaController', () => {
  let controller: ConsultaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsultaController],
      providers: [ConsultaService],
    }).compile();

    controller = module.get<ConsultaController>(ConsultaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
