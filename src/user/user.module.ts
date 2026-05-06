import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { CloudinaryService } from 'src/core/cloudinary/cloudinary.service';
import { GeminiService } from 'src/core/ai/gemini.service';
import { KeycloakAdminService } from 'src/auth/keycloak-admin.service';

@Module({
  imports: [PrismaModule],
  providers: [
    UserService,
    CloudinaryService,
    GeminiService,
    KeycloakAdminService,
  ],
  controllers: [UserController],
})
export class UserModule {}
