import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const base = env.VITE_BASE_PATH ?? process.env.VITE_BASE_PATH ?? '';
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      preview: {
        allowedHosts: ['apps.syedahmedhaidershah.com'],
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
