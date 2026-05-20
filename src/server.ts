// src/server.ts — single entry point replaces main.ts + all NestJS modules
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { cookie } from '@elysiajs/cookie';
import { env } from './config/env.ts';

import { AppDataSource } from './lib/db.ts';
import { MemoryKeyStore } from './lib/memory-key-store.ts';
import { RoutineService } from './lib/routine.service.ts';
import { ScraperService } from './lib/services/scraper.service.ts';
import { OpenRouterService } from './lib/services/openrouter.service.ts';
import { TelegramService } from './lib/services/telegram.service.ts';
import { SupabaseService } from './lib/services/supabase.service.ts';
import { AuthService } from './lib/services/auth.service.ts';
import { FinancialAgentService } from './lib/services/financial-agent.service.ts';

import { ScraperRoutineService } from './lib/services/scraper-routine.service.ts';
import { OpenrouterRoutineService } from './lib/services/openrouter-routine.service.ts';
import { SupabaseRoutineService } from './lib/services/supabase-routine.service.ts';

import { UserEntity } from './supabase/entities/user.entity.ts';
import { UserSessionEntity } from './supabase/entities/user-session.entity.ts';
import { ScrapedDataEntity } from './supabase/entities/scraped-data.entity.ts';
import { ScrapingSourceEntity } from './supabase/entities/scraping-source.entity.ts';

import { FinancialJuiceTarget } from './scraper/target/financialjuice.target.ts';
import { YahooFinanceTarget } from './scraper/target/yahoofinance.target.ts';
import { CoinmarketCapTarget } from './scraper/target/coinmarketcap.target.ts';

// ─── scope: service instances created once, reused across all handlers ───
const constants = {
  appName: 'apollo',
  scrapedContentStore: new MemoryKeyStore(),
};
const routineConfig = {
  enabled: env.bool('ROUTINE_ENABLED'),
  executionMode: env.string('ROUTINE_EXECUTION_MODE', 'wait') as 'wait' | 'skip' | 'overlap',
};
const routineService = new RoutineService(routineConfig);
const memoryKeyStore = constants.scrapedContentStore;
const scraperService = new ScraperService();
const openRouterService = new OpenRouterService();
const financialAgent = new FinancialAgentService(openRouterService);
const telegramService = new TelegramService();
const supabaseService = new SupabaseService();

// ─── TypeORM bootstrap ─────────────────────────────────────────
await AppDataSource.initialize().catch((err: any) =>
  console.error('TypeORM DataSource init failed:', err),
);
const scrapedDataRepo = AppDataSource.getRepository(ScrapedDataEntity);
const scrapingSourceRepo = AppDataSource.getRepository(ScrapingSourceEntity);
const userRepo = AppDataSource.getRepository(UserEntity);
const sessionRepo = AppDataSource.getRepository(UserSessionEntity);
const authService = new AuthService(userRepo, sessionRepo);

const financialJuiceTarget = new FinancialJuiceTarget(scraperService);
const yahooFinanceTarget = new YahooFinanceTarget(scraperService);
const coinMarketCapTarget = new CoinmarketCapTarget(scraperService);

