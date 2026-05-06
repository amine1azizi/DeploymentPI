import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminEducationService } from './admin-education.service';

@Controller('admin/education')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminEducationController {
  constructor(private readonly adminEducationService: AdminEducationService) {}

  @Get('articles')
  getAllArticles(
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.adminEducationService.getAllArticles(search, category);
  }

  @Get('articles/:id')
  getArticleById(@Param('id') id: string) {
    return this.adminEducationService.getArticleById(id);
  }

  @Post('articles')
  createArticle(
    @Body()
    body: {
      title: string;
      category: string;
      readTime: number;
      rating: number;
      image: string;
      summary: string;
      content: string[];
    },
  ) {
    return this.adminEducationService.createArticle(body);
  }

  @Patch('articles/:id')
  updateArticle(
    @Param('id') id: string,
    @Body()
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
    return this.adminEducationService.updateArticle(id, body);
  }

  @Delete('articles/:id')
  deleteArticle(@Param('id') id: string) {
    return this.adminEducationService.deleteArticle(id);
  }

  @Get('videos')
  getAllVideos(
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.adminEducationService.getAllVideos(search, category);
  }

  @Get('videos/:id')
  getVideoById(@Param('id') id: string) {
    return this.adminEducationService.getVideoById(id);
  }

  @Post('videos')
  createVideo(
    @Body()
    body: {
      title: string;
      duration: string;
      thumbnail: string;
      category: string;
      url: string;
    },
  ) {
    return this.adminEducationService.createVideo(body);
  }

  @Patch('videos/:id')
  updateVideo(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      duration?: string;
      thumbnail?: string;
      category?: string;
      url?: string;
    },
  ) {
    return this.adminEducationService.updateVideo(id, body);
  }

  @Delete('videos/:id')
  deleteVideo(@Param('id') id: string) {
    return this.adminEducationService.deleteVideo(id);
  }
}
