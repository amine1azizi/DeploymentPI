import { Body, Controller, Post } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('recommendations')
  async getRecommendations(@Body() analysis: any) {
    console.log('POST /products/recommendations called');
    console.log('Body received:', analysis);

    return this.productsService.getRecommendedProducts(analysis);
  }
}
