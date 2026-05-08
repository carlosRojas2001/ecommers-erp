import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { ArticleImageService } from './article_image.service';
import { CreateArticleImageDto } from './dto/create-article_image.dto';
import { UpdateArticleImageDto } from './dto/update-article_image.to';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('article-images')
export class ArticleImageController {
  constructor(private readonly articleImageService: ArticleImageService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @UseInterceptors(
    FileInterceptor('url', {
      storage: diskStorage({
        destination: './storage/articles',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createArticleImageDto: CreateArticleImageDto,
  ) {
    return this.articleImageService.create(createArticleImageDto, file);
  }

  @Get()
  findAll(@Query('article_id') article_id?: string) {
    return this.articleImageService.findAll(article_id);
  }

  @Get('article/:article_id')
  findAllByArticle(@Param('article_id') article_id: string) {
    return this.articleImageService.findAll(article_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articleImageService.findOne(id);
  }
@Patch('set-main/:id')
@UseGuards(AuthGuard('jwt'), AdminGuard)
setMain(@Param('id') id: string) {
  return this.articleImageService.setMain(id);
}



@Patch(':id')
@UseGuards(AuthGuard('jwt'), AdminGuard)
@UseInterceptors(
  FileInterceptor('image', {
    storage: diskStorage({
      destination: './storage/articles',
      filename: (req, file, cb) => {
        const randomName = Array(32)
          .fill(null)
          .map(() => Math.round(Math.random() * 16).toString(16))
          .join('');

        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }),
)
update(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
  @Body() updateArticleImageDto: UpdateArticleImageDto,
) {
  return this.articleImageService.update(id, updateArticleImageDto, file);
}


  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  remove(@Param('id') id: string) {
    return this.articleImageService.remove(id);
  }
}
