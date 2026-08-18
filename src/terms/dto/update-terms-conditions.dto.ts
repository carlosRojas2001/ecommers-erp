import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTermsConditionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'El título no puede exceder 150 caracteres' })
  title?: string;

  @IsString()
  @MinLength(1, { message: 'El contenido es obligatorio' })
  content: string;
}
