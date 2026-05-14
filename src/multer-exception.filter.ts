import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let message = 'Error al subir el archivo';

    if (exception.code === 'LIMIT_FILE_SIZE') {
      message = 'El archivo supera el tamaño máximo permitido de 1MB';
    } else if (exception.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Campo de archivo inesperado';
    }

    response.status(400).json({
      statusCode: 400,
      message,
      error: 'Bad Request',
    });
  }
}