/**
 * Data Transfer Objects (DTOs) used by SupabaseController and SupabaseService.
 */
export interface CreateRecordDto {
  /** Name of the Supabase table */
  table: string;
  /** Data to insert */
  data: any;
}

export interface UpdateRecordDto {
  /** Name of the Supabase table */
  table: string;
  /** Primary key of the record to update */
  id: string | number;
  /** Updated fields */
  data: any;
}
