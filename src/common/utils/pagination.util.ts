/**
 * Pagination options interface
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

/**
 * Pagination result interface
 */
export interface PaginationResult {
  take: number;
  skip: number;
  page: number;
  limit: number;
}

/**
 * Normalizes pagination parameters
 * @param page - Requested page number (default: 1)
 * @param limit - Items per page (default: 10, max: maxLimit)
 * @param maxLimit - Maximum allowed items per page (default: 100)
 * @returns Normalized pagination parameters
 */
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

/**
 * Calculates pagination metadata
 * @param total - Total number of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Pagination metadata object
 */
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

/**
 * Creates TypeORM / Prisma style pagination object
 * @param options - Pagination options
 * @returns Object with take and skip properties
 */
export const getPagination = (options: PaginationOptions = {}) => {
  const { page = 1, limit = 10, maxLimit = 100 } = options;
  const normalized = normalizePagination(page, limit, maxLimit);
  return {
    take: normalized.take,
    skip: normalized.skip,
  };
};
