import { SetMetadata } from '@nestjs/common';

/**
 * Key used to store the required roles metadata on route handlers or controllers.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator that assigns required role(s) to a route handler or controller.
 * The attached metadata is later read by `RolesGuard` to determine authorization.
 *
 * @param roles - One or more role identifiers required to access the decorated route.
 * @returns A decorator function that sets the 'roles' metadata.
 *
 * @example
 * // Single role
 * @Roles('admin')
 *
 * // Multiple roles (user needs at least one)
 * @Roles('admin', 'moderator')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
