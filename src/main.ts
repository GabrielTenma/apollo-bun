import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { join } from 'path';

async function bootstrap() {
  Logger.log(`Apollo Watcher.`);
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3000'],
  });

  // Serve Vite-built web assets from dist/web
  // Dynamically import serve-static for ESM compatibility (bun runtime)
  const serveStatic = (await import('serve-static')).default;
  const webDist = join(process.cwd(), 'dist', 'web');
  app.use(serveStatic(webDist, { index: false }));
  app.use('*', async (req, res) => {
    try {
      res.sendFile(join(webDist, 'index.html'));
    } catch {
      res.sendStatus(404);
    }
  });

  await app.listen(3000);
}
bootstrap();
