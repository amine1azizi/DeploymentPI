import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ReminderInput = {
  type: 'morning' | 'evening' | 'special';
  time: string;
  title: string;
  description?: string;
  enabled?: boolean;
  days: string[];
};

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserByKeycloakId(keycloakId: string) {
    if (!keycloakId) {
      throw new BadRequestException('Missing authenticated user id');
    }

    const user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      throw new NotFoundException('User not found in database');
    }

    return user;
  }

  async getMyReminders(keycloakId: string) {
    const user = await this.getUserByKeycloakId(keycloakId);

    const reminders = await this.prisma.reminder.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }],
    });

    return reminders.map((r) => ({
      ...r,
      days: Array.isArray(r.days) ? r.days : [],
    }));
  }

  async createReminder(keycloakId: string, input: ReminderInput) {
    const user = await this.getUserByKeycloakId(keycloakId);

    if (!input.title?.trim()) {
      throw new BadRequestException('Title is required');
    }

    if (!input.time?.trim()) {
      throw new BadRequestException('Time is required');
    }

    if (!Array.isArray(input.days)) {
      throw new BadRequestException('Days must be an array');
    }

    const created = await this.prisma.reminder.create({
      data: {
        userId: user.id,
        type: input.type,
        time: input.time,
        title: input.title.trim(),
        description: input.description?.trim() || '',
        enabled: input.enabled ?? true,
        days: input.days,
      },
    });

    return {
      ...created,
      days: Array.isArray(created.days) ? created.days : [],
    };
  }

  async updateReminder(
    keycloakId: string,
    reminderId: string,
    input: Partial<ReminderInput>,
  ) {
    const user = await this.getUserByKeycloakId(keycloakId);

    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    if (reminder.userId !== user.id) {
      throw new ForbiddenException('You cannot update this reminder');
    }

    const updated = await this.prisma.reminder.update({
      where: { id: reminderId },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.time !== undefined ? { time: input.time } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() }
          : {}),
        ...(input.enabled !== undefined ? { enabled: !!input.enabled } : {}),
        ...(input.days !== undefined ? { days: input.days } : {}),
      },
    });

    return {
      ...updated,
      days: Array.isArray(updated.days) ? updated.days : [],
    };
  }

  async deleteReminder(keycloakId: string, reminderId: string) {
    const user = await this.getUserByKeycloakId(keycloakId);

    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    if (reminder.userId !== user.id) {
      throw new ForbiddenException('You cannot delete this reminder');
    }

    await this.prisma.reminder.delete({
      where: { id: reminderId },
    });

    return { success: true };
  }
}
