import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { PrismaService } from '../prisma/prisma.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Injectable()
export class ChatbotService {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaService,
  ) {}

  async processMessage(
    userId: string,
    message: string,
    conversationId?: string,
  ) {
    // Get or create conversation
    let conversation = conversationId
      ? await this.prisma.conversation.findFirst({
          where: { id: conversationId, userId },
        })
      : null;

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          messages: [],
        },
      });
    }

    // Parse existing messages
    const messages: Message[] = (conversation.messages as any) || [];

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    messages.push(userMessage);

    // Get user context (latest analysis if available)
    const userContext = await this.getUserContext(userId);

    // Generate AI response
    const aiResponse = await this.generateResponse(
      message,
      messages,
      userContext,
    );

    // Add AI response
    const assistantMessage: Message = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    };
    messages.push(assistantMessage);

    // Update conversation
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messages: messages as any,
        updatedAt: new Date(),
      },
    });

    return {
      conversationId: conversation.id,
      message: assistantMessage,
      userMessage,
    };
  }

  private async generateResponse(
    userMessage: string,
    conversationHistory: Message[],
    userContext: any,
  ): Promise<string> {
    const contextPrompt = this.buildContextPrompt(userContext);
    const historyPrompt = this.buildHistoryPrompt(conversationHistory);

    const systemPrompt = `You are DeepSkyn AI, a skincare assistant.

You MUST use the user's stored skincare questionnaire and latest skin analysis if available.
If allergies, sensitivities, symptoms, affected areas, or medical history are present, you must take them into account in your answer.

If the user's question is about product compatibility, ingredients, irritation, allergy risk, routine suitability, or skin concerns, consult the questionnaire context first before answering.

If the user has listed allergies or sensitivities, mention them explicitly when relevant.
Do not recommend products or ingredients that may conflict with those allergies or sensitivities.

If symptoms may overlap with dermatological or systemic conditions, clearly say that this is not a medical diagnosis and suggest consulting a dermatologist when appropriate.

${contextPrompt}

${historyPrompt}

User's question: "${userMessage}"

Provide a helpful, personalized response about skincare. You can:
- Analyze skin concerns and provide advice
- Recommend skincare routines (morning/evening)
- Answer questions about ingredients and products
- Give general skincare tips
- Suggest when to consult professionals

Keep responses concise but informative. If you don't have specific user data, say so clearly.`;

    return this.geminiService.generateTextResponse(systemPrompt);
  }

  private async getUserContext(userId: string) {
    const latestAnalysis = await this.prisma.analysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const reminders = await this.prisma.reminder.findMany({
      where: { userId },
    });

    const questionnaire = await this.prisma.skinQuestionnaire.findUnique({
      where: { userId },
    });

    return {
      latestAnalysis,
      reminders,
      questionnaire,
    };
  }

  private buildContextPrompt(context: any): string {
    let prompt = '';

    if (context.questionnaire) {
      const q = context.questionnaire;

      prompt += `User's saved skincare questionnaire:
- Skin Type: ${q.skinType || 'Not provided'}
- Sensitivity Level: ${q.sensitivityLevel || 'Not provided'}
- Symptoms: ${Array.isArray(q.symptoms) && q.symptoms.length > 0 ? q.symptoms.join(', ') : 'None provided'}
- Affected Areas: ${Array.isArray(q.affectedAreas) && q.affectedAreas.length > 0 ? q.affectedAreas.join(', ') : 'None provided'}
- Main Concerns: ${Array.isArray(q.concerns) && q.concerns.length > 0 ? q.concerns.join(', ') : 'None provided'}
- Triggers: ${Array.isArray(q.triggers) && q.triggers.length > 0 ? q.triggers.join(', ') : 'None provided'}
- Allergies / Sensitivities: ${q.allergies || 'None provided'}
- Medical History: ${q.medicalHistory || 'None provided'}
- Duration of Issue: ${q.duration || 'Not provided'}
- Severity: ${q.severity || 'Not provided'}
- Current Skincare Routine: ${q.skincareRoutine || 'Not provided'}
- Sunscreen Usage: ${q.sunscreenUsage || 'Not provided'}
- Stress Level: ${q.stressLevel || 'Not provided'}
- Sleep Quality: ${q.sleepQuality || 'Not provided'}
- Water Intake: ${q.waterIntake || 'Not provided'}

`;
    } else {
      prompt += `User questionnaire: No questionnaire data available.

`;
    }

    if (context.latestAnalysis) {
      const analysis = context.latestAnalysis;
      prompt += `User's latest skin analysis:
- Skin Type: ${analysis.skinType}
- Health Score: ${analysis.healthScore}/100
- Skin Age: ${analysis.skinAge}
- Summary: ${analysis.summary}
- Concerns: ${JSON.stringify(analysis.concerns)}
- Morning Routine: ${JSON.stringify(analysis.morningRoutine)}
- Evening Routine: ${JSON.stringify(analysis.eveningRoutine)}

`;
    }

    if (context.reminders && context.reminders.length > 0) {
      prompt += `User's current reminders/routines:
${context.reminders.map((r) => `- ${r.title}: ${r.description} (${r.time})`).join('\n')}

`;
    }

    return prompt || 'No specific user data available yet.';
  }

  private buildHistoryPrompt(history: Message[]): string {
    if (history.length <= 2) return ''; // Skip if only current messages

    const recentHistory = history.slice(-6); // Last 3 exchanges
    return `Recent conversation:
${recentHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n')}

`;
  }
}
