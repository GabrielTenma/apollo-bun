/**
 * Standard API response wrapper interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  correlation_id: string;
  timestamp: string;
  statusCode?: number;
}

/**
 * Creates a success response object
 * @param data - The data to include in the response
 * @param message - Optional success message
 * @param statusCode - Optional HTTP status code (default: 200)
 * @param correlationId - Optional correlation ID (auto-generated if not provided)
 * @returns A standardized success response object
 */
export const successResponse = <T>(
  data?: T,
  message?: string,
  statusCode?: number,
  correlationId?: string,
): ApiResponse<T> => ({
  success: true,
  data,
  message,
  correlation_id: correlationId || crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  statusCode: statusCode || 200,
});

/**
 * Creates an error response object
 * @param message - The error message
 * @param statusCode - HTTP status code (default: 400)
 * @param errors - Optional array of detailed errors
 * @param correlationId - Optional correlation ID (auto-generated if not provided)
 * @returns A standardized error response object
 */
export const errorResponse = (
  message: string,
  statusCode = 400,
  errors?: string[],
  correlationId?: string,
): ApiResponse<null> => ({
  success: false,
  data: null,
  message,
  correlation_id: correlationId || crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  statusCode,
});

/**
 * Creates a paginated response object
 * @param data - Array of items for the current page
 * @param total - Total number of items across all pages
 * @param page - Current page number
 * @param limit - Number of items per page
 * @returns A standardized paginated response
 */
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
  correlationId?: string,
): PaginatedResponse<T> => ({
  success: true,
  data,
  correlation_id: correlationId || crypto.randomUUID(),
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
