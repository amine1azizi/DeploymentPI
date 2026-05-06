import { Module } from '@nestjs/common';
import { AnalysesController } from './analyses.controller';
import { AnalysesService } from './analyses.service';
import { PrismaService } from '../core/prisma/prisma.service';

@Module({
  controllers: [AnalysesController],
  providers: [AnalysesService, PrismaService],
})
export class AnalysesModule {}
