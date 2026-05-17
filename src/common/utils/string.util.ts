/**
 * Capitalizes the first letter of a string
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 */
export const capitalize = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Converts a string to camelCase
 * @param str - String to convert
 * @returns camelCase string
 */
export const toCamelCase = (str: string): string => {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
};

/**
 * Converts a string to PascalCase
 * @param str - String to convert
 * @returns PascalCase string
 */
export const toPascalCase = (str: string): string => {
  const camelCase = toCamelCase(str);
  return capitalize(camelCase);
};

/**
 * Converts a string to kebab-case
 * @param str - String to convert
 * @returns kebab-case string
 */
export const toKebabCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

/**
 * Converts a string to snake_case
 * @param str - String to convert
 * @returns snake_case string
 */
export const toSnakeCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
};

/**
 * Generates a random string of specified length
 * @param length - Length of the random string (default: 8)
 * @param chars - Characters to use (default: alphanumeric)
 * @returns Random string
 */
export const randomString = (
  length = 8,
  chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
): string => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Slugifies a string (converts to URL-friendly format)
 * @param str - String to slugify
 * @returns URL-friendly slug
 */
export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Truncates a string to specified length and adds ellipsis
 * @param str - String to truncate
 * @param maxLength - Maximum length (default: 50)
 * @param suffix - Suffix to add (default: '...')
 * @returns Truncated string
 */
export const truncate = (
  str: string,
  maxLength = 50,
  suffix = '...',
): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
};
