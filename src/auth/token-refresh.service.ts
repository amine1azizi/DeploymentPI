// src/auth/token-refresh.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TokenRefreshService {
  private refreshTokens: Map<
    string,
    {
      refreshToken: string;
      accessToken: string;
      expiresAt: Date;
      userId: string;
    }
  > = new Map();

  constructor() {
    // Nettoyer les tokens expirés toutes les heures
    setInterval(() => this.cleanExpiredTokens(), 3600000);
  }

  // Stocker un refresh token après login
  storeRefreshToken(
    userId: string,
    refreshToken: string,
    accessToken: string,
    expiresIn: number,
  ) {
    this.refreshTokens.set(refreshToken, {
      refreshToken,
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      userId,
    });
  }

  // Rafraîchir un token
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenData = this.refreshTokens.get(refreshToken);

    if (!tokenData) {
      throw new Error('Refresh token invalide');
    }

    if (tokenData.expiresAt < new Date()) {
      this.refreshTokens.delete(refreshToken);
      throw new Error('Refresh token expiré');
    }

    try {
      const response = await axios.post(
        `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: 'backend', // ou votre client_id
          client_secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
          refresh_token: refreshToken,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const { access_token, refresh_token, expires_in } = response.data;

      // Mettre à jour le stockage
      this.refreshTokens.delete(refreshToken);
      this.refreshTokens.set(refresh_token, {
        refreshToken: refresh_token,
        accessToken: access_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        userId: tokenData.userId,
      });

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
      };
    } catch (error) {
      this.refreshTokens.delete(refreshToken);
      throw new Error('Échec du rafraîchissement du token');
    }
  }

  // Vérifier si un token est valide
  isValidToken(accessToken: string): boolean {
    for (const [_, data] of this.refreshTokens) {
      if (data.accessToken === accessToken) {
        return data.expiresAt > new Date();
      }
    }
    return false;
  }

  // Nettoyer les tokens expirés
  private cleanExpiredTokens() {
    const now = new Date();
    for (const [key, value] of this.refreshTokens.entries()) {
      if (value.expiresAt < now) {
        this.refreshTokens.delete(key);
      }
    }
  }

  // Supprimer un token (logout)
  revokeToken(refreshToken: string) {
    this.refreshTokens.delete(refreshToken);
  }
}
