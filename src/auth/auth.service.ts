import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { env } from '../common/utils/environment.util';
import { JwtPayload } from './strategies/jwt.strategy';
import { UserEntity } from '../supabase/entities/user.entity';
import { UserSessionEntity } from '../supabase/entities/user-session.entity';

export interface UserRoles {
  id: string;
  email: string;
  roles: string[];
}

/**
 * AuthService — factory pattern so NestJS bypasses broken `design:paramtypes`
 * resolution under tsx / esbuild (emitDecoratorMetadata is intentionally false).
 *
 * All constructor params are declared as non-nullable public fields so the
 * factory can assign them directly; the private constructor is never called
 * by NestJS's ClassProvider path.
 */
@Injectable()
export class AuthService {
  // Assigned by the static factory; never `undefined` after construction
  jwtService!: JwtService;
  userRepository!: Repository<UserEntity>;
  sessionRepository!: Repository<UserSessionEntity>;

  private constructor() {}

  /**
   * Static factory. Nest resolves and injects every dependency explicitly
   * from the module's `useFactory`, so `design:paramtypes` metadata is never read.
   */
  static create(
    jwtService: JwtService,
    userRepository: Repository<UserEntity>,
    sessionRepository: Repository<UserSessionEntity>,
  ): AuthService {
    const svc = new AuthService();
    svc.jwtService = jwtService;
    svc.userRepository = userRepository;
    svc.sessionRepository = sessionRepository;
    return svc;
  }

  async createUser(
    email: string,
    password: string,
    role: string,
    creationKey: string,
  ): Promise<void> {
    const expectedKey = env.string('JWT_SECRET_CREATION');
    if (!expectedKey || creationKey !== expectedKey) {
      throw new UnauthorizedException('Invalid creation key');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      email,
      password_hash: passwordHash,
      roles: [role],
      is_active: true,
    });

    await this.userRepository.save(user);
  }

  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findOne({
      where: { email, is_active: true },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRoles: UserRoles = {
      id: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.generateAccessToken(userRoles);
    const refreshToken = this.generateRefreshToken(userRoles);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );
    const session = this.sessionRepository.create({
      user_id: user.id,
      refresh_token_hash: refreshTokenHash,
      user_agent: userAgent,
      ip_address: ipAddress,
      expires_at: expiresAt,
    });

    await this.sessionRepository.save(session);

    return { accessToken, refreshToken };
  }

  generateAccessToken(user: UserRoles, expiresIn?: string | null): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const options: { expiresIn?: string | number } = {};

    if (expiresIn !== null && expiresIn !== undefined) {
      options.expiresIn = expiresIn;
    } else if (expiresIn === undefined) {
      const defaultExpiration = env.string('JWT_ACCESS_EXPIRATION', '60m');
      options.expiresIn = defaultExpiration;
    }

    return this.jwtService.sign(payload, options);
  }

  generateRefreshToken(user: UserRoles, expiresIn?: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: [],
    };

    const refreshExpiration =
      expiresIn || env.string('JWT_REFRESH_EXPIRATION', '7d');

    return this.jwtService.sign(payload, { expiresIn: refreshExpiration });
  }

  async refreshTokens(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const session = await this.sessionRepository.findOne({
      where: {
        refresh_token_hash: refreshTokenHash,
        revoked_at: null,
      },
      relations: ['user'],
    });

    if (
      !session ||
      session.expires_at < new Date() ||
      !session.user.is_active
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    session.revoked_at = new Date();
    await this.sessionRepository.save(session);

    const user = session.user;
    const userRoles: UserRoles = {
      id: user.id,
      email: user.email,
      roles: user.roles,
    };

    const newAccessToken = this.generateAccessToken(userRoles);
    const newRefreshToken = this.generateRefreshToken(userRoles);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    const newExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );
    const newSession = this.sessionRepository.create({
      user_id: user.id,
      refresh_token_hash: newRefreshTokenHash,
      user_agent: userAgent,
      ip_address: ipAddress,
      expires_at: newExpiresAt,
    });

    await this.sessionRepository.save(newSession);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}
