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
  // Assigned by the static factory
  authService!: AuthService;

  private constructor() {}

  /**
   * Static factory. Nest resolves every dependency from the module's
   * `useFactory` so `design:paramtypes` metadata is never needed.
   */
  static create(authService: AuthService): AuthController {
    const ctrl = new AuthController();
    ctrl.authService = authService;
    return ctrl;
  }

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
      expiresIn: 3600,
    };
  }

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

  @Get('admin-only')
  @UseGuards(JwtAuthGuard)
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

  @Get('moderator-or-admin')
  @Roles('admin', 'moderator')
  getModeratorData(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Moderator/Admin access granted',
      user,
    };
  }

  @Get('profile')
  @Roles()
  getProfile(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      roles: user.roles,
    };
  }
}
