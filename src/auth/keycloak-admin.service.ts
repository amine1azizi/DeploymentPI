// src/auth/keycloak-admin.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import * as dotenv from 'dotenv';

export class KeycloakAdminError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'KeycloakAdminError';
  }
}

// Force le chargement de .env
dotenv.config();

@Injectable()
export class KeycloakAdminService implements OnModuleInit {
  private baseUrl: string;
  private realm: string;
  private clientId: string;
  private clientSecret: string;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private refreshTokenExpiresAt: Date | null = null;

  constructor() {
    this.baseUrl = process.env.KEYCLOAK_URL || 'http://localhost:8085';
    this.realm = process.env.KEYCLOAK_REALM || 'deepskyn';
    this.clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'backend-admin';
    this.clientSecret =
      process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ||
      'SBK07GI51lyrSCbgfnJWOV7Ob2uay3QE';
  }

  async onModuleInit() {
    console.log('=== KeycloakAdminService Initialized ===');
    console.log('KEYCLOAK_URL:', this.baseUrl);
    console.log('KEYCLOAK_REALM:', this.realm);
    console.log('KEYCLOAK_ADMIN_CLIENT_ID:', this.clientId);
    console.log(
      'KEYCLOAK_ADMIN_CLIENT_SECRET:',
      this.clientSecret ? '****' : 'NON DÉFINI',
    );
    console.log('========================================');

    await this.getValidToken();

    setInterval(() => {
      this.checkAndRefreshToken().catch((err) =>
        console.error(
          'Erreur lors de la vérification périodique du token:',
          err,
        ),
      );
    }, 60000);
  }

