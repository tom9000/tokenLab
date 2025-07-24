import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3005',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        // Use chromium browser instead of chrome
        browserName: 'chromium',
        // Set to false to see browser window, true for headless
        headless: false,
        // Use persistent context to maintain wallet state between tests
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        }
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3005',
    port: 3005,
    reuseExistingServer: !process.env.CI,
  },
});