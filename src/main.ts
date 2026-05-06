import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Configuration CORS complète
    app.enableCors({
      origin: ['http://localhost:5173', 'http://localhost:3000'], // Plusieurs origines
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Range', 'X-Total-Count'],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });

    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    console.log('✅ Backend démarré avec succès');
    console.log(`📡 URL: http://localhost:${port}`);
    console.log(`🔓 CORS activé pour: http://localhost:5173`);
  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
}

bootstrap();
