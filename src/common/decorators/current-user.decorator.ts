import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user object from the incoming HTTP request.
 * Relies on a preceding Passport/JWT guard having attached the user to `request.user`.
 * @param _data - Unused parameter, included to match the `createParamDecorator` signature.
 * @param ctx - The NestJS execution context providing access to the HTTP request.
 * @returns The user object stored on the request, or `undefined` if not present.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    return request.user;
  },
);
