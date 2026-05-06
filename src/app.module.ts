import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { ProductsModule } from './core/products/products.module';
import { RemindersModule } from './core/reminders/reminders.module';
import { GeminiController } from './core/ai/gemini.controller';
import { GeminiService } from './core/ai/gemini.service';
import { CloudinaryModule } from './core/cloudinary/cloudinary.module';
import { EducationController } from './education/education.controller';
import { EducationService } from './education/education.service';
import { scan } from 'rxjs';
import { ScannerModule } from './core/scanner/scanner.module';
import { AnalysesModule } from './analyses/analyses.module';
import { ChatbotController } from './core/ai/chatbot.controller';
import { ChatbotService } from './core/ai/chatbot.service (1)';
import { OrdersModule } from './core/orders/orders.module';
import { CartModule } from './core/cart/cart.module';
import { RewardsModule } from './rewards/rewards.module';

@Module({
  exports: [GeminiService],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    AdminModule,
    SubscriptionModule,
    RemindersModule,
    ProductsModule,
    CloudinaryModule,
    ScannerModule,
    AnalysesModule,
    OrdersModule,
    CartModule,
    RewardsModule,
  ],
  controllers: [
    AppController,
    GeminiController,
    EducationController,
    ChatbotController,
  ],
  providers: [AppService, GeminiService, EducationService, ChatbotService],
})
export class AppModule {}
