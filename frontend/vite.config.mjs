import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ include: /\.[jt]sx?$/ })],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    outDir: 'build',
    sourcemap: false
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
