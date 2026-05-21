// src/routes/v1/telegram.route.ts
// Telegram Bot API routes under /api/v1/telegram/.
// deps: telegramPlugin (context.{ sendMessage, sendText, setWebhook, getMe })

import { Elysia }         from 'elysia';
import { log }            from 'evlog';
import { telegramPlugin } from '../../plugins/telegramPlugin.ts';

const telegramRoutes = new Elysia({
  prefix: '/telegram',
  name:   'telegramRoutes',
})
  .use(telegramPlugin)

  // POST /api/v1/telegram/webhook  -- forward a chat message
  // Body: { chatId, text }
  .post('/webhook', async ({ sendMessage, body }) => {
    try {
      await sendMessage({ chat_id: (body as any).chatId, text: (body as any).text ?? '' });
      return { success: true };
    } catch (e: any) {
      log.error({ error: e.message, route: '/api/v1/telegram/webhook' });
      return { success: false, message: e.message };
    }
  })

  // POST /api/v1/telegram/send-message  -- raw Telegram sendMessage payload
  .post('/send-message', async ({ sendMessage, body, set }) => {
    try {
      const result = await sendMessage({ chat_id: (body as any).chatId, text: (body as any).text });
      return { success: true, data: result };
    } catch (e: any) {
      log.error({ error: e.message, route: '/api/v1/telegram/send-message' });
      set.status = 400;
      return { success: false, message: e.message };
    }
  })

  // POST /api/v1/telegram/send-text  -- convenience: chatId + text + parseMode
  .post('/send-text', async ({ sendText, body, set }) => {
    try {
      await sendText(
        (body as any).chatId,
        (body as any).text,
        (body as any).parseMode,
      );
      return { success: true };
    } catch (e: any) {
      log.error({ error: e.message, route: '/api/v1/telegram/send-text' });
      set.status = 400;
      return { success: false, message: e.message };
    }
  })

  // POST /api/v1/telegram/set-webhook  -- { url, secret? }
  .post('/set-webhook', async ({ setWebhook, body }) => {
    try {
      await setWebhook((body as any).url, (body as any).secret);
      return { success: true };
    } catch (e: any) {
      log.error({ error: e.message, route: '/api/v1/telegram/set-webhook' });
      return { success: false, message: e.message };
    }
  })

  // GET /api/v1/telegram/bot-info  -- getMe()
  .get('/bot-info', async ({ getMe }) => {
    try {
      const info = await getMe();
      return { success: true, data: info };
    } catch (e: any) {
      log.error({ error: e.message, route: '/api/v1/telegram/bot-info' });
      return { success: false, message: e.message };
    }
  });

export { telegramRoutes };
