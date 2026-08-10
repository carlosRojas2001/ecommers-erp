import { Test, TestingModule } from '@nestjs/testing';
import { LibroReclamosController } from './libro-reclamos.controller';
import { LibroReclamosService } from './libro-reclamos.service';

describe('LibroReclamosController', () => {
  let controller: LibroReclamosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LibroReclamosController],
      providers: [LibroReclamosService],
    }).compile();

    controller = module.get<LibroReclamosController>(LibroReclamosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
