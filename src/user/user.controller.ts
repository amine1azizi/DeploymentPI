import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionTier } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { GeminiService } from '../core/ai/gemini.service';
import { CloudinaryService } from '../core/cloudinary/cloudinary.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(AuthGuard('keycloak-jwt'))
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  @Get('test')
  test(@Req() req: any) {
    return req.user;
  }

  @Post('sync-me')
  async syncMe(@Req() req: any) {
    const { sub, email, preferred_username } = req.user;

    return this.userService.upsertFromKeycloak({
      keycloakId: sub,
      email,
      username: preferred_username ?? email,
    });
  }

  @Get('me')
  async getMe(@Req() req: any) {
    return this.userService.getMeMergedByKeycloakId(req.user?.sub);
  }

  @Patch('me')
  async updateMe(
    @Req() req: any,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
    @Body('email') email?: string,
    @Body('username') username?: string,
    @Body('phone') phone?: string,
    @Body('birthday') birthday?: string,
    @Body('address') address?: string,
  ) {
    return this.userService.updateMeByKeycloakId(req.user?.sub, {
      firstName,
      lastName,
      email,
      username,
      phone,
      birthday,
      address,
    });
  }

  @Patch('subscription')
  async updateMySubscription(@Req() req: any, @Body('tier') tier: string) {
    const keycloakId = req.user?.sub;

    return this.userService.updateSubscriptionByKeycloakId(keycloakId, tier);
  }

  @Post('upload-analysis')
  @UseInterceptors(FilesInterceptor('files', 5))
  async uploadAndAnalyze(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const keycloakId = req.user?.sub;

    if (!keycloakId) {
      throw new BadRequestException('Authenticated user not found in token');
    }

    const user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      throw new NotFoundException('User not found in the database.');
    }

    const limit = this.userService.getImageLimit(user.subscriptionTier);

    if (files.length > limit) {
      throw new BadRequestException(
        `Your ${user.subscriptionTier} plan only allows up to ${limit} photos.`,
      );
    }

    const cloudinaryRes = await this.cloudinaryService.uploadFile(files[0]);

    const aiResult = await this.geminiService.analyzeImage(
      files[0].buffer,
      files[0].mimetype,
    );

    const savedAnalysis = await this.prisma.analysis.create({
      data: {
        userId: user.id,
        skinType: aiResult.skinType,
        healthScore: aiResult.healthScore,
        skinAge: aiResult.skinAge,
        summary: aiResult.summary,
        concerns: aiResult.concerns,
        morningRoutine: aiResult.morningRoutine,
        eveningRoutine: aiResult.eveningRoutine,
        imageUrl: cloudinaryRes.secure_url,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        points: { increment: 50 },
      },
    });

    return {
      message: 'Analysis complete',
      analysisId: savedAnalysis.id,
      result: aiResult,
      imageUrl: cloudinaryRes.secure_url,
    };
  }

  @Get('progress-history')
  async getProgressHistory(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { keycloakId: req.user.sub },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found. Please sync.');
    }

    return user.analyses.map((item) => ({
      id: item.id,
      date: new Date(item.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      time: new Date(item.createdAt).getHours() < 12 ? 'morning' : 'evening',
      imageUrl: item.imageUrl,
      concerns: Array.isArray(item.concerns)
        ? (item.concerns as any[]).map((c) => c.label)
        : [],
      notes: item.summary,
    }));
  }

  @Get('dashboard-stats')
  async getDashboardStats(@Req() req: any) {
    const keycloakId = req.user.sub;

    const user = await this.prisma.user.findUnique({
      where: { keycloakId },
      include: {
        analyses: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found. Please sync.');
    }

    const totalAnalyses = user.analyses.length;

    if (totalAnalyses === 0) {
      return {
        firstName: req.user.given_name || user.username || 'User',
        improvementPercentage: 0,
        currentScore: 0,
        previousScore: 0,
        metrics: [
          {
            label: 'Hydration Level',
            value: 'N/A',
            trend: '0%',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
          },
          {
            label: 'Skin Age',
            value: 'N/A',
            trend: '0%',
            color: 'text-green-600',
            bgColor: 'bg-green-50',
          },
          {
            label: 'Overall Health',
            value: 'N/A',
            trend: '0%',
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
          },
        ],
        chartData: [],
        comparison: {
          before: null,
          after: null,
          beforeDate: 'N/A',
          afterDate: 'N/A',
        },
      };
    }

    const first = user.analyses[0];
    const latest = user.analyses[totalAnalyses - 1];

    const currentScore = latest.healthScore;
    const previousScore = first.healthScore;

    const improvement =
      previousScore > 0
        ? (((currentScore - previousScore) / previousScore) * 100).toFixed(1)
        : '0';

    return {
      firstName: req.user.given_name || user.username || 'User',
      improvementPercentage: improvement,
      currentScore,
      previousScore,
      metrics: [
        {
          label: 'Hydration Level',
          value: latest.skinType?.includes('Dry') ? '32%' : '78%',
          trend: '+5%',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
        },
        {
          label: 'Skin Age',
          value: `${latest.skinAge} yrs`,
          trend: '-2 yrs',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
        },
        {
          label: 'Overall Health',
          value: currentScore > 80 ? 'Excellent' : 'Good',
          trend: '+12%',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
        },
      ],
      chartData: user.analyses.slice(-6).map((a) => ({
        month: new Date(a.createdAt).toLocaleDateString('en-US', {
          month: 'short',
        }),
        score: a.healthScore,
      })),
      comparison: {
        before: first.imageUrl,
        after: latest.imageUrl,
        beforeDate: new Date(first.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        afterDate: new Date(latest.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      },
    };
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body('email') email: string,
    @Body('role') role: 'USER' | 'ADMIN' = 'USER',
  ) {
    return this.userService.create(email, role);
  }

  @Patch(':id/subscription')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async upgradeSubscription(
    @Param('id') id: string,
    @Body('newTier') newTier: SubscriptionTier,
  ) {
    return this.userService.upgradeSubscription(id, newTier);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async deleteById(@Param('id') id: string) {
    return this.userService.deleteById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body('email') email?: string,
    @Body('role') role?: 'USER' | 'ADMIN',
    @Body('subscriptionTier')
    subscriptionTier?: SubscriptionTier,
  ) {
    return this.userService.update(id, email, role, subscriptionTier);
  }
  @Patch('me/password')
  async changeMyPassword(
    @Req() req: any,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
    @Body('confirmPassword') confirmPassword: string,
  ) {
    return this.userService.changePasswordByKeycloakId(req.user?.sub, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  }
  @Post('questionnaire')
  async saveMyQuestionnaire(
    @Req() req: any,
    @Body('skinType') skinType: string,
    @Body('sensitivityLevel') sensitivityLevel: string,
    @Body('symptoms') symptoms: string[],
    @Body('affectedAreas') affectedAreas: string[],
    @Body('concerns') concerns: string[],
    @Body('triggers') triggers: string[],
    @Body('allergies') allergies?: string,
    @Body('medicalHistory') medicalHistory?: string,
    @Body('duration') duration?: string,
    @Body('severity') severity?: string,
    @Body('skincareRoutine') skincareRoutine?: string,
    @Body('sunscreenUsage') sunscreenUsage?: string,
    @Body('stressLevel') stressLevel?: string,
    @Body('sleepQuality') sleepQuality?: string,
    @Body('waterIntake') waterIntake?: string,
  ) {
    console.log('QUESTIONNAIRE SAVE req.user:', req.user);
    console.log('QUESTIONNAIRE SAVE body:', {
      skinType,
      sensitivityLevel,
      symptoms,
      affectedAreas,
      concerns,
      triggers,
      allergies,
      medicalHistory,
      duration,
      severity,
      skincareRoutine,
      sunscreenUsage,
      stressLevel,
      sleepQuality,
      waterIntake,
    });

    return this.userService.saveQuestionnaireByKeycloakId(req.user?.sub, {
      skinType,
      sensitivityLevel,
      symptoms,
      affectedAreas,
      concerns,
      triggers,
      allergies,
      medicalHistory,
      duration,
      severity,
      skincareRoutine,
      sunscreenUsage,
      stressLevel,
      sleepQuality,
      waterIntake,
    });
  }

  @Get('questionnaire/me')
  async getMyQuestionnaire(@Req() req: any) {
    return this.userService.getQuestionnaireByKeycloakId(req.user?.sub);
  }
}
