// E2E for the Track features: memory with EXIF photos, document upload + preview, fast-add expense, quick-add stop.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 300)));
const log = (...a) => console.log("•", ...a);
await page.goto(`${BASE}/login`);
await page.fill("#email", "me@atlas.test");
await page.fill("#password", "atlas-dev-123");
await Promise.all([page.waitForURL(`${BASE}/`), page.click("button[type=submit]")]);

// 1. Memory with photos + EXIF suggestion
await page.goto(`${BASE}/memories`);
await page.getByText(/Write a memory/).click();
await page.getByLabel("Title").fill("Coins in the fountain");
await page.getByLabel("Text").fill("Threw **two** coins. Gelato after.");
await page.locator('input[type=file][accept*="image"]').first().setInputFiles(["/tmp/fixtures/trevi.jpg", "/tmp/fixtures/colosseum.jpg"]);
await page.getByText(/Photo taken near/).waitFor({ timeout: 10000 });
log("EXIF suggestion:", await page.getByText(/Photo taken near/).innerText());
await page.getByRole("button", { name: "Link" }).click();
await page.getByRole("button", { name: /Save memory/ }).click();
await page.getByText("Memory saved").waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
log("memory saved; photos on page:", await page.locator('article img').count());
await page.screenshot({ path: ".screens/e2e-memory.png" });

// 2. Document upload + preview
await page.goto(`${BASE}/documents`);
await page.getByRole("button", { name: "Upload document" }).click();
await page.locator('input[type=file]').last().setInputFiles("/tmp/fixtures/boarding.pdf");
await page.getByRole("radio", { name: "Flight" }).click();
await page.fill("#doc-expiry", "2026-11-06");
await page.getByRole("button", { name: "Save document" }).click();
await page.getByText("Document saved").waitFor({ timeout: 20000 });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Open boarding/i }).first().click();
await page.locator("iframe").waitFor({ timeout: 15000 });
log("document preview iframe src host:", new URL(await page.locator("iframe").getAttribute("src")).host);
await page.screenshot({ path: ".screens/e2e-document.png" });
await page.keyboard.press("Escape");

// 3. Fast-add expense (Enter submits, sheet stays open)
await page.goto(`${BASE}/budget`);
await page.getByRole("button", { name: "Add expense" }).click();
await page.getByLabel("Amount", { exact: true }).fill("12.50");
await page.getByLabel("Currency", { exact: true }).selectOption("EUR");
await page.getByLabel("Amount", { exact: true }).press("Enter");
await page.getByText(/Saved €12.5/).waitFor({ timeout: 15000 });
log("sheet still open:", await page.getByLabel("Amount", { exact: true }).isVisible(), "approx line:", await page.getByText(/≈|No live rate|base currency/).first().innerText());
await page.keyboard.press("Escape");

// 4. Quick-add stop on today's day
await page.goto(`${BASE}/itinerary`);
const input = page.getByLabel(/Add a stop to day/).first();
await input.fill("18:30 Aperitivo in Monti");
await input.press("Enter");
await page.getByText("Aperitivo in Monti").waitFor({ timeout: 15000 });
log("stop added");
await page.screenshot({ path: ".screens/e2e-itinerary.png" });
console.log("ERRORS", errors);
await browser.close();
