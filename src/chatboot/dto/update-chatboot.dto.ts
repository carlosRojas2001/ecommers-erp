import { PartialType } from '@nestjs/mapped-types';
import { CreateChatbootDto } from './create-chatboot.dto';

export class UpdateChatbootDto extends PartialType(CreateChatbootDto) {}
