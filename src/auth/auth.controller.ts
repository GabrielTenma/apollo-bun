import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';
import { Public } from '../common/decorators/public.decorator';

class LoginDto {
  email: string;
  password: string;
}

class RefreshTokenDto {
  refreshToken: string;
}

class CreateUserDto {
  email: string;
  password: string;
  role: string;
  creationKey: string;
}

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Login endpoint - validates credentials and returns JWT tokens.
   *
   * @example Request:
   * POST /auth/login
   * {
   *   "email": "admin@example.com",
   *   "password": "password123"
   * }
   *
   * @example Response:
   * {
   *   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "expiresIn": 3600
   * }
   */
  /**
   * Create user endpoint - creates a new user with the provided credentials.
   * Requires a valid creation key from config.
   *
   * @example Request:
   * POST /auth/create-user
   * {
   *   "email": "user@example.com",
   *   "password": "password123",
   *   "role": "user",
   *   "creationKey": "secret-key-from-config"
   * }
   */
  @Public()
  @Post('create-user')
  async createUser(@Body() createUserDto: CreateUserDto) {
    await this.authService.createUser(
      createUserDto.email,
      createUserDto.password,
      createUserDto.role,
      createUserDto.creationKey,
    );

    return { message: 'User created successfully' };
  }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const tokens = await this.authService.login(
      loginDto.email,
      loginDto.password,
      req.headers['user-agent'],
      req.ip,
    );

    return {
      ...tokens,
      tokenType: 'Bearer',
      expiresIn: 3600, // 60 minutes in seconds
    };
  }

  /**
   * Refresh token endpoint - generates new token pair using refresh token.
   *
   * @example Request:
   * POST /auth/refresh
   * {
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   */
  @Public()
  @Post('refresh')
  async refresh(@Body() refreshDto: RefreshTokenDto, @Req() req: Request) {
    const tokens = await this.authService.refreshTokens(
      refreshDto.refreshToken,
      req.headers['user-agent'],
      req.ip,
    );

    return {
      ...tokens,
      tokenType: 'Bearer',
      expiresIn: 3600,
    };
  }

  /**
   * Example of role-protected route.
   * Only users with 'admin' role can access this.
   */
  @Get('admin-only')
  @UseGuards(JwtAuthGuard) // Not needed if global, but explicit here for clarity
  @Roles('admin')
  getAdminData(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Admin access granted',
      user: {
        id: user.sub,
        email: user.email,
        roles: user.roles,
      },
    };
  }

  /**
   * Example of multi-role route.
   * Users with 'admin' OR 'moderator' role can access.
   */
  @Get('moderator-or-admin')
  @Roles('admin', 'moderator')
  getModeratorData(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Moderator/Admin access granted',
      user,
    };
  }

  /**
   * Public route - no authentication required.
   */
  @Get('profile')
  @Roles() // No roles required - any authenticated user
  getProfile(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      roles: user.roles,
    };
  }
}
