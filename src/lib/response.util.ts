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
