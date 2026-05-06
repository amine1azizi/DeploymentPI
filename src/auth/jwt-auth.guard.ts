import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('keycloak-jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      console.log('❌ JWT rejected', { err, info }); // <-- SUPER IMPORTANT
      throw err || new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}
