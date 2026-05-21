// src/middleware/auth.guard.ts
// Reusable JWT auth guard for Elysia.
// Reads the access token from the `Authorization: Bearer <token>` header,
// verifies it with `jose/jwtVerify`, and attaches the decoded payload to
// `context.authPayload` so protected route handlers can read it without
// repeating decode logic.
//
// Routes opt in via `.use(authGuard)`.

import { Elysia } from 'elysia';
import { jwtVerify } from 'jose';
import type { JwtPayload }    from '../../auth/strategies/jwt.strategy.ts';
import type { ElysiaInstance } from 'elysia';

export interface AuthGuardContext {
  /**
   * Decoded JWT payload.  `undefined` when no token is present, the token
   * is malformed, or the verification fails.
   * Protected routes check `authPayload?.sub` and return 401 when it is missing.
   */
  authPayload?: JwtPayload;
}

const JWT_SECRET_FALLBACK = '';   // default — overridden by env at init time
let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (!_secret) {
    _secret = new TextEncoder().encode(
      // Bun.env is guaranteed to exist in a Bun runtime; fall back to empty string
      // so we never throw — handlers decide how to respond to an invalid token.
      (globalThis as any)?.Bun?.env?.JWT_SECRET ?? JWT_SECRET_FALLBACK,
    );
  }
  return _secret;
}

/** Extract the raw Bearer token from the `Authorization` header. */
function extractToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const parts  = header.split(' ');
  if (parts.length !== 2) return null;
  return parts[0] === 'Bearer' ? parts[1] : null;
}

/**
 * Elysia derive handler — runs before every downstream handler in scope.
 *
 * Calling order:
 *   1. Read the raw token from the request head.
 *   2. Verify it with jose/jwtVerify synchronously or await it asynchronously.
 *   3. Attach the decoded payload (or undefined) to context.authPayload.
 */
export const authGuard = new Elysia<AuthGuardContext>({ name: 'authGuard' })
  .derive(async ({ request }) => {
    const token = extractToken(request);
    if (!token) return { authPayload: undefined };

    try {
      const { payload } = await jwtVerify(token, getSecret());
      return {
        authPayload: payload as JwtPayload,
      };
    } catch {
      return { authPayload: undefined };
    }
  });
