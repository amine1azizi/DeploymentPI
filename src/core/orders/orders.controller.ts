import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getOrders(@Req() req: any) {
    const userId = req.user.sub;
    return this.ordersService.getOrders(userId);
  }

  @Get(':id')
  async getOrder(@Req() req: any, @Param('id') orderId: string) {
    const userId = req.user.sub;
    return this.ordersService.getOrder(userId, orderId);
  }
}
