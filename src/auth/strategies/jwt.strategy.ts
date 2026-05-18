import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../common/utils/environment.util';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

/**
 * JwtStrategy — factory pattern to bypass broken `design:paramtypes` resolution
 * under tsx / esbuild (emitDecoratorMetadata is intentionally false).
 *
 * `PassportStrategy(Strategy, 'jwt')` extends `Strategy` whose constructor
 * reads class-type metadata; providing it via a static factory sidesteps that path.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private constructor() {
    const jwtSecret = env.string('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Static factory — Nest calls this from `useFactory`; no `design:paramtypes`
   * lookup is ever performed.
   */
  static create(): JwtStrategy {
    const s = new JwtStrategy();
    return s;
  }

  validate(payload: JwtPayload): JwtPayload {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
    };
  }
}
