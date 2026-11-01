// Reports pages whose content is wider than the 390px viewport (horizontal overflow).
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", "me@atlas.test");
await page.fill("#password", "atlas-dev-123");
await Promise.all([page.waitForURL(`${BASE}/`), page.click("button[type=submit]")]);
const extra = process.argv.slice(2);
for (const p of ["/", "/map", "/stats", "/trips", "/countries", "/cities", "/places", "/itinerary", "/bookings", "/packing", "/budget", "/memories", "/documents", "/settings", ...extra]) {
  await page.goto(BASE + p, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > w + 1 && getComputedStyle(el).position !== "fixed").filter((el) => !el.closest(".overflow-x-auto, .scrollbar-none, .leaflet-container, [role=tablist]"));
    return { sw: document.documentElement.scrollWidth, w, first: wide.slice(0, 2).map((el) => el.tagName + "." + String(el.className).slice(0, 80)) };
  });
  console.log(r.sw > r.w ? "OVERFLOW" : "ok      ", p, r.sw, r.first.join(" | "));
}
await browser.close();
