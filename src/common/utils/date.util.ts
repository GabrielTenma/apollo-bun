/**
 * Formats a date to ISO string
 * @param date - Date to format (default: now)
 * @returns ISO string representation
 */
export const toISOString = (date: Date | string = new Date()): string => {
  if (typeof date === 'string') {
    return new Date(date).toISOString();
  }
  return date.toISOString();
};

/**
 * Formats a date to a readable string
 * @param date - Date to format
 * @param locale - Locale string (default: 'en-US')
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  },
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(d);
};

/**
 * Adds time to a date
 * @param date - Base date
 * @param amount - Amount to add
 * @param unit - Time unit ('days', 'hours', 'minutes', 'seconds')
 * @returns New date with added time
 */
export const addTime = (
  date: Date,
  amount: number,
  unit: 'days' | 'hours' | 'minutes' | 'seconds',
): Date => {
  const result = new Date(date);
  switch (unit) {
    case 'days':
      result.setDate(result.getDate() + amount);
      break;
    case 'hours':
      result.setHours(result.getHours() + amount);
      break;
    case 'minutes':
      result.setMinutes(result.getMinutes() + amount);
      break;
    case 'seconds':
      result.setSeconds(result.getSeconds() + amount);
      break;
  }
  return result;
};

/**
 * Checks if a date is expired (in the past)
 * @param date - Date to check
 * @returns True if date is in the past
 */
export const isExpired = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
};

/**
 * Gets the difference between two dates in specified unit
 * @param date1 - First date
 * @param date2 - Second date (default: now)
 * @param unit - Unit of difference ('days', 'hours', 'minutes', 'seconds')
 * @returns Difference in specified unit
 */
export const dateDiff = (
  date1: Date | string,
  date2: Date | string = new Date(),
  unit: 'days' | 'hours' | 'minutes' | 'seconds' = 'days',
): number => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  const diffMs = Math.abs(d2.getTime() - d1.getTime());

  switch (unit) {
    case 'seconds':
      return Math.floor(diffMs / 1000);
    case 'minutes':
      return Math.floor(diffMs / (1000 * 60));
    case 'hours':
      return Math.floor(diffMs / (1000 * 60 * 60));
    case 'days':
    default:
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
};
