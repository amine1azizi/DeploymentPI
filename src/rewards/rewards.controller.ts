import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  async getRewardsPageData(@Req() req: any) {
    const keycloakId = req.user?.sub;
    return this.rewardsService.getRewardsPageData(keycloakId);
  }

  @Get('overview')
  async getOverview(@Req() req: any) {
    const keycloakId = req.user?.sub;
    return this.rewardsService.getOverview(keycloakId);
  }

  @Get('badges')
  async getBadges(@Req() req: any) {
    const keycloakId = req.user?.sub;
    return this.rewardsService.getBadges(keycloakId);
  }

  @Get('shop')
  async getRewardsShop(@Req() req: any) {
    const keycloakId = req.user?.sub;
    return this.rewardsService.getRewardsShop(keycloakId);
  }

  @Post('claim/:rewardId')
  async claimReward(@Req() req: any, @Param('rewardId') rewardId: string) {
    const keycloakId = req.user?.sub;
    return this.rewardsService.claimReward(keycloakId, rewardId);
  }

  @Post('activity')
  async recordActivity(
    @Req() req: any,
    @Body('type') type: 'routine' | 'scan' | 'article',
    @Body('count') count?: number,
  ) {
    const keycloakId = req.user?.sub;
    return this.rewardsService.recordActivity(keycloakId, type, count);
  }
}
