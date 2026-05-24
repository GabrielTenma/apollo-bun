/**
 * JwtPayload type used across auth routes.
 * The PassportStrategy/JwtService concerns are fully replaced by Elysia's
 * built-in JWT plugin; keep only the plain shape here.
 */
export interface JwtPayload {
	sub: string;
	email: string;
	roles: string[];
	iat?: number;
	exp?: number;
	[key: string]: unknown;
}
