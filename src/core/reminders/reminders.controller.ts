import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RemindersService } from './reminders.service';

@Controller('reminders')
@UseGuards(AuthGuard('keycloak-jwt'))
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('me')
  async getMyReminders(@Req() req: any) {
    const keycloakId = req.user?.sub;
    return this.remindersService.getMyReminders(keycloakId);
  }

  @Post()
  async createReminder(@Req() req: any, @Body() body: any) {
    const keycloakId = req.user?.sub;
    return this.remindersService.createReminder(keycloakId, body);
  }

  @Patch(':id')
  async updateReminder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const keycloakId = req.user?.sub;
    return this.remindersService.updateReminder(keycloakId, id, body);
  }

  @Delete(':id')
  async deleteReminder(@Req() req: any, @Param('id') id: string) {
    const keycloakId = req.user?.sub;
    return this.remindersService.deleteReminder(keycloakId, id);
  }
}
