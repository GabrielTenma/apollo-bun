// src/routes/index.ts
// Barrel export for all versioned route groups.
// Import this single file in src/app.ts to attach every endpoint.
export { authRoutes }       from './v1/auth.route.ts';
export { supabaseRoutes }   from './v1/supabase.route.ts';
export { openrouterRoutes } from './v1/openrouter.route.ts';
export { telegramRoutes }   from './v1/telegram.route.ts';
export { scraperRoutes }    from './v1/scraper.route.ts';
