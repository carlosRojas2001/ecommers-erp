import { PartialType } from '@nestjs/mapped-types';
import { CreateLibroReclamoDto } from './create-libro-reclamo.dto';

export class UpdateLibroReclamoDto extends PartialType(CreateLibroReclamoDto) {}
