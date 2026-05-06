import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { KeycloakJwtStrategy } from './keycloak-jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'keycloak-jwt' })],
  providers: [
    KeycloakJwtStrategy,
    RolesGuard, // ✅ AJOUT IMPORTANT
  ],
  exports: [
    PassportModule,
    RolesGuard, // ✅ pour pouvoir l'utiliser ailleurs
  ],
})
export class AuthModule {}
