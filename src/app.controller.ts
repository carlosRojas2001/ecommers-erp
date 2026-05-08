import { Controller, Get, Post, UploadedFile, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '@nestjs/passport';
import { GetClient } from './auth/decorators/get-client.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  //   //subir imagenes
  // @Post('upload-image')
  // @UseGuards(AuthGuard('jwt'))
  // uploadImage(
  //   @GetClient() client: any,
  //   @UploadedFile() file: Express.Multer.File,
  // ) {
  //   return this.appService.uploadImage(client.id, file);
  // }
}
