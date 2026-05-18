import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserEntity } from '../supabase/entities/user.entity';
import { UserSessionEntity } from '../supabase/entities/user-session.entity';

/**
 * Factory for AuthService — injects every dependency explicitly
 * to bypass broken `design:paramtypes` resolution under bun/tsx.
 */
function buildAuthService(
  jwtService: JwtService,
  userRepository: any,
  sessionRepository: any,
): AuthService {
  return AuthService.create(jwtService, userRepository, sessionRepository);
}

/**
 * Factory for AuthController — same pattern.
 */
function buildAuthController(authService: AuthService): AuthController {
  return AuthController.create(authService);
}

/**
 * Factory for JwtStrategy — extends PassportStrategy whose base constructor
 * reads `design:paramtypes`. The factory sidesteps that path entirely.
 */
function buildJwtStrategy(): JwtStrategy {
  return JwtStrategy.create();
}

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserSessionEntity]),
    /**
     * PassportModule is intentionally registered here so that `@Injectable()`
     * guard-based auth (via the APP_GUARD pipeline) works. The `jwt` strategy
     * itself is provided separately via JwtStrategy below, so we only need
     * the base module — not a `defaultStrategy` that would pull in class-type
     * DI resolution inside `@nestjs/passport`.
     */
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService?.get<string>('JWT_SECRET') ??
          process.env.JWT_SECRET,
        signOptions: {
          expiresIn:
            configService?.get<string>('JWT_ACCESS_EXPIRATION', '60m') ??
            process.env.JWT_ACCESS_EXPIRATION ??
            '60m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    /**
     * AuthService — provided via factory so constructor params are assigned
     * explicitly without reading `design:paramtypes`.
     *
     * Directly injects `JwtService` (exported from `JwtModule` above, registered
     * as a class-token provider in this module's DI scope) and the TypeORM
     * repos via their official token helpers.
     */
    {
      provide: AuthService,
      useFactory: buildAuthService,
      inject: [
        JwtService,
        getRepositoryToken(UserEntity),
        getRepositoryToken(UserSessionEntity),
      ],
    },
    /**
     * Factory-based controller — NestJS accepts plain `AuthController` in
     * `controllers: []` since it retrieves the factory-instantiated instance
     * from the DI container by the `AuthController` provider token.
     */
    {
      provide: AuthController,
      useFactory: buildAuthController,
      inject: [AuthService],
    },
    /**
     * JwtStrategy — factory to bypass broken base-class constructor DI.
     */
    {
      provide: JwtStrategy,
      useFactory: buildJwtStrategy,
      inject: [],
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