  private async checkAndRefreshToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt) {
      await this.getValidToken();
      return;
    }

    const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000);
    if (this.tokenExpiresAt < twoMinutesFromNow) {
      console.log('🟡 Token va expirer bientôt, refresh automatique...');
      await this.getValidToken();
    }
  }

  private async getValidToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      this.tokenExpiresAt.getTime() > Date.now() + 30000
    ) {
      console.log("🟢 Token encore valide jusqu'à", this.tokenExpiresAt);
      return this.accessToken;
    }

    if (
      this.refreshToken &&
      this.refreshTokenExpiresAt &&
      this.refreshTokenExpiresAt.getTime() > Date.now()
    ) {
      console.log('🟡 Rafraîchissement du token avec refresh_token...');
      return this.refreshAccessToken();
    }

    console.log("🔴 Obtention d'un nouveau token...");
    return this.getNewToken();
  }

  private async getNewToken(): Promise<string> {
    const tokenUrl = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);

    try {
      const { data } = await axios.post(tokenUrl, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || null;

      const now = Date.now();
      this.tokenExpiresAt = new Date(now + data.expires_in * 1000);
      const refreshExpiresIn = data.refresh_expires_in || 86400;
      this.refreshTokenExpiresAt = new Date(now + refreshExpiresIn * 1000);

      console.log('✅ Nouveau token obtenu, expire à:', this.tokenExpiresAt);
      if (this.refreshToken) {
        console.log(
          '✅ Refresh token obtenu, expire à:',
          this.refreshTokenExpiresAt,
        );
      }

      return this.accessToken!;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          '❌ Erreur obtention token:',
          error.response?.data || error.message,
        );
        throw new Error(
          error.response?.data?.error_description || error.message,
        );
      }
      if (error instanceof Error) throw error;
      throw new Error("Erreur inconnue lors de l'obtention du token");
    }
  }

  private async refreshAccessToken(): Promise<string> {
    const tokenUrl = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);
    body.set('refresh_token', this.refreshToken!);

    try {
      const { data } = await axios.post(tokenUrl, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = data.access_token;
      if (data.refresh_token) this.refreshToken = data.refresh_token;

      const now = Date.now();
      this.tokenExpiresAt = new Date(now + data.expires_in * 1000);

      console.log('🟢 Token rafraîchi, expire à:', this.tokenExpiresAt);
      return this.accessToken!;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          '❌ Erreur refresh token:',
          error.response?.data || error.message,
        );
      } else if (error instanceof Error) {
        console.error('❌ Erreur refresh token:', error.message);
      } else {
        console.error('❌ Erreur refresh token inconnue:', error);
      }

      this.refreshToken = null;
      return this.getNewToken();
    }
  }

  private async executeRequest<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: any,
    retryCount = 0,
  ): Promise<T | { location?: string }> {
    try {
      const token = await this.getValidToken();

      const config: any = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      if (data && (method === 'post' || method === 'put')) {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      }

      const response = await axios(config);

      if (method === 'post' && response.headers.location) {
        return {
          ...response.data,
          location: response.headers.location,
        } as T & { location?: string };
      }

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 && retryCount < 1) {
          console.log('⚠️ Token invalide ou expiré, tentative de refresh...');
          this.accessToken = null;
          this.refreshToken = null;
          return this.executeRequest(method, url, data, retryCount + 1);
        }

        console.error(
          `❌ Erreur lors de la requête ${method.toUpperCase()} ${url}:`,
          error.response?.data || error.message,
        );
        throw new KeycloakAdminError(
          error.response?.data?.error_description || error.message,
          error.response?.status,
          error.response?.data,
        );
      }

      if (error instanceof Error) throw error;
      throw new KeycloakAdminError('Erreur inconnue lors de la requête');
    }
  }

  // ================= MÉTHODES PUBLIQUES =================

  async listUsers(search?: string) {
    const url = `${this.baseUrl}/admin/realms/${this.realm}/users`;
    const finalUrl = search
      ? `${url}?search=${encodeURIComponent(search)}`
      : url;

    console.log('📋 Listing users from:', finalUrl);
    return this.executeRequest<any[]>('get', finalUrl);
  }

  async getUser(userId: string) {
    console.log('🔎 Récupération utilisateur Keycloak:', userId);
    const url = `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}`;

    try {
      const user = await this.executeRequest<any>('get', url);
      console.log('✅ Utilisateur récupéré depuis Keycloak');
      return user;
    } catch (error: unknown) {
      if (error instanceof KeycloakAdminError && error.statusCode === 403) {
        throw new KeycloakAdminError(
          'Accès refusé par Keycloak Admin API (403). Vérifie les rôles du service account client dans realm-management (view-users/manage-users).',
          403,
          error.details,
        );
      }

      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new KeycloakAdminError(
        `Échec de récupération utilisateur: ${message}`,
      );
    }
  }

  async createUser(userData: {
    username: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
  }) {
    console.log('🟡 Tentative de création utilisateur:', {
      username: userData.username,
      email: userData.email,
      hasPassword: !!userData.password,
    });

    const url = `${this.baseUrl}/admin/realms/${this.realm}/users`;

    if (!userData.username) {
      throw new Error("Le nom d'utilisateur est requis");
    }

    const user: any = {
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      enabled: userData.enabled ?? true,
    };

    if (userData.password) {
      user.credentials = [
        {
          type: 'password',
          value: userData.password,
          temporary: false,
        },
      ];
    }

    try {
      const response = await this.executeRequest<any>('post', url, user);
      let userId: string | null = null;

      if (response && response.location) {
        userId = response.location.split('/').pop()!;
      }

      console.log('✅ Utilisateur créé avec succès, ID:', userId);
      return {
        success: true,
        message: 'Utilisateur créé avec succès',
        id: userId,
      };
    } catch (error: unknown) {
      let errorMessage = 'Erreur inconnue';

      if (axios.isAxiosError(error)) {
        errorMessage =
          error.response?.data?.errorMessage ||
          error.response?.data?.error_description ||
          error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      throw new Error(`Échec de la création utilisateur: ${errorMessage}`);
    }
  }

  async setEnabled(userId: string, enabled: boolean) {
    console.log(`🟡 ${enabled ? 'Déblocage' : 'Blocage'} utilisateur:`, userId);

    const url = `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}`;

    try {
      await this.executeRequest('put', url, { enabled });
      console.log(`✅ Utilisateur ${enabled ? 'débloqué' : 'bloqué'}`);
      return {
        success: true,
        message: `Utilisateur ${enabled ? 'débloqué' : 'bloqué'}`,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(`Échec du changement de statut: ${message}`);
    }
  }

  async setPassword(userId: string, password: string) {
    console.log('🟡 Changement mot de passe pour:', userId);

    const url = `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/reset-password`;
    const credentials = {
      type: 'password',
      value: password,
      temporary: false,
    };

    try {
      await this.executeRequest('put', url, credentials);
      console.log('✅ Mot de passe mis à jour');
      return { success: true, message: 'Mot de passe mis à jour' };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(`Échec du changement de mot de passe: ${message}`);
    }
  }

  async deleteUser(userId: string) {
    console.log('🟡 Suppression utilisateur:', userId);
    const url = `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}`;

    try {
      await this.executeRequest('delete', url);
      console.log('✅ Utilisateur supprimé');
      return { success: true, message: 'Utilisateur supprimé' };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(`Échec de la suppression: ${message}`);
    }
  }

  async getCurrentTokenInfo() {
    return {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      accessTokenExpiresAt: this.tokenExpiresAt,
      refreshTokenExpiresAt: this.refreshTokenExpiresAt,
      isValid: this.tokenExpiresAt
        ? this.tokenExpiresAt.getTime() > Date.now()
        : false,
    };
  }

  async updateUser(
    userId: string,
    userData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      username?: string;
      attributes?: Record<string, any>;
    },
  ) {
    console.log('🟡 Mise à jour utilisateur:', {
      userId,
      ...userData,
    });

    const updateData: any = {};

    if (userData.firstName !== undefined) {
      updateData.firstName = userData.firstName;
    }
    if (userData.lastName !== undefined) {
      updateData.lastName = userData.lastName;
    }
    if (userData.email !== undefined) {
      updateData.email = userData.email;
    }
    if (userData.username !== undefined) {
      updateData.username = userData.username;
    }
    if (userData.attributes !== undefined) {
      updateData.attributes = userData.attributes;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('Aucune donnée à mettre à jour');
    }

    try {
      const token = await this.getValidToken();
      const url = `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}`;
      console.log('📦 Données de mise à jour:', updateData);

      await axios.put(url, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Utilisateur mis à jour avec succès');
      return {
        success: true,
        message: 'Utilisateur mis à jour avec succès',
      };
    } catch (error: unknown) {
      let message = 'Erreur inconnue';

      if (axios.isAxiosError(error)) {
        message =
          error.response?.data?.errorMessage ||
          error.response?.data?.error_description ||
          error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }

      throw new Error(`Échec de la mise à jour: ${message}`);
    }
  }
  async verifyUserPassword(login: string, password: string): Promise<boolean> {
    const tokenUrl = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams();
    body.set('grant_type', 'password');
    body.set(
      'client_id',
      process.env.KEYCLOAK_FRONT_CLIENT_ID || 'frontend-client',
    );

    const clientSecret = process.env.KEYCLOAK_FRONT_CLIENT_SECRET;
    if (clientSecret && clientSecret.trim() !== '') {
      body.set('client_secret', clientSecret);
    }

    body.set('username', login);
    body.set('password', password);

    try {
      const { data } = await axios.post(tokenUrl, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      console.log('✅ verifyUserPassword success for:', login);
      return !!data?.access_token;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          '❌ verifyUserPassword failed:',
          error.response?.data || error.message,
        );
      } else {
        console.error('❌ verifyUserPassword failed:', error);
      }
      return false;
    }
  }
}
