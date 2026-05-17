import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserEntity } from '../supabase/entities/user.entity';
import { UserSessionEntity } from '../supabase/entities/user-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserSessionEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (_configService: ConfigService) => {
        // tsx / esbuild strips emitDecoratorMetadata from CJS bundles in node_modules
        // so ConfigService DI can return undefined at construction time. The argument
        // is still injected (optional path) so this parameter may be undefined.
        const secret = _configService?.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is not set');
        }

        return {
          secret,
          signOptions: {
            expiresIn: _configService?.get<string>('JWT_ACCESS_EXPIRATION', '60m') ?? process.env.JWT_ACCESS_EXPIRATION ?? '60m',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
