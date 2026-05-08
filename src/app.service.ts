import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
  //   //subir imagenes
  //   uploadImage(
  //   @GetClient() client: any,
  //   @UploadedFile() file: Express.Multer.File,
  // ) {
  //   return this.reviewsService.uploadImage(client.id, file);
  // }
}
