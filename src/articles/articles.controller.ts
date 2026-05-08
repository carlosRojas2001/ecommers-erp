import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { ArticleResponseDto } from './dto/article-response.dto';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Serialize(ArticleResponseDto)
  @Get()
  findAll(@Query() query: any) {
    return this.articlesService.findAll({
      page: query.page ? +query.page : 1,
      limit: query.limit ? +query.limit : 10,
      search: query.search,
      minPrice: query.minPrice ? +query.minPrice : undefined,
      maxPrice: query.maxPrice ? +query.maxPrice : undefined,
      categoryId: query.categoryId ? +query.categoryId : undefined,
      subCategoryId: query.subCategoryId ? +query.subCategoryId : undefined,
      brandId: query.brandId ? +query.brandId : undefined,
      inStock: query.inStock === 'true',
      sort: query.sort,
      exclude: query.exclude ? +query.exclude : undefined,
      nuevos: query.nuevos,
      ofertas: query.ofertas,
    });
  }
 
  
  //habra un login donde se permitira subir editar y quitar imagenes que solo podria ingresar el admin

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin')
  // @Post(':id/images')
  // @UseInterceptors(FileInterceptor('file'))
  // uploadImage(
  //   @Param('id') id: string,
  //   @UploadedFile() file: Express.Multer.File,
  // ) {
  //   return this.articlesService.uploadImage(+id, file);
  // }

  @Serialize(ArticleResponseDto)
  @Get('search')
  searchArticles(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('categories') categories?: string,
    @Query('subCategories') subCategories?: string,
    @Query('brand') brand?: string,
  ) {
    return this.articlesService.findAllProcedure(
      search?.trim() || '',
      categories?.trim() || '',
      subCategories?.trim() || '',
      brand?.trim() || '',
      limit ? +limit : 10,
      page ? +page : 1,
    );
  }

  @Serialize(ArticleResponseDto)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(+id);
  }
}
