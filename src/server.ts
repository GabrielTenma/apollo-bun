// src/server.ts — single entry point replaces main.ts + all NestJS modules
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { cookie } from '@elysiajs/cookie';
import { env } from './config/env';

import { AppDataSource } from './lib/db';
import { MemoryKeyStore } from './lib/memory-key-store';
import { RoutineService } from './lib/routine.service';
import { ScraperService } from './lib/services/scraper.service';
import { OpenRouterService } from './lib/services/openrouter.service';
import { TelegramService } from './lib/services/telegram.service';
import { SupabaseService } from './lib/services/supabase.service';
import { SupabaseOrmService } from './lib/services/supabase-orm.service';
import { AuthService } from './lib/services/auth.service';
import { FinancialAgentService } from './lib/services/financial-agent.service';

import { ScraperRoutineService } from './lib/services/scraper-routine.service';
import { OpenrouterRoutineService } from './lib/services/openrouter-routine.service';
import { SupabaseRoutineService } from './lib/services/supabase-routine.service';

import { UserEntity } from './supabase/entities/user.entity';
import { UserSessionEntity } from './supabase/entities/user-session.entity';
import { ScrapedDataEntity } from './supabase/entities/scraped-data.entity';
import { ScrapingSourceEntity } from './supabase/entities/scraping-source.entity';

// Import scrape targets
import { FinancialJuiceTarget } from './scraper/target/financialjuice.target';
import { YahooFinanceTarget } from './scraper/target/yahoofinance.target';
import { CoinmarketCapTarget } from './scraper/target/coinmarketcap.target';

// ─── dependency wiring ───────────────────────────────────────────
const routineConfig = {
  enabled: env.bool('ROUTINE_ENABLED'),
  executionMode: env.string('ROUTINE_EXECUTION_MODE', 'wait') as 'wait' | 'skip' | 'overlap',
};
const routineService = new RoutineService(routineConfig);
const memoryKeyStore = new MemoryKeyStore();
const scraperService = new ScraperService();
const openRouterService = new OpenRouterService();
const financialAgent = new FinancialAgentService(openRouterService);
const telegramService = new TelegramService();
const supabaseService = new SupabaseService();

// ─── TypeORM repos ──────────────────────────────────────────────
const scrapedDataRepo = AppDataSource.getRepository(ScrapedDataEntity);
const scrapingSourceRepo = AppDataSource.getRepository(ScrapingSourceEntity);
const userRepo = AppDataSource.getRepository(UserEntity);
const sessionRepo = AppDataSource.getRepository(UserSessionEntity);

// ─── auth service (jwtSign/verify via Elysia jwt plugin — see Step 7) ──
const authService = new AuthService(null, userRepo, sessionRepo);

// ─── scrape targets ────────────────────────────────────────────
const financialJuiceTarget = new FinancialJuiceTarget(scraperService);
const yahooFinanceTarget = new YahooFinanceTarget(scraperService);
const coinMarketCapTarget = new CoinmarketCapTarget(scraperService);

