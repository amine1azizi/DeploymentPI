import { Module } from '@nestjs/common';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ScannerController],
  providers: [ScannerService, PrismaService],
})
export class ScannerModule {}
