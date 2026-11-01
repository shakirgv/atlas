// Regression: trip switcher → All trips, every page renders; command palette; place drawer; country tabs.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 300)));
await page.goto(`${BASE}/login`);
await page.fill("#email", "me@atlas.test");
await page.fill("#password", "atlas-dev-123");
await Promise.all([page.waitForURL(`${BASE}/`), page.click("button[type=submit]")]);

await page.getByRole("button", { name: "Switch trip" }).first().click();
await page.getByRole("menuitem", { name: "All trips" }).click();
await page.waitForTimeout(1500);
const pages = ["/", "/map", "/stats", "/trips", "/countries", "/cities", "/places", "/itinerary", "/bookings", "/packing", "/budget", "/memories", "/documents", "/settings"];
for (const p of pages) {
  const res = await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
  const h = await page.locator("h1").first().innerText().catch(() => "(no h1)");
  console.log(res.status(), p.padEnd(12), "→", h.replace(/\s+/g, " ").slice(0, 50));
}
await page.goto(`${BASE}/`);
await page.keyboard.press("Control+k");
await page.getByPlaceholder(/Search places/).fill("colos");
await page.waitForTimeout(800);
console.log("palette results:", await page.locator("[cmdk-item]").allInnerTexts().then((t) => t.slice(0, 4).join(" | ")));
await page.keyboard.press("Enter");
await page.waitForURL(/places\?open=|cities|countries/, { timeout: 10000 }).catch(() => {});
console.log("palette navigated to", page.url().replace(BASE, ""));
await page.waitForTimeout(1200);
await page.screenshot({ path: ".screens/e2e-drawer.png" });
const firstCountry = await page.goto(`${BASE}/countries`).then(() => page.locator('a[href^="/countries/"]').first().getAttribute("href"));
for (const tab of ["overview", "cities", "itinerary", "places", "budget", "memories", "documents", "notes"]) {
  await page.goto(`${BASE}${firstCountry}?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
}
console.log("country tabs OK");
// back to sample trip for screenshots
await page.getByRole("button", { name: "Switch trip" }).first().click();
await page.getByRole("menuitem", { name: /Sample: Three Countries/ }).click();
await page.waitForTimeout(1000);
console.log("ERRORS", [...new Set(errors)]);
await browser.close();
