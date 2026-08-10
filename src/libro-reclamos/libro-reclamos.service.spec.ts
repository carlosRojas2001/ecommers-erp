import { Test, TestingModule } from '@nestjs/testing';
import { LibroReclamosService } from './libro-reclamos.service';

describe('LibroReclamosService', () => {
  let service: LibroReclamosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LibroReclamosService],
    }).compile();

    service = module.get<LibroReclamosService>(LibroReclamosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
