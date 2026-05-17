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

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity)
    private readonly sessionRepository: Repository<UserSessionEntity>,
  ) {}

  /**
   * Creates a new user with the provided credentials.
   * Requires a valid creation key from config.
   *
   * @param email - User email
   * @param password - User password
   * @param role - User role
   * @param creationKey - Secret key for creation authorization
   */
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

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with role
    const user = this.userRepository.create({
      email,
      password_hash: passwordHash,
      roles: [role],
      is_active: true,
    });

    await this.userRepository.save(user);
  }

  /**
   * Authenticates a user with email and password, creates a session.
   *
   * @param email - User email
   * @param password - User password
   * @param userAgent - Optional user agent
   * @param ipAddress - Optional IP address
   * @returns Access and refresh tokens
   */
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

    // Hash the refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    // Create session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
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

  /**
   * Generates a JWT access token with user roles.
   *
   * @param user - The user object containing id, email, and roles
   * @param expiresIn - Token expiration time (e.g., '60m', '1h', '7d')
   *                     If not provided, uses JWT_ACCESS_EXPIRATION from env
   * @returns The signed JWT token
   *
   * @example
   * // Time-based expiration (60 minutes)
   * const token = generateAccessToken(user, '60m');
   *
   * // Non-time-based (no expiration)
   * const token = generateAccessToken(user, null); // or undefined
   */
  generateAccessToken(user: UserRoles, expiresIn?: string | null): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const options: { expiresIn?: string | number } = {};

    // If expiresIn is explicitly null or undefined, token won't have expiration
    if (expiresIn !== null && expiresIn !== undefined) {
      options.expiresIn = expiresIn;
    } else if (expiresIn === undefined) {
      // Use default from env if not specified
      const defaultExpiration = env.string('JWT_ACCESS_EXPIRATION', '60m');
      options.expiresIn = defaultExpiration;
    }
    // If expiresIn is null, token has no expiration (non-time-based)

    return this.jwtService.sign(payload, options);
  }

  /**
   * Generates a refresh token for token renewal.
   * Refresh tokens typically have longer expiration times.
   *
   * @param user - The user object
   * @param expiresIn - Refresh token expiration (default: 7d from env)
   * @returns The refresh token
   */
  generateRefreshToken(user: UserRoles, expiresIn?: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: [], // Refresh tokens don't need roles
    };

    const refreshExpiration =
      expiresIn ||
      env.string('JWT_REFRESH_EXPIRATION', '7d');

    return this.jwtService.sign(payload, { expiresIn: refreshExpiration });
  }

  /**
   * Validates a refresh token from database and returns new tokens.
   *
   * @param refreshToken - The refresh token to validate
   * @param userAgent - Optional user agent
   * @param ipAddress - Optional IP address
   * @returns New access token and refresh token pair
   * @throws UnauthorizedException if refresh token is invalid
   */
  async refreshTokens(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Hash the incoming refresh token to match stored hash
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

    // Revoke the old session
    session.revoked_at = new Date();
    await this.sessionRepository.save(session);

    // Create new session with new refresh token
    const user = session.user;
    const userRoles: UserRoles = {
      id: user.id,
      email: user.email,
      roles: user.roles,
    };

    const newAccessToken = this.generateAccessToken(userRoles);
    const newRefreshToken = this.generateRefreshToken(userRoles);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
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
