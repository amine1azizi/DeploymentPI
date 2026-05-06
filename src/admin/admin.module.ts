import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { KeycloakAdminService } from '../auth/keycloak-admin.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminEducationController } from './admin-education.controller';
import { AdminEducationService } from './admin-education.service';

@Module({
  controllers: [
    AdminController,
    AdminDashboardController,
    AdminEducationController,
  ],
  providers: [
    KeycloakAdminService,
    AdminDashboardService,
    AdminEducationService,
  ],
})
export class AdminModule {}
