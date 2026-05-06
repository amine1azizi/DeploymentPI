import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AnalysesService } from './analyses.service';

@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Get()
  async findAll() {
    return this.analysesService.findAll();
  }

  @Get('export')
  async exportCsv(@Res() res: Response) {
    const csv = await this.analysesService.exportCsv();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="skin-analyses.csv"',
    );

    res.send(csv);
  }
}
