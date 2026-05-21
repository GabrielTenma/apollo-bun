// src/app.ts
// Composition root — bootstraps TypeORM, evlog, plugins, route groups, and static SPA serving.
//
// Import / decoration order matters:
//   1. env / db  before any plugin that reads env vars or TypeORM repositories
//   2. global jwt / cors before routes that depend on them
//   3. plugins before routes that consume their decorated context properties

import { Elysia, file }             from 'elysia';
import { cors }                     from '@elysiajs/cors';
import { jwt }                      from '@elysiajs/jwt';
import { createRequestLogger, initLogger, log } from 'evlog';

import { env }                      from './config/env.ts';
import { AppDataSource }            from './lib/db.ts';
import { MemoryKeyStore }           from './lib/memory-key-store.ts';
import { RoutineService }           from './lib/routine.service.ts';
import { ScraperService }           from './lib/services/scraper.service.ts';
import { TelegramService }          from './lib/services/telegram.service.ts';
import { SupabaseService }           from './lib/services/supabase.service.ts';
import { OpenRouterService }        from './lib/services/openrouter.service.ts';
import { FinancialAgentService }    from './lib/services/financial-agent.service.ts';
import { ScraperRoutineService }    from './lib/services/scraper-routine.service.ts';
import { OpenrouterRoutineService } from './lib/services/openrouter-routine.service.ts';
import { SupabaseRoutineService }   from './lib/services/supabase-routine.service.ts';

import { supabasePlugin }           from './plugins/supabasePlugin.ts';
import { openrouterPlugin }         from './plugins/openrouterPlugin.ts';
import { telegramPlugin }           from './plugins/telegramPlugin.ts';
import { authGuard }                from './middleware/auth.guard.ts';

import { authRoutes }               from './routes/v1/auth.route.ts';
import { supabaseRoutes }           from './routes/v1/supabase.route.ts';
import { openrouterRoutes }         from './routes/v1/openrouter.route.ts';
import { telegramRoutes }           from './routes/v1/telegram.route.ts';
import { scraperRoutes }            from './routes/v1/scraper.route.ts';

import { UserEntity }               from './supabase/entities/user.entity.ts';
import { UserSessionEntity }        from './supabase/entities/user-session.entity.ts';
import { ScrapedDataEntity }        from './supabase/entities/scraped-data.entity.ts';
import { ScrapingSourceEntity }     from './supabase/entities/scraping-source.entity.ts';

import { FinancialJuiceTarget }     from './scraper/target/financialjuice.target.ts';
import { YahooFinanceTarget }       from './scraper/target/yahoofinance.target.ts';
import { CoinmarketCapTarget }      from './scraper/target/coinmarketcap.target.ts';

// ─── shared singletons (module scope — created once for the lifetime of the process) ───
const scrapedContentStore = new MemoryKeyStore();
const routineConfig = {
  enabled:        env.bool('ROUTINE_ENABLED'),
  executionMode:  env.string('ROUTINE_EXECUTION_MODE', 'wait') as 'wait' | 'skip' | 'overlap',
};
const routineService   = new RoutineService(routineConfig);
const scraperService   = new ScraperService();
const telegramService  = new TelegramService();
const supabaseService2 = new SupabaseService();                       // reads SUPABASE_* at ctor
const openRouterService = new OpenRouterService();
const financialAgent   = new FinancialAgentService(openRouterService);
const financialJuiceTarget = new FinancialJuiceTarget(scraperService);
const yahooFinanceTarget   = new YahooFinanceTarget(scraperService);
const coinMarketCapTarget  = new CoinmarketCapTarget(scraperService);

// ─── TypeORM bootstrap ─────────────────────────────────────────────
await AppDataSource.initialize().catch((err: any) =>
  log.error({ error: err.message, step: 'typeorm-init' }),
);
const scrapedDataRepo    = AppDataSource.getRepository(ScrapedDataEntity);
const scrapingSourceRepo  = AppDataSource.getRepository(ScrapingSourceEntity);
const userRepo            = AppDataSource.getRepository(UserEntity);
const sessionRepo         = AppDataSource.getRepository(UserSessionEntity);

