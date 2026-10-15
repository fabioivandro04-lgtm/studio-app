import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Os testes usam as mesmas variáveis que a app (Supabase, CRON_SECRET, E2E_*).
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'pt-PT',
    timezoneId: 'Africa/Maputo',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:3000/legal/privacidade', reuseExistingServer: true, timeout: 120_000 },
});
