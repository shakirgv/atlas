import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const msgs = [];
page.on("console", (m) => m.type() === "error" && msgs.push(m.text()));
await page.goto("http://localhost:3000/login");
await page.fill("#email", "me@atlas.test"); await page.fill("#password", "atlas-dev-123");
await Promise.all([page.waitForURL("http://localhost:3000/"), page.click("button[type=submit]")]);
for (const p of ["/places", "/itinerary"]) {
  msgs.length = 0;
  await page.goto("http://localhost:3000" + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log(p, msgs.map((m) => m.slice(0, 1800)).join("\n---\n"));
}
await browser.close();
