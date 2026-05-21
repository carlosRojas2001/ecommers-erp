import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { ArticleResponseDto } from './dto/article-response.dto';
import { FindArticlesQueryDto } from './dto/find-articles-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
  ) { }

  // @Serialize(ArticleResponseDto)
  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
  ) {
    return this.articlesService.findBySlug(slug);
  }

  @Serialize(ArticleResponseDto)
  @Get()
  async findAll(@Query() query: FindArticlesQueryDto) {
    return this.articlesService.findAll(query);
  }

  @Post('upload-build-image/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
      storage: diskStorage({
        destination: './storage/builds',
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
  uploadBuildImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.articlesService.uploadBuildImage(+id, file);
  }

  @Serialize(ArticleResponseDto)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(+id);
  }
}
