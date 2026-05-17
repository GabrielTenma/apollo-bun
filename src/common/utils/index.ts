/**
 * Barrel file for common utilities
 * This allows importing multiple utilities from a single path
 *
 * @example
 * import { successResponse, paginatedResponse, toCamelCase } from 'src/common/utils';
 */

// Response utilities
export {
  ApiResponse,
  PaginatedResponse,
  successResponse,
  errorResponse,
  paginatedResponse,
} from './response.util';

// Pagination utilities
export {
  PaginationOptions,
  PaginationResult,
  normalizePagination,
  getPaginationMeta,
  getPagination,
} from './pagination.util';

// Date utilities
export {
  toISOString,
  formatDate,
  addTime,
  isExpired,
  dateDiff,
} from './date.util';

// String utilities
export {
  capitalize,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  toSnakeCase,
  randomString,
  slugify,
  truncate,
} from './string.util';

// Memory Key Store utilities
export {
  MemoryKeyStore,
  memoryKeyStore,
  MemoryEntry,
} from './memory-key-store.util';
