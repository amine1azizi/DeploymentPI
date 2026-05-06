import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async addToCart(keycloakId: string, product: any) {
    console.log(`Adding to cart for user ${keycloakId}:`, product);

    if (!product.name || !product.brand || !product.price || !product.image) {
      throw new BadRequestException(
        'Product must have name, brand, price, and image',
      );
    }

    // Find user by keycloakId, create if not exists
    let user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      // Create user with minimal info
      user = await this.prisma.user.create({
        data: {
          keycloakId,
          email: `user-${keycloakId}@temp.com`, // Temporary email
          username: `user-${keycloakId}`,
        },
      });
    }

    console.log(`User ID:`, user.id);

    // Find or create cart for user
    let cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId: user.id },
      });
      console.log(`Created new cart:`, cart);
    } else {
      console.log(`Found existing cart:`, cart);
    }

    // Add item to cart
    const cartItem = await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        image: product.image,
        url: product.url,
        quantity: product.quantity || 1,
      },
    });

    console.log(`Created cart item:`, cartItem);

    return cartItem;
  }

  async getCart(keycloakId: string) {
    // Find user by keycloakId, create if not exists
    let user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      // Create user with minimal info
      user = await this.prisma.user.create({
        data: {
          keycloakId,
          email: `user-${keycloakId}@temp.com`, // Temporary email
          username: `user-${keycloakId}`,
        },
      });
    }

    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true },
    });

    console.log(`Cart for user ${user.id}:`, cart);

    if (!cart) {
      return { items: [] };
    }

    console.log(`Cart items:`, cart.items);

    return cart;
  }

  async removeFromCart(keycloakId: string, itemId: string) {
    console.log(`Removing item ${itemId} from cart for user ${keycloakId}`);

    // Find user by keycloakId, create if not exists
    let user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      // Create user with minimal info
      user = await this.prisma.user.create({
        data: {
          keycloakId,
          email: `user-${keycloakId}@temp.com`, // Temporary email
          username: `user-${keycloakId}`,
        },
      });
    }

    // Ensure the item belongs to the user's cart
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    console.log(`Item found:`, item);
    console.log(`User ID:`, user.id);
    console.log(`Cart User ID:`, item?.cart.userId);

    if (!item) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    if (item.cart.userId !== user.id) {
      throw new NotFoundException(
        `Cart item ${itemId} does not belong to user ${user.id}`,
      );
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return { message: 'Item removed from cart' };
  }

  async updateQuantity(keycloakId: string, itemId: string, quantity: number) {
    console.log(
      `Updating item ${itemId} quantity to ${quantity} for user ${keycloakId}`,
    );

    // Find user by keycloakId, create if not exists
    let user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      // Create user with minimal info
      user = await this.prisma.user.create({
        data: {
          keycloakId,
          email: `user-${keycloakId}@temp.com`, // Temporary email
          username: `user-${keycloakId}`,
        },
      });
    }

    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    console.log(`Item found:`, item);
    console.log(`User ID:`, user.id);
    console.log(`Cart User ID:`, item?.cart.userId);

    if (!item) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    if (item.cart.userId !== user.id) {
      throw new NotFoundException(
        `Cart item ${itemId} does not belong to user ${user.id}`,
      );
    }

    if (quantity <= 0) {
      return this.removeFromCart(keycloakId, itemId);
    }

    const updatedItem = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    return updatedItem;
  }

  async checkout(keycloakId: string) {
    // Find user by keycloakId, create if not exists
    let user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      // Create user with minimal info
      user = await this.prisma.user.create({
        data: {
          keycloakId,
          email: `user-${keycloakId}@temp.com`, // Temporary email
          username: `user-${keycloakId}`,
        },
      });
    }

    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Calculate total (simple sum, assuming price is string like "$10.99")
    let subtotal = 0;
    for (const item of cart.items) {
      const price = parseFloat(item.price.replace('$', ''));
      subtotal += price * item.quantity;
    }

    // Add shipping and tax
    const shipping = 8;
    const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10% tax
    const total = subtotal + shipping + tax;

    // Generate tracking number
    const trackingNumber = `TRACK-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Create order with additional fields
    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        total,
        shipping,
        tax,
        trackingNumber,
        shippingAddress: {
          name: user.username || 'Customer',
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          phone: '+1 (415) 555-0123',
        },
        billingAddress: {
          name: user.username || 'Customer',
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
        },
        paymentMethod: {
          brand: 'Visa',
          last4: '4242',
          type: 'Credit Card',
        },
        items: {
          create: cart.items.map((item) => ({
            name: item.name,
            brand: item.brand,
            price: item.price,
            image: item.image,
            url: item.url,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    // Clear cart
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return order;
  }
}
