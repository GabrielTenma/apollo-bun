// src/routes/v1/auth.route.ts
// All auth-related routes under /api/v1/auth/.
// deps: authGuard (context.authPayload), authPlugin (context.authService)

import { Elysia } from "elysia";
import { log } from "evlog";
import { SignJWT } from "jose";
import { env } from "../../config/env.ts";
import { authGuard } from "../../middleware/auth.guard.ts";

// ── file-scoped shared alias ───────────────────
const authRoutes = new Elysia({
	prefix: "/auth",
	name: "authRoutes",
})

	// app.ts injects authService (decorated before this group is registered)
	.use(authGuard)

	/**
	 * POST /api/v1/auth/create-user
	 * Body: { email, password, role?, creationKey? }
	 */
	.post("/create-user", async ({ authService, body, set }) => {
		try {
			await authService.createUser(
				(body as any).email,
				(body as any).password,
				(body as any).role ?? "user",
				(body as any).creationKey ?? "",
			);
			return { success: true };
		} catch (e: any) {
			log.error({ error: e.message, route: "/api/v1/auth/create-user" });
			set.status = 400;
			return { success: false, message: e.message };
		}
	})

	/**
	 * POST /api/v1/auth/login
	 * Body: { email, password }
	 * Sets a httpOnly refresh-token cookie.
	 */
	.post("/login", async ({ authService, body, set, cookie }) => {
		try {
			const email = (body as any)?.email;
			const password = (body as any)?.password;
			if (!email || !password) {
				set.status = 400;
				return { success: false, message: "Email and password are required" };
			}
			const { accessTokenPayload, refreshTokenPayload, rawRefreshToken } =
				await authService.login(email, password);

			const _jwtSecret = new TextEncoder().encode(
				env.string("JWT_SECRET") ?? "",
			);
			const accessToken = await new SignJWT(accessTokenPayload)
				.setProtectedHeader({ alg: "HS256" })
				.setExpirationTime(env.string("JWT_ACCESS_EXPIRATION", "1d"))
				.sign(_jwtSecret);
			const refreshToken = await new SignJWT(refreshTokenPayload)
				.setProtectedHeader({ alg: "HS256" })
				.setExpirationTime(env.string("JWT_REFRESH_EXPIRATION", "7d"))
				.sign(_jwtSecret);

			cookie.refresh_token.value = rawRefreshToken;
			cookie.refresh_token.httpOnly = true;
			cookie.refresh_token.maxAge = 60 * 60 * 24 * 7;
			cookie.refresh_token.path = "/";

			return { success: true, data: { accessToken, refreshToken } };
		} catch (e: any) {
			log.error({ error: e.message, route: "/api/v1/auth/login" });
			set.status = 401;
			return { success: false, message: e.message };
		}
	})

	/**
	 * POST /api/v1/auth/refresh
	 * Reads refresh token from cookie; rotates and sets a new cookie.
	 */
	.post("/refresh", async ({ authService, cookie, set }) => {
		try {
			const refreshToken = cookie.refresh_token.value as string;
			if (!refreshToken) {
				set.status = 401;
				return { success: false, message: "No refresh token" };
			}
			const { accessTokenPayload, refreshTokenPayload, rawRefreshToken } =
				await authService.refreshTokens(refreshToken);

			const _jwtSecret = new TextEncoder().encode(
				env.string("JWT_SECRET") ?? "",
			);
			const accessToken = await new SignJWT(accessTokenPayload)
				.setProtectedHeader({ alg: "HS256" })
				.setExpirationTime(env.string("JWT_ACCESS_EXPIRATION", "1d"))
				.sign(_jwtSecret);
			const refreshed = await new SignJWT(refreshTokenPayload)
				.setProtectedHeader({ alg: "HS256" })
				.setExpirationTime(env.string("JWT_REFRESH_EXPIRATION", "7d"))
				.sign(_jwtSecret);

			cookie.refresh_token.value = rawRefreshToken;
			cookie.refresh_token.httpOnly = true;
			cookie.refresh_token.maxAge = 60 * 60 * 24 * 7;
			cookie.refresh_token.path = "/";

			return { success: true, data: { accessToken, refreshToken: refreshed } };
		} catch (e: any) {
			log.error({ error: e.message, route: "/api/v1/auth/refresh" });
			set.status = 401;
			return { success: false, message: e.message };
		}
	})

	/**
	 * GET /api/v1/auth/profile
	 * Returns the decoded JWT payload (authGuard already extracted it into context.authPayload).
	 */
	.get("/profile", async ({ authPayload, jwt }) => {
		const payload = (authPayload ?? (jwt as any)?.payload) as
			| { sub: string; email: string; roles: string[] }
			| undefined;
		if (!payload?.sub) return { success: false, message: "Unauthorized" };
		return { success: true, data: payload };
	});

export { authRoutes };
