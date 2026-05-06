import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(
  Strategy,
  'keycloak-jwt',
) {
  constructor() {
    const realm = process.env.KEYCLOAK_REALM;
  const baseUrl = process.env.KEYCLOAK_URL;
    console.log('✅ KeycloakJwtStrategy loaded', { realm, baseUrl }); // <-- AJOUT

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      issuer: `${baseUrl}/realms/${realm}`,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${baseUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
    });
  }

  async validate(payload: any) {
    return payload; // req.user = payload
  }
}
