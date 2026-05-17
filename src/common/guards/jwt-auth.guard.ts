import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT authentication guard that extends Passport's AuthGuard.
 * It checks for the `isPublic` metadata; if a route is marked as public,
 * authentication is bypassed.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Determines if the current request can proceed.
   * If the route or controller is marked with `@Public()`, authentication is skipped.
   * Otherwise, it delegates to the JWT strategy via `super.canActivate()`.
   *
   * @param context - The execution context of the current request.
   * @returns A boolean, Promise, or Observable indicating whether access is granted.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Delegate to the JWT AuthGuard from @nestjs/passport
    return super.canActivate(context);
  }
}
