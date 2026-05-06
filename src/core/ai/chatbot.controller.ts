import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatbotService } from './chatbot.service (1)';
import { PrismaService } from '../prisma/prisma.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('message')
  @UseGuards(AuthGuard('keycloak-jwt'))
  async sendMessage(
    @Body() body: { message: string; conversationId?: string },
    @Req() req: any,
  ): Promise<any> {
    const { message, conversationId } = body;

    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
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

    return this.chatbotService.processMessage(user.id, message, conversationId);
  }

  @Get('conversations')
  @UseGuards(AuthGuard('keycloak-jwt'))
  async getConversations(@Req() req: any) {
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

    return this.prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        messages: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  @Get('conversation/:id')
  @UseGuards(AuthGuard('keycloak-jwt'))
  async getConversation(@Req() req: any, @Param('id') conversationId: string) {
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

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    return conversation;
  }
}
