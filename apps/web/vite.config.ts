import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brd/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@brd/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@': resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
  optimizeDeps: {
    entries: ['src/main.tsx'],
  },
});
