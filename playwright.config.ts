// Real-browser checks (§5.1.6): phone, then tablet, then desktop, each in
// light and dark. These catch what jsdom cannot: sizes, computed colors,
// and gestures.
//
// Runs against `next dev` and the DEVELOPMENT database, signed in as the
// disposable test account. One worker, because every project shares that
// account and store switching must not race.

import { defineConfig, devices } from "@playwright/test";

import { AUTH_FILE } from "./e2e/test-account";

const SIZES = [
  { name: "phone", use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
  { name: "tablet", use: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true } },
  { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
];

const THEMES = ["light", "dark"] as const;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    ...SIZES.flatMap((size) =>
      THEMES.map((theme) => ({
        name: `${size.name}-${theme}`,
        dependencies: ["setup"],
        use: {
          ...devices["Desktop Chrome"],
          ...size.use,
          // next-themes follows the device setting on a first visit.
          colorScheme: theme,
          storageState: AUTH_FILE,
        },
      })),
    ),
  ],
});
