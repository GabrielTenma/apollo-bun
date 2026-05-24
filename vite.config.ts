import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'src/web',
  base: '/',
  server: {
    port: 3001,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist', 'web'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/web/src'),
    },
  },
});
