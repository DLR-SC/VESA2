/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

const srcDir = resolve(__dirname, 'src');

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      '@': srcDir,
      store: resolve(srcDir, 'store'),
      types: resolve(srcDir, 'types'),
      hooks: resolve(srcDir, 'hooks'),
      utils: resolve(srcDir, 'utils'),
      components: resolve(srcDir, 'components'),
      containers: resolve(srcDir, 'containers'),
      chartHooks: resolve(srcDir, 'chartHooks'),
      HOC: resolve(srcDir, 'HOC'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
});
