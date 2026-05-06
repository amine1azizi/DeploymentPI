import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class EducationService {
  constructor(private prisma: PrismaService) {}

  async getArticles(category?: string, search?: string) {
    return this.prisma.article.findMany({
      where: {
        AND: [
          category && category !== 'all' ? { category } : {},
          search
            ? {
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  { summary: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVideos() {
    return this.prisma.video.findMany();
  }
}
