import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { env } from '../../config/index.ts';
import { UserEntity } from '../../supabase/entities/user.entity.ts';
import { UserSessionEntity } from '../../supabase/entities/user-session.entity.ts';
import { JwtPayload } from '../../auth/strategies/jwt.strategy.ts';

export interface UserRoles {
  id: string;
  email: string;
  roles: string[];
}

export class AuthService {
  constructor(
    public userRepository: Repository<UserEntity>,
    public sessionRepository: Repository<UserSessionEntity>,
  ) {}

  async createUser(
    email: string,
    password: string,
    role: string,
    creationKey: string,
  ): Promise<void> {
    const expectedKey = env.string('JWT_SECRET_CREATION');
    if (!expectedKey || creationKey !== expectedKey) {
      throw new Error('Invalid creation key');
    }
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
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
      throw new Error('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) throw new Error('Invalid credentials');

    const userRoles = {
      id: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.generateAccessToken(userRoles);
    const refreshToken = this.generateRefreshToken(userRoles);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
    // Caller passes JWT plugin's sign directly — handled in route handler
    throw new Error(
      'generateAccessToken: use route-level app.jwt.sign(payload, options) instead',
    );
  }

  generateRefreshToken(user: UserRoles, expiresIn?: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: [],
    };
    const refreshExpiration = expiresIn || env.string('JWT_REFRESH_EXPIRATION', '7d');
    throw new Error(
      'generateRefreshToken: use route-level app.jwt.sign(payload, { expiresIn }) instead',
    );
  }

  async refreshTokens(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const session = await this.sessionRepository.findOne({
      where: { refresh_token_hash: refreshTokenHash, revoked_at: null },
      relations: ['user'],
    });
    if (
      !session ||
      session.expires_at < new Date() ||
      !session.user.is_active
    ) {
      throw new Error('Invalid or expired refresh token');
    }
    session.revoked_at = new Date();
    await this.sessionRepository.save(session);

    const user = session.user;
    const userRoles = {
      id: user.id,
      email: user.email,
      roles: user.roles,
    };
    const newAccessToken = this.generateAccessToken(userRoles);
    const newRefreshToken = this.generateRefreshToken(userRoles);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
