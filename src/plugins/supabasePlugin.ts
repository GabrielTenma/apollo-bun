// src/plugins/supabasePlugin.ts
// Elysia plugin: exposes the Supabase client factory as `context.getClient(name)`.
// Mirrors the multi-connection discovery logic from `src/lib/services/supabase.service.ts`
// so both the raw service and the Elysia plugin point at the exact same client instances.

import { Elysia } from 'elysia';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── shared, module-scope client registry ────────────────────────────
/** Map of connection-name → SupabaseClient, populated once at import time. */
let supabaseClients: Record<string, SupabaseClient> = {};

function discoverAndCreateClients() {
  // 1. gather every SUPABASE_ env var
  const configs: Record<string, string> = {};
  for (const [key, value] of Object.entries(Bun.env)) {
    if (key.startsWith('SUPABASE_')) configs[key] = value;
  }

  // 2. build a connection-name → { url?, key? } map
  const connections: Record<string, { url?: string; key?: string }> = {};
  for (const [key, value] of Object.entries(configs)) {
    if (key === 'SUPABASE_URL') {
      connections.default = { ...connections.default, url: value };
    } else if (key === 'SUPABASE_KEY') {
      connections.default = { ...connections.default, key: value };
    } else if (key.endsWith('_URL')) {
      const name = key.replace('SUPABASE_', '').replace('_URL', '');
      connections[name] = { ...connections[name], url: value };
    } else if (key.endsWith('_KEY')) {
      const name = key.replace('SUPABASE_', '').replace('_KEY', '');
      connections[name] = { ...connections[name], key: value };
    }
  }

  // 3. create the actual clients
  for (const [name, cfg] of Object.entries(connections)) {
    console.warn(`Found supabase connection ${name}`);
    if (cfg.url && cfg.key) {
      supabaseClients[name] = createClient(cfg.url, cfg.key);
    } else {
      console.warn(`Incomplete config for Supabase connection ${name}`);
    }
  }

  if (!supabaseClients.default) {
    console.warn('No default Supabase connection configured');
  }
}

// Run once at import time — same as `new SupabaseService()` used to do.
discoverAndCreateClients();

// ── Elysia plugin ──────────────────────────────────────────────────
export interface SupabasePluginContext {
  /** Return a named Supabase client; default is `'default'`. */
  getClient: (name?: string) => SupabaseClient;
}

/**
 * Register `.decorate('getClient', …)` so any downstream route or plugin
 * can call `{ getClient }` from the context store.
 *
 * Usage in `src/app.ts`:
 *   .use(supabasePlugin)
 *   // → any handler receiving `{ getClient }` can now do:
 *   const client = getClient('default');
 */
export const supabasePlugin = new Elysia<SupabasePluginContext>({ name: 'Supabase' })
  .decorate('getClient', (name: string = 'default'): SupabaseClient => {
    const client = supabaseClients[name];
    if (!client) {
      throw new Error(`Supabase connection '${name}' not found — check SUPABASE_* env vars`);
    }
    return client;
  });
