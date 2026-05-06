import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BadgeRarity,
  PointTransactionType,
  RewardType,
  SubscriptionTier,
} from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';

type ActivityType = 'routine' | 'scan' | 'article';

type BadgeSeed = {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  rarity: BadgeRarity;
};

type RewardSeed = {
  id: string;
  title: string;
  description: string;
  points: number;
  type: RewardType;
  image: string;
};

const BADGE_SEED_DATA: BadgeSeed[] = [
  {
    id: '1',
    name: 'Early Bird',
    description: 'Complete 7 morning routines in a row',
    icon: '🌅',
    requirement: '7 day streak',
    rarity: 'common',
  },
  {
    id: '2',
    name: 'Night Owl',
    description: 'Complete 7 evening routines in a row',
    icon: '🌙',
    requirement: '7 day streak',
    rarity: 'common',
  },
  {
    id: '3',
    name: 'Week Warrior',
    description: 'Maintain a 7-day perfect routine streak',
    icon: '⚡',
    requirement: '7 consecutive days',
    rarity: 'rare',
  },
  {
    id: '4',
    name: 'Fortnight Champion',
    description: 'Maintain a 14-day perfect routine streak',
    icon: '🏆',
    requirement: '14 consecutive days',
    rarity: 'epic',
  },
  {
    id: '5',
    name: 'Ingredient Expert',
    description: 'Scan 20 different products',
    icon: '🔬',
    requirement: '20 products scanned',
    rarity: 'rare',
  },
  {
    id: '6',
    name: 'Knowledge Seeker',
    description: 'Read 20 educational articles',
    icon: '📚',
    requirement: '20 articles read',
    rarity: 'rare',
  },
  {
    id: '7',
    name: 'Monthly Master',
    description: 'Complete 30 days of perfect routines',
    icon: '👑',
    requirement: '30 consecutive days',
    rarity: 'legendary',
  },
  {
    id: '8',
    name: 'Skin Scholar',
    description: 'Complete all education hub content',
    icon: '🎓',
    requirement: 'All content completed',
    rarity: 'legendary',
  },
];

