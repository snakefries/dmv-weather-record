import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { webkit, devices } from "playwright";

const PORT = Number(process.env.PORT || 8000);
const BASE_URL = process.env.DASHBOARD_URL || `http://127.0.0.1:${PORT}/`;
const CHECK_TIMEOUT = Number(process.env.CHECK_TIMEOUT || 45000);
const IPHONE_SCREENSHOT =
  process.env.IPHONE_SCREENSHOT || "/private/tmp/nws-dashboard-check-iphone.png";
const DESKTOP_SCREENSHOT =
  process.env.DESKTOP_SCREENSHOT || "/private/tmp/nws-dashboard-check-desktop.png";

let server;

async function main() {
  await ensurePlaywrightIsInstalled();
  await ensureServer();

  const mobile = await checkViewport({
    contextOptions: devices["iPhone 13"],
    screenshotPath: IPHONE_SCREENSHOT,
  });
  const desktop = await checkViewport({
    contextOptions: { viewport: { width: 1200, height: 900 } },
    screenshotPath: DESKTOP_SCREENSHOT,
  });

  console.log(
    JSON.stringify(
      {
        url: BASE_URL,
        mobile,
        desktop,
      },
      null,
      2
    )
  );
}

async function ensurePlaywrightIsInstalled() {
  await access("node_modules/playwright/package.json");
}

async function ensureServer() {
  if (await isDashboardReachable()) return;

  server = spawn("python3", ["-m", "http.server", String(PORT)], {
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isDashboardReachable()) return;
    await delay(250);
  }

  throw new Error(`Dashboard did not become reachable at ${BASE_URL}`);
}

async function isDashboardReachable() {
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes("Weather Record");
  } catch {
    return false;
  }
}

async function checkViewport({ contextOptions, screenshotPath }) {
  const browser = await webkit.launch();
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector("#last-updated")?.textContent.startsWith("Updated"),
    null,
    { timeout: CHECK_TIMEOUT }
  );
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#temperature-chart");
      if (!canvas || !canvas.width || !canvas.height) return false;

      const context = canvas.getContext("2d");
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];

        if (alpha !== 0 && (red < 245 || green < 245 || blue < 245)) {
          return true;
        }
      }

      return false;
    },
    null,
    { timeout: CHECK_TIMEOUT }
  );

  const switchTarget = page.locator("[data-chart-station]:not(.is-active):not(:disabled)").first();
  if ((await switchTarget.count()) > 0) {
    await switchTarget.click();
  }
  await page.waitForTimeout(300);

  const result = {
    updated: await page.locator("#last-updated").textContent(),
    activeStation: await page.locator("[data-chart-station].is-active").textContent(),
    screenshot: screenshotPath,
    consoleErrors,
  };

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  if (consoleErrors.length) {
    throw new Error(`Browser console errors: ${consoleErrors.join("; ")}`);
  }

  return result;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

process.on("exit", () => {
  if (server) {
    server.kill();
  }
});

main().catch((error) => {
  if (server) {
    server.kill();
  }
  console.error(error);
  process.exit(1);
});
