import { Controller, Get, Query } from '@nestjs/common';
import { EducationService } from './education.service';

@Controller('education')
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  @Get('articles')
  getArticles(
    @Query('category') category: string,
    @Query('search') search: string,
  ) {
    return this.educationService.getArticles(category, search);
  }

  @Get('videos')
  getVideos() {
    return this.educationService.getVideos();
  }
}
