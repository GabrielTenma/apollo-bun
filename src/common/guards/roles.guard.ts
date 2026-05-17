import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard that enforces role-based access control (RBAC).
 * It reads the required roles set by the `@Roles()` decorator and checks
 * if the authenticated user possesses at least one of them.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Determines if the current user is authorized to access the route.
   * If no roles are defined via `@Roles()`, access is granted.
   * Otherwise, the user must have at least one of the required roles.
   *
   * @param context - The execution context of the current request.
   * @returns `true` if access is allowed, `false` otherwise.
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { roles?: string[] } }>();
    const user = request.user;

    // If there is no user (should not happen if JwtAuthGuard ran first), deny access
    if (!user || !user.roles) {
      return false;
    }

    return requiredRoles.some((role) => user.roles!.includes(role));
  }
}