// j Sign helper — Elysia jwt plugin is available after .use(jwt(...))
const signToken = (
  payload: { sub: string; email: string; roles: string[] },
  expiresIn: string,
) => (app.jwt as any).sign(payload, { expiresIn });

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

  // ─── health ────────────────────────────────────────────────
  .get('/health', () => ({ status: 'ok', service: 'apollo-elysia' }))

  // ─── auth routes ───────────────────────────────────────────
  .post(
    '/api/v1/auth/create-user',
    async ({ body, set }) => {
      try {
        await authService.createUser(
          (body as any).email,
          (body as any).password,
          (body as any).role ?? 'user',
          (body as any).creationKey ?? '',
        );
        return { success: true };
      } catch (e: any) {
        set.status = 400;
        return { success: false, message: e.message };
      }
    },
  )
  .post(
    '/api/v1/auth/login',
    async ({ body, set, setCookie }) => {
      try {
        const { accessTokenPayload, refreshTokenPayload, rawRefreshToken } =
          await authService.login((body as any).email, (body as any).password);

        const accessToken = signToken(accessTokenPayload, env.string('JWT_ACCESS_EXPIRATION', '1d'));
        const refreshToken = signToken(refreshTokenPayload, env.string('JWT_REFRESH_EXPIRATION', '7d'));

        setCookie('refresh_token', rawRefreshToken, {
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });

        return { success: true, data: { accessToken, refreshToken } };
      } catch (e: any) {
        set.status = 401;
        return { success: false, message: e.message };
      }
    },
  )
  .post(
    '/api/v1/auth/refresh',
    async ({ cookie, set, setCookie }) => {
      try {
        const refreshToken = cookie.refresh_token;
        if (!refreshToken) {
          set.status = 401;
          return { success: false, message: 'No refresh token' };
        }
        const { accessTokenPayload, refreshTokenPayload, rawRefreshToken } =
          await authService.refreshTokens(refreshToken);

        const accessToken = signToken(accessTokenPayload, env.string('JWT_ACCESS_EXPIRATION', '1d'));
        const refreshTokenSigned = signToken(refreshTokenPayload, env.string('JWT_REFRESH_EXPIRATION', '7d'));

        setCookie('refresh_token', rawRefreshToken, {
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
        return { success: true, data: { accessToken, refreshToken: refreshTokenSigned } };
      } catch (e: any) {
        set.status = 401;
        return { success: false, message: e.message };
      }
    },
  )
  .get('/api/v1/auth/profile', async ({ jwt }) => {
    const user = (jwt as any).payload as { sub: string; email: string; roles: string[] };
    return { success: true, data: user };
  })

  // ─── scraper routes ─────────────────────────────────────────
  .post('/api/v1/scraper/scrape', async ({ body }) => {
    const result = await scraperService.scrape((body as any).options ?? {});
    return { success: true, data: result };
  })
  .post('/api/v1/scraper/scrape-multiple', async ({ body }) => {
    const result = await scraperService.scrapeMultiple((body as any).options ?? {});
    return { success: true, data: result };
  })
  .get('/api/v1/scraper/health', () => ({ status: 'ok', service: 'scraper' }))
  .get('/api/v1/scraper/financialjuice', () => ({
    success: true,
    data: memoryKeyStore.get('financialjuice'),
  }))
  .get('/api/v1/scraper/yahoofinance', () => ({
    success: true,
    data: memoryKeyStore.get('yahoofinance'),
  }))
  .get('/api/v1/scraper/coinmarketcap', () => ({
    success: true,
    data: memoryKeyStore.get('coinmarketcap'),
  }))
  .get('/api/v1/scraper/sources', async () => {
    const sources = await scrapingSourceRepo.find();
    return { success: true, data: sources };
  })
  .post('/api/v1/scraper/sources', async ({ body, set }) => {
    const source = scrapingSourceRepo.create((body as any).data);
    const saved = await scrapingSourceRepo.save(source);
    set.status = 201;
    return { success: true, data: saved };
  })

  // ─── openrouter routes ───────────────────────────────────────
  .post('/api/v1/openrouter/chat', async ({ body }) => {
    const result = await openRouterService.createChatCompletion((body as any));
    return { success: true, data: result };
  })
  .get('/api/v1/openrouter/models', async () => {
    const models = await openRouterService.listModels();
    return { success: true, data: models };
  })
  .post('/api/v1/openrouter/simple-chat', async ({ body }) => {
    const result = await openRouterService.chat(
      (body as any).prompt,
      (body as any).model,
      (body as any).systemPrompt,
    );
    return { success: true, data: result };
  })
  .get('/api/v1/openrouter/health', () => ({ status: 'ok', service: 'openrouter' }))
  .get('/api/v1/openrouter/completion', async ({ set }) => {
    const latest = memoryKeyStore.get('completion');
    const previous = memoryKeyStore.get('completion-previous');
    if (!latest) {
      set.status = 404;
      return { success: false, message: 'No completion available yet' };
    }
    return { success: true, data: { latest, previous } };
  })

  // ─── telegram routes ─────────────────────────────────────────
  .post('/api/v1/telegram/webhook', async ({ body }) => {
    await telegramService.sendMessage({ chat_id: (body as any).chatId, text: (body as any).text || '' });
    return { success: true };
  })
  .post('/api/v1/telegram/send-message', async ({ body }) => {
    const result = await telegramService.sendMessage({ chat_id: (body as any).chatId, text: (body as any).text });
    return { success: true, data: result };
  })
  .post('/api/v1/telegram/send-text', async ({ body }) => {
    await telegramService.sendText((body as any).chatId, (body as any).text, (body as any).parseMode);
    return { success: true };
  })
  .post('/api/v1/telegram/set-webhook', async ({ body }) => {
    await telegramService.setWebhook((body as any).url, (body as any).secret);
    return { success: true };
  })
  .get('/api/v1/telegram/bot-info', async () => {
    const info = await telegramService.getMe();
    return { success: true, data: info };
  })
  .get('/api/v1/telegram/health', () => ({ status: 'ok', service: 'telegram' }))

  // ─── supabase routes ──────────────────────────────────────────
  .get('/api/v1/supabase/health', () => ({ status: 'ok', service: 'supabase' }))
  .post('/api/v1/supabase/create', async ({ body }) => {
    const result = await supabaseService.create((body as any).table, (body as any).data);
    return { success: true, data: result };
  })
  .get('/api/v1/supabase/read/:table', async ({ params }) => {
    const result = await supabaseService.read(params.table);
    return { success: true, data: result };
  })
  .put('/api/v1/supabase/update', async ({ body }) => {
    const result = await supabaseService.update(
      (body as any).table,
      (body as any).id,
      (body as any).data,
    );
    return { success: true, data: result };
  })
  .delete('/api/v1/supabase/delete', async ({ body }) => {
    const result = await supabaseService.delete((body as any).table, (body as any).id);
    return { success: true, data: result };
  })

// .listen() starts accepting requests — place at end to signal readiness
.listen(3000, () => console.log('Apollo Elysia on :3000'));

// ─── start routines after app is listening ────────────────────
new ScraperRoutineService(
  routineService,
  coinMarketCapTarget,
  yahooFinanceTarget,
  financialJuiceTarget,
  scraperService,
  scrapedDataRepo,
  constants,
).start();

new OpenrouterRoutineService(
  routineService,
  financialAgent,
  scrapedDataRepo,
  constants,
).start();

new SupabaseRoutineService(routineService, supabaseService).start();

// ─── graceful shutdown ─────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down…');
  routineService.stopAllRoutines();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down…');
  routineService.stopAllRoutines();
  process.exit(0);
});
