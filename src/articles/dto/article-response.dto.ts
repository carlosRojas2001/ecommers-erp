import { Expose, Transform, Type } from 'class-transformer';

export class CategoryResponseDto {
  @Expose() id: string;
  @Expose() name: string;
}

export class SubCategoryResponseDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() category_id: string;
}

export class BrandResponseDto {
  @Expose() id: string;
  @Expose() name: string;
}

export class ArticleImageResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString())
  id: string;

  @Expose()
  @Transform(({ value }) => {
    if (!value) return null;
    const baseUrl = process.env.APP_URL || 'http://192.168.18.26:3001';
    if (value.startsWith('http')) {
      return value.replace(/http:\/\/localhost:\d+/g, baseUrl);
    }
    return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
  })
  url: string;

  @Expose() position: number;
  @Expose() is_main: boolean;
}

export class ArticleResponseDto {
  @Expose() type: string;
  @Expose() id: number;
  @Expose() description: string;
  @Expose() cod_fab: string;

  // @Expose()
  // @Transform(({ value }) => { if (!value) return null; const baseUrl = process.env.APP_URL || 'http://192.168.18.26:3000'; if (value.startsWith('http')) { return value.replace(/http:\/\/localhost:\d+/g, baseUrl); } return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`; })
  // image_url: string;

@Expose()
@Transform(({ value }) => {
  if (value === undefined || value === null) {
    return null;
  }

  return Number(value);
})
public_price: number;

  // @Expose()
  // @Transform(({ value }) => value ? parseFloat(value.toString()) : null)
  // rating: number;

  @Expose() sold_count: number;
  @Expose() category_id: number;
  @Expose() sub_category_id: number;
  @Expose() brand_id: number;
  @Expose() stock: number;
  @Expose() status: number;
  @Expose() venta: boolean;
  @Expose() created_at: Date;
  @Expose() updated_at: Date;

  @Expose()
  categories: CategoryResponseDto;

  @Expose()
  sub_categories: SubCategoryResponseDto;

  @Expose()
  brands: BrandResponseDto;

  @Expose() min_stock: number;

  @Expose()
  @Type(() => ArticleImageResponseDto)
  article_images: ArticleImageResponseDto[];

  @Expose()
  precio_public_soles: number;

  @Expose()
  precio_porcentaje: number;

  @Expose()
  // @Transform(({ value }) => value === true || value === 1 || value === '1')
  is_new_for_web: number;

  @Expose()
  // @Transform(({ value }) => value === true || value === 1 || value === '1')
  has_offer: number;

  @Expose()
  offer_price_percent: number;

  @Expose()
  items: any[];
}



// import { Expose, Transform, Type } from 'class-transformer';

// class MetaDto {
//   @Expose()
//   total: number;

//   @Expose()
//   page: number;

//   @Expose()
//   limit: number;

//   @Expose()
//   totalPages: number;
// }

// export class CategoryResponseDto {
//   @Expose() id: string;
//   @Expose() name: string;
// }

// export class SubCategoryResponseDto {
//   @Expose() id: string;
//   @Expose() name: string;
//   @Expose() category_id: string;
// }

// export class BrandResponseDto {
//   @Expose() id: string;
//   @Expose() name: string;
// }

// export class ArticleImageResponseDto {
//   @Expose()
//   @Transform(({ value }) => value?.toString())
//   id: string;

//   @Expose()
//   @Transform(({ value }) => {
//     if (!value) return null;
//     const baseUrl = process.env.APP_URL || 'http://192.168.18.26:3001';
//     if (value.startsWith('http')) {
//       return value.replace(/http:\/\/localhost:\d+/g, baseUrl);
//     }
//     return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
//   })
//   url: string;

//   @Expose() position: number;
//   @Expose() is_main: boolean;
// }

// export class ArticleResponseDto {
//   @Expose() type: string;
//   @Expose() id: number;
//   @Expose() description: string;
//   @Expose() cod_fab: string;

//   // @Expose()
//   // @Transform(({ value }) => { if (!value) return null; const baseUrl = process.env.APP_URL || 'http://192.168.18.26:3000'; if (value.startsWith('http')) { return value.replace(/http:\/\/localhost:\d+/g, baseUrl); } return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`; })
//   // image_url: string;

//   @Expose()
//   @Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
//   public_price: number;

//   // @Expose()
//   // @Transform(({ value }) => value ? parseFloat(value.toString()) : null)
//   // rating: number;

//   @Expose() sold_count: number;
//   @Expose() category_id: number;
//   @Expose() sub_category_id: number;
//   @Expose() brand_id: number;
//   @Expose() stock: number;
//   @Expose() status: number;
//   @Expose() venta: boolean;
//   @Expose() created_at: Date;
//   @Expose() updated_at: Date;

//   @Expose()
//   categories: CategoryResponseDto;

//   @Expose()
//   sub_categories: SubCategoryResponseDto;

//   @Expose()
//   brands: BrandResponseDto;

//   @Expose() is_new_for_web: boolean;
//   @Expose() has_offer: boolean;
//   @Expose() offer_price_percent: number;

//   @Expose() min_stock: number;

//   @Expose()
//   @Type(() => ArticleImageResponseDto)
//   article_images: ArticleImageResponseDto[];

//   @Expose()
//   @Type(() => MetaDto)
//   meta: MetaDto;

//   @Expose()
//   items: any[];
// }
