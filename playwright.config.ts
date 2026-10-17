import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    browserName: 'chromium',
    launchOptions: existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {},
    viewport: { width: 1440, height: 1080 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [{
    command: 'ETALONOPS_AUTH_MODE=local ETALONOPS_PORT=3002 ETALONOPS_DB_PATH=.runtime/playwright.sqlite npm run api',
    url: 'http://127.0.0.1:3002/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
  }, {
    command: 'ETALONOPS_API_PORT=3002 npm run dev -- --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 30_000,
  }],
});
