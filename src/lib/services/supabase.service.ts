import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseService {
  private readonly clients: Map<string, SupabaseClient> = new Map();
  private defaultClient?: SupabaseClient;

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    const configs: Record<string, string> = {};
    for (const [key, value] of Object.entries(Bun.env)) {
      if (key.startsWith('SUPABASE_')) configs[key] = value;
    }

    const connections: Record<string, { url?: string; key?: string }> = {};
    for (const [key, value] of Object.entries(configs)) {
      if (key === 'SUPABASE_URL') {
        connections['default'] = { ...connections['default'], url: value };
      } else if (key === 'SUPABASE_KEY') {
        connections['default'] = { ...connections['default'], key: value };
      } else if (key.endsWith('_URL')) {
        const name = key.replace('SUPABASE_', '').replace('_URL', '');
        connections[name] = { ...connections[name], url: value };
      } else if (key.endsWith('_KEY')) {
        const name = key.replace('SUPABASE_', '').replace('_KEY', '');
        connections[name] = { ...connections[name], key: value };
      }
    }

    for (const [name, config] of Object.entries(connections)) {
      console.warn(`Found supabase connection ${name}`);
      if (config.url && config.key) {
        this.clients.set(name, createClient(config.url, config.key));
        if (name === 'default') this.defaultClient = this.clients.get(name);
      } else {
        console.warn(`Incomplete config for Supabase connection ${name}`);
      }
    }
    if (!this.defaultClient) console.warn('No default Supabase connection configured');
  }

  private getClient(connection = 'default'): SupabaseClient {
    const client = this.clients.get(connection);
    if (!client) throw new Error(`Supabase connection '${connection}' not found`);
    return client;
  }

  async create(table: string, data: any, connection = 'default'): Promise<any> {
    const client = this.getClient(connection);
    const { data: result, error } = await client.from(table).insert(data);
    if (error) {
      console.error(`Supabase create error on connection ${connection}`, error);
      throw error;
    }
    return result;
  }

  async read(table: string, filter?: any, connection = 'default'): Promise<any> {
    const client = this.getClient(connection);
    let query: any = client.from(table).select('*');
    if (filter?.field && filter?.value !== undefined) {
      query = query.eq(filter.field, filter.value);
    }
    const { data, error } = await query;
    if (error) {
      console.error(`Supabase read error on connection ${connection}`, error);
      throw error;
    }
    return data;
  }

  async update(table: string, id: string | number, data: any, connection = 'default'): Promise<any> {
    const client = this.getClient(connection);
    const { data: result, error } = await client
      .from(table)
      .update(data)
      .eq('id', id);
    if (error) {
      console.error(`Supabase update error on connection ${connection}`, error);
      throw error;
    }
    return result;
  }

  async delete(table: string, id: string | number, connection = 'default'): Promise<any> {
    const client = this.getClient(connection);
    const { data: result, error } = await client
      .from(table)
      .delete()
      .eq('id', id);
    if (error) {
      console.error(`Supabase delete error on connection ${connection}`, error);
      throw error;
    }
    return result;
  }
}