const REWARD_SEED_DATA: RewardSeed[] = [
  {
    id: '1',
    title: '10% Off Next Order',
    description: 'Discount code for your next purchase',
    points: 500,
    type: 'discount',
    image:
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&fit=crop',
  },
  {
    id: '2',
    title: 'Free Mini Vitamin C Serum',
    description: 'Redeem a deluxe sample of our bestseller',
    points: 1000,
    type: 'product',
    image:
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=400&fit=crop',
  },
  {
    id: '3',
    title: '15% Off Next Order',
    description: 'Enhanced discount for loyal users',
    points: 1500,
    type: 'discount',
    image:
      'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&h=400&fit=crop',
  },
  {
    id: '4',
    title: 'Exclusive Skincare Guide',
    description: 'Premium PDF guide with advanced tips',
    points: 750,
    type: 'content',
    image:
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=400&fit=crop',
  },
  {
    id: '5',
    title: 'Free Retinol Night Cream',
    description: 'Full-size product (30ml)',
    points: 2500,
    type: 'product',
    image:
      'https://images.unsplash.com/photo-1556228841-a0c1b48d9de2?w=400&h=400&fit=crop',
  },
  {
    id: '6',
    title: 'VIP Early Access',
    description: 'First access to new product launches',
    points: 2000,
    type: 'content',
    image:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop',
  },
];

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRewardsPageData(keycloakId: string) {
    const [overview, badges, shop] = await Promise.all([
      this.getOverview(keycloakId),
      this.getBadges(keycloakId),
      this.getRewardsShop(keycloakId),
    ]);

    return {
      userStats: overview.userStats,
      badges,
      rewards: shop.rewards,
    };
  }

  async getOverview(keycloakId: string) {
    await this.ensureCatalogData();

    const user = await this.getOrCreateUserByKeycloakId(keycloakId);
    this.ensureRewardsAccess(user.subscriptionTier);

    const stats = await this.getOrCreateRewardStats(user.id);
    await this.unlockBadgesForUser(user.id, stats);

    const [unlockedCount, totalBadges, recentUnlockedBadges] = await Promise.all([
      this.prisma.userBadge.count({ where: { userId: user.id } }),
      this.prisma.badgeDefinition.count(),
      this.prisma.userBadge.findMany({
        where: { userId: user.id },
        include: { badge: true },
        orderBy: { unlockedAt: 'desc' },
        take: 4,
      }),
    ]);

    const levelInfo = this.getLevelFromPoints(user.points);

    return {
      userStats: {
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        totalPoints: user.points,
        level: levelInfo.level,
        pointsToNextLevel: levelInfo.pointsToNextLevel,
        routinesCompleted: stats.routinesCompleted,
        productsScanned: stats.productsScanned,
        articlesRead: stats.articlesRead,
      },
      summary: {
        unlockedBadges: unlockedCount,
        totalBadges,
      },
      recentUnlocked: recentUnlockedBadges.map((row) => ({
        id: row.badge.id,
        name: row.badge.name,
        icon: row.badge.icon,
        rarity: row.badge.rarity,
        unlockedAt: row.unlockedAt,
      })),
    };
  }

  async getBadges(keycloakId: string) {
    await this.ensureCatalogData();

    const user = await this.getOrCreateUserByKeycloakId(keycloakId);
    this.ensureRewardsAccess(user.subscriptionTier);

    const stats = await this.getOrCreateRewardStats(user.id);
    await this.unlockBadgesForUser(user.id, stats);

    const [badges, unlockedBadges] = await Promise.all([
      this.prisma.badgeDefinition.findMany({
        orderBy: { id: 'asc' },
      }),
      this.prisma.userBadge.findMany({
        where: { userId: user.id },
      }),
    ]);

    const unlockedByBadgeId = new Map(
      unlockedBadges.map((item) => [item.badgeId, item.unlockedAt]),
    );

    return badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      requirement: badge.requirement,
      rarity: badge.rarity,
      unlocked: unlockedByBadgeId.has(badge.id),
      unlockedAt: unlockedByBadgeId.get(badge.id) ?? null,
    }));
  }

  async getRewardsShop(keycloakId: string) {
    await this.ensureCatalogData();

    const user = await this.getOrCreateUserByKeycloakId(keycloakId);
    this.ensureRewardsAccess(user.subscriptionTier);

    const [rewards, claims] = await Promise.all([
      this.prisma.rewardDefinition.findMany({ orderBy: { points: 'asc' } }),
      this.prisma.rewardClaim.findMany({ where: { userId: user.id } }),
    ]);

    const claimedByRewardId = new Map(
      claims.map((claim) => [claim.rewardId, claim.claimedAt]),
    );

    return {
      totalPoints: user.points,
      rewards: rewards.map((reward) => ({
        id: reward.id,
        title: reward.title,
        description: reward.description,
        points: reward.points,
        type: reward.type,
        image: reward.image,
        claimed: claimedByRewardId.has(reward.id),
        claimedAt: claimedByRewardId.get(reward.id) ?? null,
      })),
    };
  }

  async claimReward(keycloakId: string, rewardId: string) {
    await this.ensureCatalogData();

    const user = await this.getOrCreateUserByKeycloakId(keycloakId);
    this.ensureRewardsAccess(user.subscriptionTier);

    const reward = await this.prisma.rewardDefinition.findUnique({
      where: { id: rewardId },
    });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    const existingClaim = await this.prisma.rewardClaim.findFirst({
      where: {
        userId: user.id,
        rewardId: reward.id,
      },
    });

    if (existingClaim) {
      throw new BadRequestException('Reward already claimed');
    }

    if (user.points < reward.points) {
      throw new BadRequestException('Not enough points');
    }

    const claimCode = this.generateClaimCode(reward.id);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { points: { decrement: reward.points } },
      });

      const claim = await tx.rewardClaim.create({
        data: {
          userId: user.id,
          rewardId: reward.id,
          pointsSpent: reward.points,
          claimCode,
        },
      });

      await tx.pointTransaction.create({
        data: {
          userId: user.id,
          type: PointTransactionType.SPENT,
          amount: reward.points,
          reason: `Reward claim: ${reward.title}`,
          referenceId: claim.id,
        },
      });

      return { updatedUser, claim };
    });

    return {
      message: 'Reward claimed successfully',
      reward: {
        id: reward.id,
        title: reward.title,
        points: reward.points,
      },
      claim: {
        id: result.claim.id,
        claimCode: result.claim.claimCode,
        claimedAt: result.claim.claimedAt,
      },
      remainingPoints: result.updatedUser.points,
    };
  }

  async recordActivity(keycloakId: string, type: ActivityType, count = 1) {
    await this.ensureCatalogData();

    const user = await this.getOrCreateUserByKeycloakId(keycloakId);
    this.ensureRewardsAccess(user.subscriptionTier);

    if (!['routine', 'scan', 'article'].includes(type)) {
      throw new BadRequestException('Invalid activity type');
    }

    if (!Number.isInteger(count) || count <= 0) {
      throw new BadRequestException('count must be a positive integer');
    }

    const statsBefore = await this.getOrCreateRewardStats(user.id);

    const pointsPerType: Record<ActivityType, number> = {
      routine: 50,
      scan: 25,
      article: 15,
    };

    const basePoints = pointsPerType[type] * count;

    const updatedStats = await this.prisma.userRewardStats.update({
      where: { userId: user.id },
      data: {
        routinesCompleted:
          type === 'routine' ? { increment: count } : undefined,
        productsScanned: type === 'scan' ? { increment: count } : undefined,
        articlesRead: type === 'article' ? { increment: count } : undefined,
        currentStreak: type === 'routine' ? { increment: count } : undefined,
        longestStreak:
          type === 'routine'
            ? Math.max(statsBefore.longestStreak, statsBefore.currentStreak + count)
            : undefined,
      },
    });

    let bonusPoints = 0;
    if (type === 'routine') {
      const milestonesBefore = Math.floor(statsBefore.currentStreak / 7);
      const milestonesAfter = Math.floor(updatedStats.currentStreak / 7);
      if (milestonesAfter > milestonesBefore) {
        bonusPoints += (milestonesAfter - milestonesBefore) * 100;
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        points: {
          increment: basePoints + bonusPoints,
        },
      },
    });

    await this.prisma.pointTransaction.create({
      data: {
        userId: user.id,
        type: PointTransactionType.EARNED,
        amount: basePoints + bonusPoints,
        reason: `Activity reward: ${type}`,
      },
    });

    const newlyUnlocked = await this.unlockBadgesForUser(user.id, updatedStats);

    const refreshedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { points: true },
    });

    return {
      message: 'Activity recorded',
      activity: type,
      count,
      pointsEarned: basePoints + bonusPoints,
      bonusPoints,
      totalPoints: refreshedUser?.points ?? 0,
      newlyUnlockedBadges: newlyUnlocked.map((badge) => ({
        id: badge.id,
        name: badge.name,
        icon: badge.icon,
        rarity: badge.rarity,
      })),
    };
  }

  private async ensureCatalogData() {
    await Promise.all(
      BADGE_SEED_DATA.map((badge) =>
        this.prisma.badgeDefinition.upsert({
          where: { id: badge.id },
          update: {
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            requirement: badge.requirement,
            rarity: badge.rarity,
          },
          create: badge,
        }),
      ),
    );

    await Promise.all(
      REWARD_SEED_DATA.map((reward) =>
        this.prisma.rewardDefinition.upsert({
          where: { id: reward.id },
          update: {
            title: reward.title,
            description: reward.description,
            points: reward.points,
            type: reward.type,
            image: reward.image,
          },
          create: reward,
        }),
      ),
    );
  }

  private async getOrCreateUserByKeycloakId(keycloakId: string) {
    if (!keycloakId) {
      throw new BadRequestException('Missing authenticated user id');
    }

    let user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          keycloakId,
          email: `user-${keycloakId}@temp.com`,
          username: `user-${keycloakId}`,
        },
      });
    }

    return user;
  }

  private ensureRewardsAccess(subscriptionTier: SubscriptionTier) {
    if (subscriptionTier !== SubscriptionTier.PLATINUM) {
      throw new ForbiddenException({
        message: 'Rewards feature requires PLATINUM subscription',
        requiredTier: 'PLATINUM',
        currentTier: subscriptionTier,
      });
    }
  }

  private async getOrCreateRewardStats(userId: string) {
    return this.prisma.userRewardStats.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });
  }

  private getLevelFromPoints(points: number) {
    const pointsPerLevel = 600;
    const maxLevel = 10;

    const computedLevel = Math.floor(points / pointsPerLevel) + 1;
    const level = Math.min(computedLevel, maxLevel);

    if (level >= maxLevel) {
      return {
        level,
        pointsToNextLevel: 0,
      };
    }

    const nextLevelThreshold = level * pointsPerLevel;

    return {
      level,
      pointsToNextLevel: Math.max(0, nextLevelThreshold - points),
    };
  }

  private async unlockBadgesForUser(userId: string, stats: any) {
    const allBadges = await this.prisma.badgeDefinition.findMany({
      orderBy: { id: 'asc' },
    });

    const unlocked = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });

    const unlockedIds = new Set(unlocked.map((item) => item.badgeId));
    const toUnlock = allBadges.filter(
      (badge) => !unlockedIds.has(badge.id) && this.isBadgeRequirementMet(badge.id, stats),
    );

    if (toUnlock.length === 0) {
      return [];
    }

    await this.prisma.$transaction(async (tx) => {
      for (const badge of toUnlock) {
        const created = await tx.userBadge.create({
          data: {
            userId,
            badgeId: badge.id,
          },
        });

        await tx.pointTransaction.create({
          data: {
            userId,
            type: PointTransactionType.EARNED,
            amount: 200,
            reason: `Badge unlocked: ${badge.name}`,
            referenceId: created.id,
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          points: {
            increment: toUnlock.length * 200,
          },
        },
      });
    });

    return toUnlock;
  }

  private isBadgeRequirementMet(badgeId: string, stats: any) {
    switch (badgeId) {
      case '1':
      case '2':
      case '3':
        return stats.currentStreak >= 7;
      case '4':
        return stats.currentStreak >= 14;
      case '5':
        return stats.productsScanned >= 20;
      case '6':
        return stats.articlesRead >= 20;
      case '7':
        return stats.currentStreak >= 30;
      case '8':
        return stats.articlesRead >= 50;
      default:
        return false;
    }
  }

  private generateClaimCode(rewardId: string) {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `DS-${rewardId}-${random}`;
  }
}
