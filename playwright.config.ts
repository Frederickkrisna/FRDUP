import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the Firebase emulators (Firestore + Auth), started by `npm run test:e2e`
 * (firebase emulators:exec — needs JDK 21+). Two servers:
 *   4173  production build + preview  (service worker, offline, golden path, a11y)
 *   5174  vite dev server             (dev-only routes such as /__dev/export)
 */
const EMULATOR_ENV = {
  VITE_USE_EMULATOR: '1',
  VITE_FIREBASE_PROJECT_ID: 'demo-frdup',
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-frdup.firebaseapp.com',
  VITE_FIREBASE_APP_ID: '1:0:web:demo',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    permissions: [],
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: [
    {
      command: 'npx vite build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
      env: EMULATOR_ENV,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: EMULATOR_ENV,
    },
  ],
});
