import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    endOfLastMonth.setHours(23, 59, 59, 999);

    const totalUsers = await this.prisma.user.count();

    const activeUsers = await this.prisma.user.count({
      where: {
        analyses: {
          some: {},
        },
      },
    });

    const analysesToday = await this.prisma.analysis.count({
      where: {
        createdAt: {
          gte: startOfToday,
        },
      },
    });

    const premiumUsers = await this.prisma.user.count({
      where: {
        subscriptionTier: {
          in: ['SILVER', 'GOLD', 'PLATINUM'],
        },
      },
    });

    const revenue = premiumUsers * 10;

    const usersThisMonth = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    const usersLastMonth = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    const analysesThisMonth = await this.prisma.analysis.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    const analysesLastMonth = await this.prisma.analysis.count({
      where: {
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    const premiumUsersThisMonth = await this.prisma.user.count({
      where: {
        subscriptionTier: {
          in: ['SILVER', 'GOLD', 'PLATINUM'],
        },
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    const premiumUsersLastMonth = await this.prisma.user.count({
      where: {
        subscriptionTier: {
          in: ['SILVER', 'GOLD', 'PLATINUM'],
        },
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    const recentAnalyses = await this.prisma.analysis.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
      },
    });

    const recentActivity = recentAnalyses.map((analysis) => ({
      id: analysis.id,
      user: analysis.user?.username || analysis.user?.email || 'User',
      action: 'Completed skin analysis',
      time: analysis.createdAt,
      status: 'completed' as const,
    }));

    return {
      stats: {
        totalUsers,
        activeUsers,
        analysesToday,
        revenue,
        totalUsersChange: this.calculateChange(usersThisMonth, usersLastMonth),
        activeUsersChange: this.calculateChange(activeUsers, totalUsers || 1),
        analysesTodayChange: this.calculateChange(
          analysesThisMonth,
          analysesLastMonth,
        ),
        revenueChange: this.calculateChange(
          premiumUsersThisMonth,
          premiumUsersLastMonth,
        ),
      },
      recentActivity,
    };
  }

  private calculateChange(current: number, previous: number): string {
    if (previous <= 0) {
      return current > 0 ? '+100.0%' : '0.0%';
    }

    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? '+' : '';

    return `${sign}${change.toFixed(1)}%`;
  }
}