// AuthService depends on TypeORM repos — built *after* AppDataSource.initialize()
const authService = new (await import('./lib/services/auth.service.ts')).AuthService(userRepo, sessionRepo);

// ─── evlog bootstrap ───────────────────────────────────────────────
initLogger({
  env: {
    service:      'apollo',
    environment:  env.string('NODE_ENV', 'development'),
  },
});

// ─── Elysia app ───────────────────────────────────────────────────
export const app = new Elysia()
  /**
   * Global middleware — applies to every route registered below.
   */
  .use(cors({
    origin: (
      env.string('CORS_ORIGIN')
      ?? 'http://localhost:5173,http://localhost:3001,http://localhost:3000'
    ).split(',').map(s => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }))
  .use(jwt({ name: 'jwt', secret: env.string('JWT_SECRET') ?? '' }))

  /**
   * Decorated store — every value below is read via `context.<name>` in route handlers.
   * Decoration must happen BEFORE the route groups that consume the value are registered.
   *
   * Rule: modify a service via `src/lib/services/*.ts`, then expose it here once.
   * No route or plugin should reach into `src/lib/services/*` directly.
   */
  /**
   * Don't use `supabasePlugin.decorate('getClient', …)` here — that goes through
   * Elysia's request pipeline.  Instead, expose supabaseService2 directly and use
   * { supabaseService } from context in handlers.
   */
  .decorate('authService',         authService)
  .decorate('supabaseService',     supabaseService2)
  .decorate('scrapedContentStore', scrapedContentStore)
  .decorate('scraperService',      scraperService)
  .decorate('telegramService',     telegramService)
  .decorate('openRouterService',   openRouterService)
  .decorate('financialAgent',      financialAgent)
  .decorate('scrapedDataRepo',     scrapedDataRepo)
  .decorate('scrapingSourceRepo',  scrapingSourceRepo)

  // ─── plugins (must appear before any route that reads their decorated values) ───
  .use(supabasePlugin)        // adds getClient / supabaseService to context
  .use(openrouterPlugin)      // adds createChatCompletion / listModels / chat
  .use(telegramPlugin)        // adds sendMessage / sendText / setWebhook / getMe

  // ─── health / readiness ────────────────────────────────────────
  .get('/health', () => ({ status: 'ok', service: 'apollo-elysia' }))

  // ─── /api/v1/* ────────────────────────────────────────────────
  .group('/api/v1', api =>
    api
      // authGuard extracts the JWT payload into context.authPayload
      .use(authGuard)

      // auth: protected (need a bearer token)
      .use(authRoutes)

      // openrouter: public + a few protected AI analysis endpoints
      .use(openrouterRoutes)

      // telegram: public admin API
      .use(telegramRoutes)

      // scraper: public endpoints + background write targets
      .use(scraperRoutes)

      // supabase: direct CRUD passthrough (admin)
      .use(supabaseRoutes)
  )

  // ─── SPA fallback (static frontend in dist/web) ─────────────────
  .get('/',         () => file('dist/web/index.html'))
  .get('*',         async ({ params }) => {
    const p = 'dist/web/' + params['*'];
    if (await Bun.file(p).exists()) return file(p);
    return file('dist/web/index.html');
  });

// ─── listen ───────────────────────────────────────────────────────
const PORT = env.number('PORT', 3000) ?? 3000;
app.listen(PORT, () => console.log(`Apollo Elysia on :${PORT}`));

// ─── background routines ───────────────────────────────────────────
new ScraperRoutineService(
  routineService,
  coinMarketCapTarget,
  yahooFinanceTarget,
  financialJuiceTarget,
  scraperService,
  scrapedDataRepo,
  { appName: 'apollo', scrapedContentStore },
).start();

new OpenrouterRoutineService(
  routineService,
  financialAgent,
  scrapedDataRepo,
  { appName: 'apollo', scrapedContentStore },
).start();

new SupabaseRoutineService(routineService, supabaseService2).start();

// ─── graceful shutdown ─────────────────────────────────────────────
const shutdown = async () => {
  console.log('Shutting down…');
  try {
    await Promise.race([
      app.stop(),
      new Promise<void>((r) => setTimeout(r, 5_000)),
    ]);
  } catch { /* already stopped — no-op */ }
  await Bun.sleep(1_000);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
