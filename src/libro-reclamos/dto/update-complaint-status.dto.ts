import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateComplaintStatusDto {
  @IsIn(['NUEVO', 'REVISADO', 'PROCESADO'], {
    message: 'status debe ser nuevo, revisado o procesado',
  })
  status!: 'NUEVO' | 'REVISADO' | 'PROCESADO';

  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'La observación no puede exceder 2000 caracteres',
  })
  observations?: string;
}
