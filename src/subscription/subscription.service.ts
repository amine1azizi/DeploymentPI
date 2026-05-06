// src/subscription/subscription.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { SubscriptionTier } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async upgradeTier(userId: string, tier: SubscriptionTier) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: tier },
    });
  }
}
