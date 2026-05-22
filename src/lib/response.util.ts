/**
 * Standard API response type — every /api/v1/* endpoint returns this shape.
 * The response is enforced by an app-level onAfterHandle hook in app.ts
 * so individual handlers cannot change the envelope; they only supply `data`.
 */
export interface ApiResponse<T = unknown> {
	success: boolean;
	data: T;
	correlation_id: string;
	timestamp: string;
}

/**
 * Build a typed ApiResponse.
 * This is the sole template — health checks and hand-rolled responses are
 * the only exceptions (they sit outside the /api/v1/* scope).
 *
 * @param data        The payload for the `data` field. Pass `null` for errors.
 * @param ok          `true` → success: true, `false` → success: false
 * @param correlation Optional correlation ID (random UUID generated if omitted)
 */
export const buildResponse = <T>(
	data: T,
	ok: boolean = true,
	correlation?: string,
): ApiResponse<T> => ({
	success: ok,
	data,
	correlation_id: correlation ?? crypto.randomUUID(),
	timestamp: new Date().toISOString(),
});

/**
 * Narrow helper: true when a value already carries the complete ApiResponse envelope
 * and must NOT be re-wrapped by the global hook.
 *
 * The detection criterion is `success` (boolean) + `correlation_id` (string) —
 * the two fields this hook stamps and that no plain handler return value would
 * ever coincidentally supply together.
 */
export const isApiResponse = (v: unknown): v is ApiResponse<unknown> =>
	typeof v === "object" &&
	v !== null &&
	typeof (v as any).success === "boolean" &&
	typeof (v as any).correlation_id === "string";

export const successResponse = <T>(
	data?: T,
	correlation?: string,
): ApiResponse<T> => buildResponse(data ?? (undefined as T), true, correlation);

export const errorResponse = (
	message: string,
	errors?: string[],
	correlation?: string,
): ApiResponse<null> => {
	const payload: Record<string, unknown> = { message };
	if (errors?.length) payload.errors = errors;
	return buildResponse<null>(payload as unknown as null, false, correlation);
};

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

export const paginatedResponse = <T>(
	data: T[],
	total: number,
	page: number,
	limit: number,
	correlation?: string,
): PaginatedResponse<T> => ({
	success: true,
	data,
	correlation_id: correlation ?? crypto.randomUUID(),
	timestamp: new Date().toISOString(),
	pagination: {
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
		hasNext: page < Math.ceil(total / limit),
		hasPrev: page > 1,
	},
});
