export interface PaginationOptions {
	page?: number;
	limit?: number;
	maxLimit?: number;
}

export interface PaginationResult {
	take: number;
	skip: number;
	page: number;
	limit: number;
}

export const normalizePagination = (
	page?: number,
	limit?: number,
	maxLimit = 100,
): PaginationResult => {
	const validPage = Math.max(1, Math.floor(page || 1));
	const validLimit = Math.min(maxLimit, Math.max(1, Math.floor(limit || 10)));
	return {
		take: validLimit,
		skip: (validPage - 1) * validLimit,
		page: validPage,
		limit: validLimit,
	};
};

export const getPaginationMeta = (
	total: number,
	page: number,
	limit: number,
) => ({
	total,
	page,
	limit,
	totalPages: Math.ceil(total / limit),
	hasNext: page < Math.ceil(total / limit),
	hasPrev: page > 1,
});

export const getPagination = (options: PaginationOptions = {}) => {
	const { page = 1, limit = 10, maxLimit = 100 } = options;
	const normalized = normalizePagination(page, limit, maxLimit);
	return { take: normalized.take, skip: normalized.skip };
};
