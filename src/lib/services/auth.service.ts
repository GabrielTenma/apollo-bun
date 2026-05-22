import * as crypto from "node:crypto";
import * as bcrypt from "bcrypt";
import type { Repository } from "typeorm";
import type { JwtPayload } from "../../auth/strategies/jwt.strategy.ts";
import { env } from "../../config/index.ts";
import type { UserEntity } from "../../supabase/entities/user.entity.ts";
import type { UserSessionEntity } from "../../supabase/entities/user-session.entity.ts";

/** Parse an ISO-8601 duration string (e.g. "60m", "7d") → seconds */
function _durationToSeconds(duration: string): number {
	const match = duration.match(/^(\d+)([smhd])$/);
	if (!match) return 0;
	const value = Number.parseInt(match[1], 10);
	const unit = match[2];
	const multipliers: Record<string, number> = {
		s: 1,
		m: 60,
		h: 3600,
		d: 86400,
	};
	return value * (multipliers[unit] ?? 1);
}

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
		const expectedKey = env.string("JWT_SECRET_CREATION");
		if (!expectedKey || creationKey !== expectedKey) {
			throw new Error("Invalid creation key");
		}
		const existingUser = await this.userRepository.findOne({
			where: { email },
		});
		if (existingUser) {
			throw new Error("User already exists");
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

	buildAccessTokenPayload(user: UserRoles): JwtPayload {
		return {
			sub: user.id,
			email: user.email,
			roles: user.roles,
		};
	}

	buildRefreshTokenPayload(user: UserRoles): JwtPayload {
		return {
			sub: user.id,
			email: user.email,
			roles: [],
		};
	}

	async login(
		email: string,
		password: string,
		userAgent?: string,
		ipAddress?: string,
	): Promise<{
		accessTokenPayload: JwtPayload;
		refreshTokenPayload: JwtPayload;
		rawRefreshToken: string;
	}> {
		const user = await this.userRepository.findOne({
			where: { email, is_active: true },
		});
		if (!user?.password_hash) {
			throw new Error("Invalid credentials");
		}
		const isPasswordValid = await bcrypt.compare(password, user.password_hash);
		if (!isPasswordValid) throw new Error("Invalid credentials");

		const userRoles = {
			id: user.id,
			email: user.email,
			roles: user.roles,
		};

		const accessTokenPayload = this.buildAccessTokenPayload(userRoles);
		const refreshTokenPayload = this.buildRefreshTokenPayload(userRoles);

		const rawRefreshToken = crypto.randomUUID();
		const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		const session = this.sessionRepository.create({
			user_id: user.id,
			refresh_token_hash: refreshTokenHash,
			user_agent: userAgent,
			ip_address: ipAddress,
			expires_at: expiresAt,
		});
		await this.sessionRepository.save(session);
		return { accessTokenPayload, refreshTokenPayload, rawRefreshToken };
	}

	async refreshTokens(
		refreshToken: string,
		userAgent?: string,
		ipAddress?: string,
	): Promise<{
		accessTokenPayload: JwtPayload;
		refreshTokenPayload: JwtPayload;
		rawRefreshToken: string;
	}> {
		const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
		const session = await this.sessionRepository.findOne({
			where: { refresh_token_hash: refreshTokenHash, revoked_at: null },
			relations: ["user"],
		});
		if (
			!session ||
			session.expires_at < new Date() ||
			!session.user.is_active
		) {
			throw new Error("Invalid or expired refresh token");
		}
		session.revoked_at = new Date();
		await this.sessionRepository.save(session);

		const user = session.user;
		const userRoles = {
			id: user.id,
			email: user.email,
			roles: user.roles,
		};
		const newAccessTokenPayload = this.buildAccessTokenPayload(userRoles);
		const newRefreshTokenPayload = this.buildRefreshTokenPayload(userRoles);
		const newRawRefreshToken = crypto.randomUUID();
		const newRefreshTokenHash = await bcrypt.hash(newRawRefreshToken, 10);
		const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		const newSession = this.sessionRepository.create({
			user_id: user.id,
			refresh_token_hash: newRefreshTokenHash,
			user_agent: userAgent,
			ip_address: ipAddress,
			expires_at: newExpiresAt,
		});
		await this.sessionRepository.save(newSession);
		return {
			accessTokenPayload: newAccessTokenPayload,
			refreshTokenPayload: newRefreshTokenPayload,
			rawRefreshToken: newRawRefreshToken,
		};
	}
}
