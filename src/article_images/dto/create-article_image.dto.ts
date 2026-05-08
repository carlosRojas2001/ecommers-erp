export class CreateArticleImageDto {
  url?: string;
  article_id: number;
  public_id?: string;
  position?: number;
  is_main?: boolean;
}
