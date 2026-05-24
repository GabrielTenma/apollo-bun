// src/config/env.ts — single env helper for Elysia era
export const env = {
	string: (k: string, d?: string) => Bun.env[k] ?? d,
	number: (k: string, d?: number) => {
		const v = Bun.env[k];
		return v ? Number.parseInt(v, 10) || d : d;
	},
	bool: (k: string, d = false): boolean =>
		(Bun.env[k] ?? "").toLowerCase() === "true" || d,
};
