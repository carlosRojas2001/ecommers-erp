import { Module } from '@nestjs/common';
import { ArticleImageService } from './article_image.service';
import { ArticleImageController } from './article_image.controller';

@Module({
  controllers: [ArticleImageController],
  providers: [ArticleImageService],
})
export class ArticleImageModule {}
