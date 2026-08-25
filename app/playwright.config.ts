import { defineConfig, devices } from "@playwright/test";

// Some developer environments express localhost in NO_PROXY as a CIDR. Node's proxy handling
// does not recognize that form consistently, so keep the disposable local server off any proxy.
process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1", "localhost"].filter(Boolean).join(",");
process.env.no_proxy = process.env.NO_PROXY;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    ...devices["Desktop Chrome"],
    headless: true,
    launchOptions: { ...(process.env.CI ? {} : { executablePath: "/usr/bin/chromium" }), args: ["--no-sandbox"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "cd .. && KEEP_SERVER=true APP_PORT=3001 ANVIL_PORT=18545 ./scripts/local-app-smoke.sh",
    url: "http://127.0.0.1:3001",
    timeout: 180_000,
    reuseExistingServer: process.env.REUSE_SERVER === "true",
  },
});
