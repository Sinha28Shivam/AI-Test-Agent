import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure reporters based on REPORTER_TYPE env variable
const reporters = [
  ['line'],
  ['allure-playwright', { resultsDir: path.resolve(__dirname, 'allure-results') }],
  ['junit', { outputFile: 'test-results/junit/results.xml' }],
  ['html', { outputFolder: 'playwright-report', open: 'never' }]
];

export default defineConfig({
  testDir: './tests',
  // 60 s per test — enough headroom for slow external sites (MSN, etc.)
  timeout: 60000,
  expect: {
    // Give expect() assertions up to 10 s before failing
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: reporters,
  use: {
    headless: true,
    // Give individual actions (click, fill, …) up to 15 s
    actionTimeout: 15000,
    // Give page.goto() up to 45 s before failing
    navigationTimeout: 45000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
});
