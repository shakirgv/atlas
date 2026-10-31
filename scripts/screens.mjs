// Visual QA: logs in and captures pages at 1440px and 390px in light and dark mode.
// Usage: node scripts/screens.mjs [path ...]   (env: BASE, EMAIL, PASSWORD, OUT, MODES, WIDTHS)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.EMAIL ?? "me@atlas.test";
const PASSWORD = process.env.PASSWORD ?? "atlas-dev-123";
const OUT = process.env.OUT ?? ".screens";
const MODES = (process.env.MODES ?? "light,dark").split(",");
const WIDTHS = (process.env.WIDTHS ?? "1440,390").split(",").map(Number);
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/"];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const errors = [];
for (const width of WIDTHS) {
  for (const mode of MODES) {
    const ctx = await browser.newContext({
      viewport: { width, height: width > 800 ? 900 : 844 },
      deviceScaleFactor: width > 800 ? 1 : 2,
      colorScheme: mode,
      isMobile: width < 800,
      hasTouch: width < 800,
    });
    await ctx.addInitScript((m) => localStorage.setItem("atlas-theme", m), mode);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${width}/${mode}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${width}/${mode} console: ${m.text().slice(0, 300)}`));
    if (!paths.every((p) => p.startsWith("/login"))) {
      await page.goto(`${BASE}/login`);
      await page.fill("#email", EMAIL);
      await page.fill("#password", PASSWORD);
      await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.click("button[type=submit]")]);
    }
    for (const p of paths) {
      await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(Number(process.env.WAIT ?? 1200));
      const name = `${p.replace(/[/?=&]+/g, "_").replace(/^_|_$/g, "") || "dashboard"}-${width}-${mode}.png`;
      await page.screenshot({ path: `${OUT}/${name}`, fullPage: process.env.FULL !== "0" });
      console.log("saved", name);
    }
    await ctx.close();
  }
}
await browser.close();
if (errors.length) {
  console.log("\nERRORS:\n" + [...new Set(errors)].filter((e) => !/basemaps|wikipedia|photon|er-api|ERR_TUNNEL|Failed to load resource/.test(e)).join("\n"));
}
