import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { GetClient } from '../auth/decorators/get-client.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@GetClient() client: any, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(client.id, createReviewDto);
  }

  @Get('article/:articleId')
  findByArticle(@Param('articleId') articleId: string) {
    return this.reviewsService.findByArticle(articleId);
  }

  @Get('my-reviews')
  @UseGuards(AuthGuard('jwt'))
  findMyReviews(@GetClient() client: any) {
    return this.reviewsService.findByClient(client.id);
  }

@Patch(':id')
update(
  @Param('id') id: string,
  @Body() updateReviewDto: UpdateReviewDto,
) {
  return this.reviewsService.update(
    id,
    Number(updateReviewDto.article_id),
    updateReviewDto,
  );
}


  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string, @GetClient() client: any) {
    return this.reviewsService.remove(id, client.id);
  }

}
