import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { GeminiService } from './gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('ai')
export class GeminiController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('analyze')
  @UseGuards(AuthGuard('keycloak-jwt'))
  @UseInterceptors(FileInterceptor('image'))
  async analyze(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    console.log('--- /ai/analyze called ---');

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.buffer) {
      throw new BadRequestException('Uploaded file buffer is missing');
    }

    const keycloakId = req.user?.sub;

    if (!keycloakId) {
      throw new BadRequestException('Authenticated user not found in token');
    }

    const user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      throw new BadRequestException('User not found in database');
    }

    console.log('User found:', user.id);

    // Analyze first so quota/rate-limit failures do not upload useless files
    const result = await this.geminiService.analyzeImage(
      file.buffer,
      file.mimetype,
    );

    if (
      !result ||
      !result.skinType ||
      result.healthScore === undefined ||
      result.skinAge === undefined
    ) {
      throw new BadRequestException('Invalid AI analysis result');
    }

    const uploadedImage = await this.cloudinaryService.uploadFile(file);
    console.log('Uploaded to Cloudinary:', uploadedImage.secure_url);

    const savedAnalysis = await this.prisma.analysis.create({
      data: {
        userId: user.id,
        skinType: result.skinType,
        healthScore: result.healthScore,
        skinAge: result.skinAge,
        summary: result.summary,
        concerns: result.concerns,
        morningRoutine: result.morningRoutine,
        eveningRoutine: result.eveningRoutine,
        imageUrl: uploadedImage.secure_url,
      },
    });

    console.log('Analysis saved successfully:', savedAnalysis.id);

    return {
      success: true,
      data: {
        ...result,
        imageUrl: uploadedImage.secure_url,
        savedAnalysisId: savedAnalysis.id,
      },
    };
  }

  @Get('my-latest-analysis')
  @UseGuards(AuthGuard('keycloak-jwt'))
  async getMyLatestAnalysis(@Req() req: any) {
    const keycloakId = req.user?.sub;

    if (!keycloakId) {
      throw new BadRequestException('Authenticated user not found in token');
    }

    const user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      throw new BadRequestException('User not found in database');
    }

    const latestAnalysis = await this.prisma.analysis.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestAnalysis) {
      return {
        message: 'No analysis found for this user',
        data: null,
      };
    }

    return {
      success: true,
      data: latestAnalysis,
    };
  }
}
