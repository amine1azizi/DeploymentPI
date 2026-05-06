import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('upgrade')
  async upgrade(@Req() req: any, @Body('tier') tier: SubscriptionTier) {
    // In Keycloak, the unique user ID is in req.user.sub
    const userId = req.user.sub;

    return this.subscriptionService.upgradeTier(userId, tier);
  }
}