// ─── Elysia app ────────────────────────────────────────────────
const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }))
  .use(jwt({
    name: 'jwt',
    secret: env.string('JWT_SECRET') ?? '',
  }))
  .use(cookie())
  .derive(() => ({
    memoryKeyStore,
    routineService,
    scraperService,
    openRouterService,
    financialAgent,
    telegramService,
    supabaseService,
    scrapedDataRepo,
    scrapingSourceRepo,
    authService,
    financialJuiceTarget,
    yahooFinanceTarget,
    coinMarketCapTarget,
  }))

  // ─── health ────────────────────────────────────────────────
  .get('/health', () => ({ status: 'ok', service: 'apollo-elysia' }))

  // ─── auth routes ───────────────────────────────────────────
  .post('/api/v1/auth/create-user', async ({ body, set, store }) => {
    const result = await store.authService.createUser((body as any).email, (body as any).password);
    return { success: true, data: result };
  })
  .post('/api/v1/auth/login', async ({ body, set, store }) => {
    const result = await store.authService.login((body as any).email, (body as any).password);
    if (result.accessToken) {
      set.cookie.token('refresh_token', result.refreshToken, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }
    return { success: true, data: result };
  })
  .post('/api/v1/auth/refresh', async ({ cookie, set, store }) => {
    const refreshToken = cookie.refresh_token;
    if (!refreshToken) {
      set.status = 401;
      return { success: false, message: 'No refresh token' };
    }
    const tokens = await store.authService.refreshTokens(refreshToken);
    set.cookie.token('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return { success: true, data: tokens };
  })
  .get('/api/v1/auth/profile', async ({ jwt, store }) => {
    const user = (jwt as any).payload as { sub: string; email: string; roles: string[] };
    return { success: true, data: user };
  })

  // ─── scraper routes ─────────────────────────────────────────
  .post('/api/v1/scraper/scrape', async ({ body, store }) => {
    const result = await store.scraperService.scrape((body as any).options ?? {});
    return { success: true, data: result };
  })
  .post('/api/v1/scraper/scrape-multiple', async ({ body, store }) => {
    const result = await store.scraperService.scrapeMultiple((body as any).options ?? {});
    return { success: true, data: result };
  })
  .post('/api/v1/scraper/extract', async ({ body, store }) => {
    const html = await store.scraperService.scrape((body as any).options ?? {});
    const structured = await store.scraperService.extractStructuredData(html, (body as any).extractConfig ?? {});
    return { success: true, data: { html, structured } };
  })
  .get('/api/v1/scraper/health', () => ({ status: 'ok', service: 'scraper' }))
  .get('/api/v1/scraper/financialjuice', ({ store }) => {
    return { success: true, data: store.memoryKeyStore.get('financialjuice') };
  })
  .get('/api/v1/scraper/yahoofinance', ({ store }) => {
    return { success: true, data: store.memoryKeyStore.get('yahoofinance') };
  })
  .get('/api/v1/scraper/coinmarketcap', ({ store }) => {
    return { success: true, data: store.memoryKeyStore.get('coinmarketcap') };
  })
  .get('/api/v1/scraper/sources', async ({ store }) => {
    const sources = await store.scrapingSourceRepo.find();
    return { success: true, data: sources };
  })
  .post('/api/v1/scraper/sources', async ({ body, set, store }) => {
    const source = store.scrapingSourceRepo.create((body as any).data);
    const saved = await store.scrapingSourceRepo.save(source);
    set.status = 201;
    return { success: true, data: saved };
  })

  // ─── openrouter routes ─────────────────────────────────────────
  .post('/api/v1/openrouter/chat', async ({ body, store }) => {
    const result = await store.openRouterService.createChatCompletion((body as any));
    return { success: true, data: result };
  })
  .get('/api/v1/openrouter/models', async ({ store }) => {
    const models = await store.openRouterService.listModels();
    return { success: true, data: models };
  })
  .post('/api/v1/openrouter/simple-chat', async ({ body, store }) => {
    const result = await store.openRouterService.chat(
      (body as any).prompt,
      (body as any).model,
      (body as any).systemPrompt,
    );
    return { success: true, data: result };
  })
  .get('/api/v1/openrouter/health', () => ({ status: 'ok', service: 'openrouter' }))
  .get('/api/v1/openrouter/completion', async ({ set, store }) => {
    const latest = store.memoryKeyStore.get('completion');
    const previous = store.memoryKeyStore.get('completion-previous');
    if (!latest) {
      set.status = 404;
      return { success: false, message: 'No completion available yet' };
    }
    return { success: true, data: { latest, previous } };
  })

  // ─── telegram routes ──────────────────────────────────────────
  .post('/api/v1/telegram/webhook', async ({ body, store }) => {
    await store.telegramService.sendMessage((body as any).chatId, (body as any).text || '');
    return { success: true };
  })
  .post('/api/v1/telegram/send-message', async ({ body, store }) => {
    const result = await store.telegramService.sendMessage((body as any).chatId, (body as any).text);
    return { success: true, data: result };
  })
  .post('/api/v1/telegram/send-text', async ({ body, store }) => {
    await store.telegramService.sendText((body as any).chatId, (body as any).text, (body as any).parseMode);
    return { success: true };
  })
  .post('/api/v1/telegram/set-webhook', async ({ body, store }) => {
    await store.telegramService.setWebhook((body as any).url, (body as any).secret);
    return { success: true };
  })
  .get('/api/v1/telegram/bot-info', async ({ store }) => {
    const info = await store.telegramService.getMe();
    return { success: true, data: info };
  })
  .get('/api/v1/telegram/health', () => ({ status: 'ok', service: 'telegram' }))

  // ─── supabase routes ──────────────────────────────────────────
  .get('/api/v1/supabase/health', () => ({ status: 'ok', service: 'supabase' }))
  .post('/api/v1/supabase/create', async ({ body, store }) => {
    const result = await store.supabaseService.create((body as any).table, (body as any).data);
    return { success: true, data: result };
  })
  .get('/api/v1/supabase/read/:table', async ({ params, store }) => {
    const result = await store.supabaseService.read(params.table);
    return { success: true, data: result };
  })
  .put('/api/v1/supabase/update', async ({ body, store }) => {
    const result = await store.supabaseService.update(
      (body as any).table,
      (body as any).id,
      (body as any).data,
    );
    return { success: true, data: result };
  })
  .delete('/api/v1/supabase/delete', async ({ body, store }) => {
    const result = await store.supabaseService.delete((body as any).table, (body as any).id);
    return { success: true, data: result };
  })

  .listen(3000, () => console.log('Apollo Elysia on :3000'));
