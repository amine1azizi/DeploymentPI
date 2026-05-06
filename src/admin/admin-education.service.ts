import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class AdminEducationService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllArticles(search?: string, category?: string) {
    return this.prisma.article.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  { summary: { contains: search, mode: 'insensitive' } },
                  { category: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
          category && category !== 'all'
            ? { category: { equals: category, mode: 'insensitive' } }
            : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getArticleById(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async createArticle(body: {
    title: string;
    category: string;
    readTime: number;
    rating: number;
    image: string;
    summary: string;
    content: string[];
  }) {
    if (!body.title || !body.category || !body.summary || !body.image) {
      throw new BadRequestException('Missing required article fields');
    }

    if (!Array.isArray(body.content)) {
      throw new BadRequestException('Content must be an array of paragraphs');
    }

    return this.prisma.article.create({
      data: {
        title: body.title,
        category: body.category,
        readTime: Number(body.readTime) || 1,
        rating: Number(body.rating) || 0,
        image: body.image,
        summary: body.summary,
        content: body.content,
      },
    });
  }

  async updateArticle(
    id: string,
    body: {
      title?: string;
      category?: string;
      readTime?: number;
      rating?: number;
      image?: string;
      summary?: string;
      content?: string[];
    },
  ) {
    const existing = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (body.content && !Array.isArray(body.content)) {
      throw new BadRequestException('Content must be an array of paragraphs');
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.readTime !== undefined
          ? { readTime: Number(body.readTime) }
          : {}),
        ...(body.rating !== undefined ? { rating: Number(body.rating) } : {}),
        ...(body.image !== undefined ? { image: body.image } : {}),
        ...(body.summary !== undefined ? { summary: body.summary } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
      },
    });
  }

  async deleteArticle(id: string) {
    const existing = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    return this.prisma.article.delete({
      where: { id },
    });
  }

  async getAllVideos(search?: string, category?: string) {
    return this.prisma.video.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  { category: { contains: search, mode: 'insensitive' } },
                  { duration: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
          category && category !== 'all'
            ? { category: { equals: category, mode: 'insensitive' } }
            : {},
        ],
      },
      orderBy: { title: 'asc' },
    });
  }

  async getVideoById(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return video;
  }

  async createVideo(body: {
    title: string;
    duration: string;
    thumbnail: string;
    category: string;
    url: string;
  }) {
    if (
      !body.title ||
      !body.duration ||
      !body.thumbnail ||
      !body.category ||
      !body.url
    ) {
      throw new BadRequestException('Missing required video fields');
    }

    return this.prisma.video.create({
      data: {
        title: body.title,
        duration: body.duration,
        thumbnail: body.thumbnail,
        category: body.category,
        url: body.url,
      },
    });
  }

  async updateVideo(
    id: string,
    body: {
      title?: string;
      duration?: string;
      thumbnail?: string;
      category?: string;
      url?: string;
    },
  ) {
    const existing = await this.prisma.video.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Video not found');
    }

    return this.prisma.video.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.duration !== undefined ? { duration: body.duration } : {}),
        ...(body.thumbnail !== undefined ? { thumbnail: body.thumbnail } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.url !== undefined ? { url: body.url } : {}),
      },
    });
  }

  async deleteVideo(id: string) {
    const existing = await this.prisma.video.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Video not found');
    }

    return this.prisma.video.delete({
      where: { id },
    });
  }
}
