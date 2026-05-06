import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    // si pas de roles requis => OK
    if (requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user; // payload JWT (Keycloak)

    const userRoles: string[] = user?.realm_access?.roles || [];

    const hasRole = requiredRoles.some((r) => userRoles.includes(r));
    if (!hasRole) throw new ForbiddenException('Forbidden: missing role');

    return true;
  }
}
