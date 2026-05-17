import { registerAs } from '@nestjs/config';
import { CommonConfigService } from '../../common/config/config.service';

// Instantiate CommonConfigService directly; reads process.env without any NestJS DI.
const commonConfigService = new CommonConfigService();

/**
 * Supabase configuration loaded from environment variables.
 *
 * Example .env entries:
 *   SUPABASE_URL=https://xyzcompany.supabase.co
 *   SUPABASE_KEY=public-anon-key
 */
export const supabaseConfig = registerAs('supabase', () => ({
  url: commonConfigService.get('SUPABASE_URL') ?? '',
  key: commonConfigService.get('SUPABASE_KEY') ?? '',
}));
