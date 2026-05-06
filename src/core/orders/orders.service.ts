import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async getOrders(keycloakId: string) {
    // Find user by keycloakId
    const user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      return []; // Return empty array if user not found
    }

    const orders = await this.prisma.order.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    // Ensure all orders have a total (calculate if missing)
    return orders.map((order) => ({
      ...order,
      total: order.total || this.calculateOrderTotal(order),
    }));
  }

  private calculateOrderTotal(order: any): number {
    if (!order.items || order.items.length === 0) return 0;
    const subtotal = order.items.reduce((sum: number, item: any) => {
      const price = parseFloat(item.price.replace('$', '') || '0');
      return sum + price * item.quantity;
    }, 0);
    return subtotal + (order.shipping || 0) + (order.tax || 0);
  }

  async getOrder(keycloakId: string, orderId: string) {
    // Find user by keycloakId
    const user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: { items: true },
    });
  }
}
