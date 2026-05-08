import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';
import { GetClient } from '../auth/decorators/get-client.decorator';

@Controller('favorites')
@UseGuards(AuthGuard('jwt'))
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  getFavorites(@GetClient() client: any) {
    return this.favoritesService.getFavorites(client.id);
  }

  @Get('usuario/:id')
  getFavoritesByUser(@Param('id') id: string) {
    return this.favoritesService.getFavorites(+id);
  }

  @Post(':articleId')
  addFavorite(@GetClient() client: any, @Param('articleId') articleId: string) {
    return this.favoritesService.addFavorite(client.id, articleId);
  }

  @Delete(':articleId')
  removeFavorite(
    @GetClient() client: any,
    @Param('articleId') articleId: string,
  ) {
    return this.favoritesService.removeFavorite(client.id, articleId);
  }

  @Get(':articleId')
  isFavorite(@GetClient() client: any, @Param('articleId') articleId: string) {
    return this.favoritesService.isFavorite(client.id, articleId);
  }
}
