/**
 * Basic usage example for SupabaseService.
 * Demonstrates how to perform simple CRUD operations using the service.
 */
import { NestFactory } from '@nestjs/core';
import { SupabaseModule } from '../supabase.module';
import { SupabaseService } from '../supabase.service';

async function bootstrap() {
  // Create a minimal Nest application context that only loads the Supabase module.
  const app = await NestFactory.createApplicationContext(SupabaseModule, {
    logger: false,
  });

  const supabaseService = app.get(SupabaseService);

  // Example table name – replace with an actual table in your Supabase project.
  const TABLE = 'example_table';

  // Create a new record
  const created = await supabaseService.create(TABLE, {
    name: 'Alice',
    email: 'alice@example.com',
  });
  console.log('Created record:', created);

  // Read all records from the table
  const all = await supabaseService.read(TABLE);
  console.log('All records:', all);

  // Update the first record (assuming it has an `id` field)
  if (Array.isArray(all) && all.length > 0) {
    const id = all[0].id;
    const updated = await supabaseService.update(TABLE, id, {
      name: 'Alice Updated',
    });
    console.log('Updated record:', updated);
  }

  // Delete the first record (if any)
  if (Array.isArray(all) && all.length > 0) {
    const id = all[0].id;
    const deleted = await supabaseService.delete(TABLE, id);
    console.log('Deleted record:', deleted);
  }

  await app.close();
}

bootstrap();
