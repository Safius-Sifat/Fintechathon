import { createHash } from "node:crypto";
import { chromium, type Browser } from "playwright-core";

// The fixed checkout targets (P4-01). Each has an expected title and a fixed
// form: the healthy page confirms the order, the broken page shows an error.
export const TARGETS = {
  "checkout-healthy": {
    path: "checkout-healthy/index.html",
    expectedTitle: "Checkout",
  },
  "checkout-broken": {
    path: "checkout-broken/index.html",
    expectedTitle: "Checkout",
  },
} as const;
export type TargetId = keyof typeof TARGETS;
export type Check = "pageLoad" | "title" | "formSubmit";

export interface BrowserRun {
  checks: {
    pageLoad?: boolean;
    title?: { actual: string; expected: string; pass: boolean };
    formSubmit?: boolean;
  };
  screenshot: Buffer;
  log: string;
  screenshotHash: `0x${string}`;
  logHash: `0x${string}`;
}

export interface BrowserConfig {
  // Origin that serves the fixture pages, e.g. https://fixtures.example.
  targetOrigin: string;
  // Chrome channel or an explicit executable for playwright-core.
  executablePath?: string | undefined;
  channel?: string | undefined;
  timeoutMs?: number | undefined;
}

const sha256 = (data: Buffer | string) =>
  `0x${createHash("sha256").update(data).digest("hex")}` as const;

// Runs the requested checks once in a fresh headless browser. Only the fixed
// target origin may be loaded; every other request is blocked, so a page
// cannot redirect the browser to other hosts or the local network.
export async function runChecks(
  targetId: TargetId,
  checks: readonly Check[],
  config: BrowserConfig,
): Promise<BrowserRun> {
  const target = TARGETS[targetId];
  const origin = new URL(config.targetOrigin).origin;
  const url = new URL(target.path, `${origin}/`).toString();
  const timeout = config.timeoutMs ?? 15_000;
  const log: string[] = [];
  const note = (line: string) =>
    log.push(`${new Date().toISOString()} ${line}`);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(config.executablePath
        ? { executablePath: config.executablePath }
        : {}),
      ...(config.channel ? { channel: config.channel } : {}),
    });
    const context = await browser.newContext({ javaScriptEnabled: true });
    await context.route("**/*", (route) => {
      const requested = new URL(route.request().url());
      if (requested.origin === origin) return route.continue();
      note(`blocked ${requested.origin}`);
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("console", (m) => note(`console ${m.type()}: ${m.text()}`));
    note(`goto ${url}`);
    const response = await page.goto(url, { timeout, waitUntil: "load" });
    const loaded =
      response !== null &&
      response.ok() &&
      new URL(page.url()).origin === origin;
    note(`load status ${response?.status() ?? "none"} final ${page.url()}`);

    const result: BrowserRun["checks"] = {};
    if (checks.includes("pageLoad")) result.pageLoad = loaded;
    if (checks.includes("title")) {
      const actual = loaded ? await page.title() : "";
      result.title = {
        actual,
        expected: target.expectedTitle,
        pass: actual === target.expectedTitle,
      };
      note(`title "${actual}"`);
    }
    if (checks.includes("formSubmit")) {
      let ok = false;
      if (loaded) {
        await page.click("#submit-checkout", { timeout });
        const outcome = await page
          .waitForSelector("#confirmation, #error", { timeout })
          .catch(() => null);
        const id = outcome ? await outcome.getAttribute("id") : null;
        ok = id === "confirmation";
        note(
          `form outcome ${id ?? "none"}: ${outcome ? await outcome.innerText() : ""}`,
        );
      }
      result.formSubmit = ok;
    }
    const screenshot = loaded
      ? await page.screenshot({ fullPage: true })
      : Buffer.alloc(0);
    const logText = log.join("\n");
    return {
      checks: result,
      screenshot,
      log: logText,
      screenshotHash: sha256(screenshot),
      logHash: sha256(logText),
    };
  } finally {
    await browser?.close();
  }
}
