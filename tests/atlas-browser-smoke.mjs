import { chromium } from "playwright";
import assert from "node:assert/strict";

const base = process.env.ACADEMY_URL || "http://127.0.0.1:4173/#/atlas";
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.name === "mobile",
      hasTouch: viewport.name === "mobile"
    });
    const errors = [];
    const consoleErrors = [];
    const failedRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(request.url() + " — " + (request.failure()?.errorText || "unknown"));
    });

    await page.route("**/rest/v1/**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]"
    }));

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#academy-atlas-canvas", { state: "visible", timeout: 30000 });
    await page.waitForFunction(
      () => document.querySelector("#atlas-engine-state")?.textContent.includes("Moteur actif"),
      undefined,
      { timeout: 30000 }
    );

    const canvas = page.locator("#academy-atlas-canvas");
    const surface = await canvas.evaluate((element) => ({
      renderer: element.dataset.renderer,
      width: element.width,
      height: element.height,
      rect: element.getBoundingClientRect().toJSON(),
      stage: element.parentElement.getBoundingClientRect().toJSON(),
      visibleNodes: JSON.parse(element.dataset.visibleNodeIds || "[]").length
    }));
    assert.equal(surface.renderer, "pixijs-webgl");
    assert.ok(surface.width > 0 && surface.height > 0, "PixiJS must create a real drawing surface");
    assert.ok(surface.rect.width >= surface.stage.width * 0.98, "Canvas must fill the Atlas stage width");
    assert.ok(surface.rect.height >= surface.stage.height * 0.98, "Canvas must fill the Atlas stage height");
    assert.ok(surface.visibleNodes >= 20, "All department, axis and pathway roots must be visible in the overview");

    const stats = await page.locator(".atlas-topline-copy strong").innerText();
    assert.match(stats, /7 départements/);
    assert.match(stats, /3 axes transversaux/);
    assert.match(stats, /10 parcours/);
    assert.match(stats, /47 sections/);
    assert.match(stats, /264 modules/);

    const accessibleCount = await page.locator("#academy-atlas-accessible button").count();
    assert.equal(accessibleCount, 331, "All 331 mapped nodes must be keyboard-accessible");
    assert.equal(await page.locator(".atlas-root-chip").count(), 20, "All 20 roots must have direct navigation");
    assert.equal(await page.locator(".atlas-root-group--departments [data-atlas-root]").count(), 7);
    assert.equal(await page.locator(".atlas-root-group--axes [data-atlas-root]").count(), 3);
    assert.equal(await page.locator(".atlas-root-group--pathways [data-atlas-root]").count(), 10);

    await page.locator('[data-atlas-root="department:MYC"]').click();
    await page.waitForFunction(
      () => document.querySelector("#academy-atlas-selection")?.textContent.includes("Mycologie appliquée")
    );
    await page.locator('[data-atlas-root="pathway:MYC-PAR-001"]').click();
    await page.waitForFunction(
      () => document.querySelector("#academy-atlas-selection")?.textContent.includes("Production mycologique, du laboratoire à la fructification")
    );

    const pathway = page.locator("#academy-atlas-accessible button").filter({
      hasText: "Production mycologique, du laboratoire à la fructification"
    });
    await pathway.click();
    await page.waitForFunction(
      () => document.querySelector("#academy-atlas-selection")?.textContent.includes("Production mycologique, du laboratoire à la fructification")
    );
    assert.match(await page.locator("#academy-atlas-selection").innerText(), /séquence et ressources à construire/);
    await page.locator("#academy-atlas-selection .atlas-selection-link").click();
    await page.waitForURL("**/#/parcours/production-mycologique-laboratoire-fructification");
    assert.equal(await page.locator(".page-intro h1").innerText(), "Production mycologique, du laboratoire à la fructification");

    await page.goto(base.replace("#/atlas", "#/departements"), { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".department-card");
    assert.equal(await page.locator(".department-card").count(), 7, "The seven canonical departments must be visible");
    await page.goto(base.replace("#/atlas", "#/axes"), { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".axis-card");
    assert.equal(await page.locator(".axis-card").count(), 3, "Transversal axes must not be counted as departments");

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelector("#atlas-engine-state")?.textContent.includes("Moteur actif"),
      undefined,
      { timeout: 30000 }
    );
    await page.locator('[data-atlas-action="in"]').click();
    await page.locator('[data-atlas-action="out"]').click();
    await page.locator('[data-atlas-action="reset"]').click();
    assert.equal(await canvas.getAttribute("data-renderer"), "pixijs-webgl");

    assert.deepEqual(errors, [], "No uncaught browser errors");
    assert.deepEqual(consoleErrors, [], "No browser console errors");
    assert.deepEqual(failedRequests, [], "No failed network requests");
    results.push({
      viewport: viewport.name,
      canvas: [surface.width, surface.height],
      visibleRoots: surface.visibleNodes,
      accessibleNodes: accessibleCount,
      renderer: surface.renderer,
      errors: errors.length
    });
    await page.close();
  }
  console.log(JSON.stringify({ academyAtlas: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
