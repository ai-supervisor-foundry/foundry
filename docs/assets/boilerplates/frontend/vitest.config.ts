import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'services/**/*.test.ts',
      'utils/**/*.test.ts',
      'pages/**/*.test.tsx',
      'functional_tests/**/*.test.tsx',
    ],
    setupFiles: ['functional_tests/setup-global.ts'],
    env: { VITE_API_URL: 'http://localhost' },
  },
});
