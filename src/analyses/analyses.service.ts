import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class AnalysesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const analyses = await this.prisma.analysis.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    return analyses.map((item) => ({
      id: item.id,
      skinType: item.skinType,
      healthScore: item.healthScore,
      concerns: Array.isArray(item.concerns) ? item.concerns : [],
      createdAt: item.createdAt,
      imageUrl: item.imageUrl,
      status: 'completed',
      user: {
        username: item.user?.username ?? null,
        email: item.user?.email ?? null,
        avatar: null,
      },
    }));
  }

  async exportCsv() {
    const analyses = await this.prisma.analysis.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    const rows = [
      ['ID', 'User', 'Date', 'Skin Type', 'Score', 'Concerns'],
      ...analyses.map((item) => [
        item.id,
        item.user?.username || item.user?.email || 'Unknown User',
        item.createdAt.toISOString(),
        item.skinType,
        String(item.healthScore),
        JSON.stringify(item.concerns),
      ]),
    ];

    return rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
  }
}
