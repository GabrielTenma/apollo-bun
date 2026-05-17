# JWT Authentication Guide

## Overview

This project implements JWT-based authentication with role-based access control (RBAC). The system includes:
- Decorators for role enforcement and public routes
- JWT authentication and roles guards (globally registered)
- Token generation with configurable expiration
- Refresh token mechanism

**Key Files:**
- `src/common/decorators/` - `@Roles()`, `@Public()`, `@CurrentUser()` decorators
- `src/common/guards/` - `JwtAuthGuard`, `RolesGuard`
- `src/auth/auth.service.ts` - Token generation and refresh logic
- `src/auth/auth.controller.ts` - Login and refresh endpoints
- `src/auth/strategies/jwt.strategy.ts` - JWT validation strategy

---

## 1. Using Decorators

### @Roles() Decorator
Sets required role(s) for routes. Users need **at least one** of the specified roles.

**Location:** `src/common/decorators/roles.decorator.ts`

```typescript
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // Optional: guards are globally registered
export class UsersController {
  // Single role requirement
  @Get('admin-only')
  @Roles('admin')
  getAdminData() {
    return 'Only admins can access this';
  }

  // Multiple roles (user needs ANY of these)
  @Get('moderate')
  @Roles('admin', 'moderator')
  getModeratorData() {
    return 'Admins OR moderators can access this';
  }

  // No roles required (any authenticated user)
  @Get('profile')
  @Roles() 
  getProfile() {
    return 'Any logged-in user can access this';
  }
}
```

### @Public() Decorator
Marks routes as publicly accessible (bypasses JWT authentication).

**Location:** `src/common/decorators/public.decorator.ts`

```typescript
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    // No JWT required - public route
    return this.authService.login(loginDto);
  }
}
```

### @CurrentUser() Decorator
Extracts the authenticated user object from the request.

**Location:** `src/common/decorators/current-user.decorator.ts`

```typescript
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Get('me')
getProfile(@CurrentUser() user: JwtPayload) {
  return {
    id: user.sub,
    email: user.email,
    roles: user.roles,
  };
}
```

---

## 2. Creating JWT Tokens with User Roles

Use `AuthService` to generate tokens containing user roles.

**Location:** `src/auth/auth.service.ts`

### Basic Usage

```typescript
import { AuthService } from '../auth/auth.service';
import { UserRoles } from '../auth/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    // Validate user credentials (replace with DB lookup)
    const user: UserRoles = {
      id: '123',
      email: loginDto.email,
      roles: ['admin', 'user'], // Fetch from database
    };

    const token = this.authService.generateAccessToken(user);
    return { accessToken: token };
  }
}
```

### Token Payload Structure

The generated JWT contains:
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "roles": ["admin", "user"],
  "iat": 1746444000,
  "exp": 1746447600
}
```

---

## 3. Session Expiration: Time-Based vs Non-Time-Based

### Time-Based Expiration (Recommended)

Set expiration when generating tokens:

```typescript
// 60 minutes (using string format)
const token = this.authService.generateAccessToken(user, '60m');

// Alternative formats:
// '1h' - 1 hour
// '3600s' - 3600 seconds
// '1h 30m' - 1 hour 30 minutes
```

**Default expiration** is configured in `.env`:
```bash
JWT_ACCESS_EXPIRATION=60m  # Default: 60 minutes
```

### Non-Time-Based (No Expiration)

Pass `null` to create tokens that never expire:

```typescript
// Token with NO expiration (use with caution!)
const token = this.authService.generateAccessToken(user, null);
```

⚠️ **Warning:** Non-expiring tokens are a security risk. Use only for specific use cases and consider implementing token blacklisting.

---

## 4. Refresh Token Mechanism

Refresh tokens allow users to obtain new access tokens without re-authenticating.

### Step 1: Login to Get Tokens

**Endpoint:** `POST /auth/login`

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

### Step 2: Use Refresh Token to Renew

When the access token expires (after 60 minutes):

**Endpoint:** `POST /auth/refresh`

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

**Response:**
```json
{
  "accessToken": "new_access_token...",
  "refreshToken": "new_refresh_token...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

### Refresh Token Expiration

Configured in `.env`:
```bash
JWT_REFRESH_EXPIRATION=7d  # Default: 7 days
```

---

## 5. Complete Flow Example

```typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('users')
export class UsersController {
  
  // Public route - no authentication required
  @Public()
  @Get('health')
  healthCheck() {
    return { status: 'OK' };
  }

  // Any authenticated user can access
  @Get('profile')
  @Roles() // No roles specified = any authenticated user
  getProfile(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      roles: user.roles,
    };
  }

  // Only users with 'admin' role
  @Get('admin/dashboard')
  @Roles('admin')
  getAdminDashboard(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Welcome, Admin!',
      user,
    };
  }

  // Users with 'admin' OR 'moderator' role
  @Get('moderate/content')
  @Roles('admin', 'moderator')
  getContentToModerate() {
    return 'Content for moderation';
  }
}
```

---

## 6. Environment Configuration

Update your `.env` file with JWT settings:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_EXPIRATION=60m    # Access token expires in 60 minutes
JWT_REFRESH_EXPIRATION=7d     # Refresh token expires in 7 days
```

**Note:** The `JWT_SECRET` should be a strong, random string. In production, use a secure secret management system.

---

## 7. Important Notes

### Guards Registration
The `JwtAuthGuard` and `RolesGuard` are **globally registered** in `src/common/common.module.ts`. This means:
- All routes require authentication by default
- Use `@Public()` to exempt routes
- Use `@Roles()` to enforce role requirements

### Database Integration
The `AuthController` contains a mock login implementation. Replace it with real database validation:

```typescript
@Post('login')
async login(@Body() loginDto: LoginDto) {
  // Replace with actual database lookup
  const user = await this.userService.findByEmail(loginDto.email);
  
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Verify password (use bcrypt or similar)
  const isPasswordValid = await bcrypt.compare(
    loginDto.password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Generate tokens with roles from database
  return {
    accessToken: this.authService.generateAccessToken(user, '60m'),
    refreshToken: this.authService.generateRefreshToken(user),
    tokenType: 'Bearer',
    expiresIn: 3600,
  };
}
```

### Token Usage in Requests
Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3000/users/profile
```

### Testing the Setup
1. Start the application: `npm run start:dev`
2. Login at `POST /auth/login`
3. Use the `accessToken` in the `Authorization` header
4. Test role-protected routes with different user roles

---

## 8. Security Best Practices

1. **Never commit `.env`** with real secrets
2. **Use HTTPS** in production to prevent token interception
3. **Store refresh tokens securely** (httpOnly cookies preferred)
4. **Implement token blacklisting** for logout functionality
5. **Rotate JWT_SECRET** periodically
6. **Set appropriate token expiration** based on your security requirements
7. **Validate user roles on the server** (never trust client-side role checks)