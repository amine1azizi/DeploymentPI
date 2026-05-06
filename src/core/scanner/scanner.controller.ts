import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ScannerService } from './scanner.service';
import { Multer } from 'multer';

@Controller('scanner')
@UseGuards(JwtAuthGuard)
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Post('analyze-product')
  async analyzeProduct(@Req() req: any, @Body('query') query: string) {
    const keycloakId = req.user?.sub;
    return this.scannerService.analyzeProductForUser(keycloakId, query);
  }

  @Post('analyze-product-image')
  @UseInterceptors(FileInterceptor('image'))
  async analyzeProductImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const keycloakId = req.user?.sub;

    if (!file) {
      throw new BadRequestException('No product image uploaded');
    }

    return this.scannerService.analyzeProductImageForUser(
      keycloakId,
      file.buffer,
      file.mimetype,
    );
  }
}
