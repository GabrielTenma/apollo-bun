import { SetMetadata } from '@nestjs/common';

/**
 * Key used to mark a route or controller as publicly accessible.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator that marks a route or controller as publicly accessible,
 * bypassing JWT authentication checks in `JwtAuthGuard`.
 *
 * @returns A decorator function that sets the 'isPublic' metadata to `true`.
 *
 * @example
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return 'OK';
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
