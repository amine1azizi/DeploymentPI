import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('add')
  async addToCart(@Req() req: any, @Body() product: any) {
    const keycloakId = req.user.sub;
    return this.cartService.addToCart(keycloakId, product);
  }

  @Get()
  async getCart(@Req() req: any) {
    const keycloakId = req.user.sub;
    return this.cartService.getCart(keycloakId);
  }

  @Delete('item/:id')
  async removeFromCart(@Req() req: any, @Param('id') itemId: string) {
    const keycloakId = req.user.sub;
    return this.cartService.removeFromCart(keycloakId, itemId);
  }

  @Put('item/:id')
  async updateQuantity(
    @Req() req: any,
    @Param('id') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    const keycloakId = req.user.sub;
    return this.cartService.updateQuantity(keycloakId, itemId, quantity);
  }

  @Post('checkout')
  async checkout(@Req() req: any) {
    const keycloakId = req.user.sub;
    return this.cartService.checkout(keycloakId);
  }
}
