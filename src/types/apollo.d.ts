// src/types/apollo.d.ts
// Module augmentation — extend Elysia's Context so route handlers can
// access injected services without `any` casts.
//
// Every property listed here must also be provided by a corresponding
// .decorate(name, value) call in src/app.ts *before* the route handler is registered.

import type { JwtPayload }     from '../auth/strategies/jwt.strategy.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OpenRouterModel } from '../openrouter/interfaces/openrouter.interface.ts';

declare module 'elysia' {
  interface Context {
    // Supabase — supabasePlugin decorates `getClient` at registration time.
    getClient: (name?: string) => SupabaseClient;
    /** Full Supabase CRUD convenience service (injected by app.ts). */
    supabaseService: {
      create(table: string, data: unknown, connection?: string): Promise<any>;
      read(table: string, filter?: any, connection?: string): Promise<any>;
      update(table: string, id: string | number, data: unknown, connection?: string): Promise<any>;
      delete(table: string, id: string | number, connection?: string): Promise<any>;
    };

    // Auth — TypeORM-backed service, created after AppDataSource.initialize()
    authService: {
      createUser(email: string, password: string, role: string, creationKey: string): Promise<void>;
      login(email: string, password: string, ua?: string, ip?: string): Promise<{
        accessTokenPayload: JwtPayload;
        refreshTokenPayload: JwtPayload;
        rawRefreshToken: string;
      }>;
      refreshTokens(token: string, ua?: string, ip?: string): Promise<{
        accessTokenPayload: JwtPayload;
        refreshTokenPayload: JwtPayload;
        rawRefreshToken: string;
      }>;
    };

    // Telegram — injected by src/app.ts via `.decorate('sendMessage', …)` etc.
    sendMessage: (opts: { chat_id: number | string; text: string; parse_mode?: string }) => Promise<unknown>;
    sendText:    (chatId: number | string, text: string, parseMode?: string) => Promise<unknown>;
    setWebhook:  (url: string, secretToken?: string) => Promise<boolean>;
    getMe:       () => Promise<{ id: number; is_bot: boolean; first_name: string; username: string }>;

    // MemoryKeyStore — same instance as background routines / scraper route
    scrapedContentStore: {
      get: <T = any>(key: string) => T | undefined;
      set: <T = any>(key: string, value: T, ttlMs?: number) => void;
    };

    // JWT payload decoded by authGuard
    authPayload?: JwtPayload;
  }
}
