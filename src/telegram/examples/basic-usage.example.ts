/**
 * Example usage of the TelegramService within the Apollo application.
 * This file demonstrates how to inject the service and call a few of its
 * methods. It is not part of the production code – it lives under the
 * `examples` directory and can be used as a reference or for quick manual
 * testing (e.g. `node -r ts-node/register src/telegram/examples/basic-usage.example.ts`).
 */

import { NestFactory } from '@nestjs/core';
import { TelegramModule } from '../telegram.module';
import { TelegramService } from '../telegram.service';

async function bootstrap() {
  // Create a minimal Nest application that only loads the Telegram module.
  const app = await NestFactory.createApplicationContext(TelegramModule, {
    logger: false,
  });

  const telegramService = app.get(TelegramService);

  // Replace the following placeholders with real values before running.
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID';
  const MESSAGE = 'Hello from Apollo example!';

  try {
    // Send a simple text message.
    const sent = await telegramService.sendText(CHAT_ID, MESSAGE, 'Markdown');
    console.log('Message sent:', sent);

    // Fetch bot information.
    const me = await telegramService.getMe();
    console.log('Bot info:', me);
  } catch (err) {
    console.error('Telegram example error:', err);
  } finally {
    await app.close();
  }
}

bootstrap();
