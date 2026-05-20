# JWT Authentication Guide

## Overview

Apollo uses [@elysiajs/jwt](https://elysiajs.com/authentications/jwt.html) for JWT-based authentication. The system includes:
- **Elysia JWT plugin** — registers `jwt` in the request context
- **Access + refresh token pair** — signed with `jose`'s `SignJWT`; refresh token stored in an HTTP-only cookie
- **Session management** — refresh token hashes stored in PostgreSQL (`user_sessions` table) with revocation and expiration tracking
- **Role-based access control** — roles are embedded in the JWT payload; route handlers enforce them

**Key Files:**
- `src/server.ts` — JWT plugin registration and all auth route handlers
- `src/lib/services/auth.service.ts` — `createUser`, `login`, `refreshTokens`, token payload builders
- `src/auth/strategies/jwt.strategy.ts` — `JwtPayload` TypeScript interface (strategy/decorator layer removed)
- `src/config/env.ts` — `env.string()` / `env.number()` / `env.bool()` `.env` helpers
- `src/supabase/entities/user.entity.ts` — `UserEntity` (TypeORM)
- `src/supabase/entities/user-session.entity.ts` — `UserSessionEntity` (TypeORM)

---

## 1. How JWT Works in Elysia

### JWT Plugin Registration

`src/server.ts` registers the `@elysiajs/jwt` plugin once at the top of the app:

```typescript
import { jwt } from '@elysiajs/jwt';
import { env } from './config/index.ts';

app
  .use(jwt({
    name: 'jwt',
    secret: env.string('JWT_SECRET') ?? '',
  }));
```

This injects `jwt` into every route handler's context: `async ({ jwt, body, set, cookie }) => { ... }`.

### JwtPayload Interface

`src/auth/strategies/jwt.strategy.ts` defines the plain shape — no Passport decorator needed:

```typescript
export interface JwtPayload {
  sub: string;          // user UUID
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}
```

---

## 2. Auth Routes

All auth routes are defined directly in the `app` chain in `src/server.ts` under `/api/v1/auth/*`.

### `POST /api/v1/auth/create-user`

Creates a new user. Requires a `creationKey` that must match `JWT_SECRET_CREATION` from `.env`.

```bash
curl -X POST http://localhost:3000/api/v1/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret123","role":"admin","creationKey":"019e26c5-2c8f-7634-8e5e-fde8c15c2cbf"}'
```

**Response:**
```json
{"success": true}
```

### `POST /api/v1/auth/login`

Validates email/password against the `users` table, issues an access token in the response body and a refresh token as an HTTP-only cookie.

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret123"}' \
  -c cookies.txt    # save cookies (refresh_token)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

The **refresh token** is also set as an HTTP-only cookie:

| Property | Value |
|---|---|
| `httpOnly` | `true` — not accessible via JavaScript |
| `maxAge` | `60 * 60 * 24 * 7` (7 days, matches `JWT_REFRESH_EXPIRATION`) |
| `path` | `/` — sent on every request |

### `POST /api/v1/auth/refresh`

Reads the refresh token from the HTTP-only cookie, validates it against the `user_sessions` table, revokes the old session, and issues a new access + refresh token pair.

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -b cookies.txt    # send cookies
```

### `GET /api/v1/auth/profile`

Reads the JWT from the `Authorization` header (Elysia JWT plugin does this automatically) and returns the decoded payload.

```bash
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:3000/api/v1/auth/profile
```

---

## 3. Token Signing — `AuthService` + `SignJWT`

Tokens are signed using the `jose` library (`SignJWT`) inside the route handlers. The `AuthService` builds the payloads and delegates identity/crypto work to TypeORM + bcrypt.

### `login()` — `src/lib/services/auth.service.ts:71`

```typescript
async login(email, password, userAgent?, ipAddress?) {
  // 1. Look up user by email (is_active = true)
  const user = await this.userRepository.findOne({
    where: { email, is_active: true },
  });
  if (!user || !user.password_hash) throw new Error('Invalid credentials');

  // 2. Verify password with bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) throw new Error('Invalid credentials');

  // 3. Build payloads
  const accessTokenPayload = this.buildAccessTokenPayload({ id, email, roles });
  const refreshTokenPayload = this.buildRefreshTokenPayload({ id, email, roles: [] });

  // 4. Create raw refresh token + hash it into user_sessions
  const rawRefreshToken = crypto.randomUUID();
  const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);
  await this.sessionRepository.save({
    user_id: user.id,
    refresh_token_hash: refreshTokenHash,
    user_agent, ipAddress,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessTokenPayload, refreshTokenPayload, rawRefreshToken };
}
```

### Signing happens in the route handler — `src/server.ts:116-118`

```typescript
const _jwtSecret = new TextEncoder().encode(env.string('JWT_SECRET') ?? '');
const accessToken = await new SignJWT(accessTokenPayload)
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime(env.string('JWT_ACCESS_EXPIRATION', '1d'))
  .sign(_jwtSecret);
const refreshToken = await new SignJWT(refreshTokenPayload)
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime(env.string('JWT_REFRESH_EXPIRATION', '7d'))
  .sign(_jwtSecret);
```

---

## 4. Refreshing Tokens

### `refreshTokens()` — `src/lib/services/auth.service.ts:109`

```typescript
async refreshTokens(refreshToken, userAgent?, ipAddress?) {
  // 1. Hash the incoming refresh token and look it up in user_sessions
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const session = await this.sessionRepository.findOne({
    where: { refresh_token_hash: refreshTokenHash, revoked_at: null },
    relations: ['user'],
  });

  // 2. Check not expired and user still active
  if (!session || session.expires_at < new Date() || !session.user.is_active) {
    throw new Error('Invalid or expired refresh token');
  }

  // 3. Revoke the old session (prevents token reuse)
  session.revoked_at = new Date();
  await this.sessionRepository.save(session);

  // 4. Build new payloads + new raw refresh token
  const newRawRefreshToken = crypto.randomUUID();
  await this.sessionRepository.save({
    user_id: user.id,
    refresh_token_hash: await bcrypt.hash(newRawRefreshToken, 10),
    user_agent, ipAddress,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessTokenPayload, refreshTokenPayload, rawRefreshToken: newRawRefreshToken };
}
```

Refresh tokens are **single-use**: each refresh revokes the old session and creates a new one. This is enforced by the `revoked_at NOT NULL` check in `findOne`.

---

## 5. Reading the JWT on Protected Routes

The `@elysiajs/jwt` plugin automatically extracts and verifies the JWT from the `Authorization: Bearer <token>` header. Access it via the `jwt` context property:

```typescript
// src/server.ts — example
.get('/api/v1/auth/profile', async ({ jwt }) => {
  const payload = (jwt as any).payload as JwtPayload | undefined;
  if (!payload?.sub) return { success: false, message: 'Unauthorized' };
  return { success: true, data: payload };
})
```

Any route that reads `jwt` is automatically protected — a missing/invalid/expired token causes Elysia to return `401` before the handler runs.

### Writing Protected Routes

```typescript
// src/server.ts
.get(
  '/api/v1/admin-only',
  async ({ set, jwt }) => {
    const payload = (jwt as any).payload as JwtPayload | undefined;
    const roles = payload?.roles ?? [];
    if (!roles.includes('admin')) {
      set.status = 403;
      return { success: false, message: 'Forbidden — admin role required' };
    }
    return { success: true, data: 'admin secret data' };
  },
)
```

There is no global `JwtAuthGuard` or `RolesGuard` like in NestJS. Each route handler reads `jwt.payload` and checks `.roles` explicitly.

---

## 6. Token Expiration

Token lifetimes are read from `.env` at sign time via `env.string()`:

| Token | Env variable | Default |
|---|---|---|
| Access token | `JWT_ACCESS_EXPIRATION` | `1d` |
| Refresh token | `JWT_REFRESH_EXPIRATION` | `7d` |

Supported expiry string formats: any ISO-8601 duration parsed by the JWT library (e.g. `60m`, `1h`, `7d`). The `durationToSeconds()` helper in `AuthService` (line 10) also supports `s`, `m`, `h`, `d` units for session TTL calculations.

---

## 7. Environment Configuration

```bash
# .env
JWT_SECRET=fd722d42-3f41-4cb3-b0ac-4d97d78af02f
JWT_SECRET_CREATION=019e26c5-2c8f-7634-8e5e-fde8c15c2cbf
JWT_ACCESS_EXPIRATION=1d
JWT_REFRESH_EXPIRATION=7d

# PostgreSQL / Supabase
DATABASE_URL=postgresql://postgres:...@...:5432/postgres
```

All env values are read by `env.string()` / `env.number()` / `env.bool()` from `src/config/env.ts` — no `ConfigModule` or eager-snapshot cache.

---

## 8. Session Storage (Database)

Refresh token hashes are stored in the `user_sessions` table (TypeORM entity: `UserSessionEntity`):

| Column | Description |
|---|---|
| `id` | UUID primary key |
| `user_id` | FK → `users.id` |
| `refresh_token_hash` | bcrypt hash of the raw refresh token |
| `user_agent` | Browser / client UA string |
| `ip_address` | Client IP |
| `expires_at` | When this session expires |
| `revoked_at` | Set on refresh / logout; `NULL` = active |
| `created_at` | Timestamp |

Session revocation on refresh means a leaked token can only be used once. Logout / forced revoke can be implemented by setting `revoked_at`.

---

## 9. HTTP-Only Cookie for Refresh Token

Refresh tokens are sent as HTTP-only cookies, preventing XSS-based theft:

```typescript
// src/server.ts:120-123 (login route)
cookie.refresh_token.value = rawRefreshToken;
cookie.refresh_token.httpOnly = true;
cookie.refresh_token.maxAge = 60 * 60 * 24 * 7;   // 7 days
cookie.refresh_token.path = '/';
```

The refresh route reads it back with `cookie.refresh_token.value as string`.

---

## 10. Testing the Setup

```bash
# 1. Start the server
bun run dev

# 2. Create a user
curl -X POST http://localhost:3000/api/v1/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123","role":"admin","creationKey":"<JWT_SECRET_CREATION>"}'

# 3. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123"}' \
  -c cookies.txt

# 4. Use the access token
ACCESS_TOKEN=$(grep -Eo 'accessToken":"[^"]+' <(curl -s http://localhost:3000/api/v1/auth/login -d '...') | awk -F'"' '{print $4}')
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:3000/api/v1/auth/profile

# 5. Refresh using the cookie
curl -X POST http://localhost:3000/api/v1/auth/refresh -b cookies.txt
```

---

## 11. Security Best Practices

1. **Never commit `.env`** with real secrets — `JWT_SECRET` must be a strong random string
2. **Use HTTPS** in production to prevent token interception
3. **Refresh tokens are HTTP-only** — not accessible via JS; stored server-side in `user_sessions`
4. **Rehydration on refresh** — old refresh tokens are revoked on each use, preventing token reuse
5. **Validate roles in route handlers** — the JWT payload carries roles; never trust client-side role data
6. **Rotate `JWT_SECRET` periodically** — invalidates all existing access tokens
7. **`JWT_SECRET_CREATION` is separate** — guards the `POST /auth/create-user` endpoint; keep it out of client bundles
8. **bcrypt cost factor** is `10` for both password hashes and refresh token hashes — consider `env`-tuning this in production
