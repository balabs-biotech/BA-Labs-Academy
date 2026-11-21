import { chromium } from "playwright";
import assert from "node:assert/strict";

const base = process.env.ACADEMY_URL || "http://127.0.0.1:4173/#/atlas";
const siteBase = base.split("#")[0].replace(/\/?$/, "/");
const routeUrl = (route) => `${siteBase}#/${route}`;
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
      status: 200, contentType: "application/json", body: "[]"
    }));

    await page.goto(routeUrl("atlas"), { waitUntil: "domcontentloaded" });
    try {
      await page.waitForSelector("#academy-atlas-canvas", { state: "visible", timeout: 30000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        appText: document.querySelector("#app")?.innerText?.slice(0, 1200) || "",
        scripts: [...document.scripts].map((script) => script.src).filter(Boolean)
      }));
      throw new Error(`Atlas mount failed on ${viewport.name}: ${JSON.stringify({ diagnostic, pageErrors: errors, consoleErrors, failedRequests, cause: error.message })}`);
    }
    try {
      await page.waitForFunction(
        () => document.querySelector("#atlas-engine-state")?.textContent.includes("Moteur actif"),
        undefined,
        { timeout: 30000 }
      );
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        engineState: document.querySelector("#atlas-engine-state")?.textContent,
        loading: document.querySelector("#academy-atlas-loading")?.innerText,
        canvasRenderer: document.querySelector("#academy-atlas-canvas")?.dataset.renderer,
        canvasSize: (() => { const c = document.querySelector("#academy-atlas-canvas"); return c ? [c.width, c.height] : null; })()
      }));
      throw new Error(`Atlas engine failed on ${viewport.name}: ${JSON.stringify({ diagnostic, pageErrors: errors, consoleErrors, failedRequests, cause: error.message })}`);
    }

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
    assert.ok(surface.visibleNodes >= 9, "The nine department anchors must be visible in the overview");

    const stats = await page.locator(".atlas-topline-copy strong").innerText();
    assert.match(stats, /9 départements/);
    assert.match(stats, /10 parcours/);
    assert.match(stats, /47 sections/);
    assert.match(stats, /264 modules/);

    const accessibleCount = await page.locator("#academy-atlas-accessible button").count();
    assert.equal(accessibleCount, 330, "All 330 mapped nodes must be keyboard-accessible");
    assert.equal(await page.locator(".atlas-root-chip").count(), 19, "All 19 roots must remain available for direct navigation");
    assert.equal(await page.locator(".atlas-pathway-disclosure").getAttribute("open"), null, "Pathway shortcuts must stay collapsed in the initial view");
    assert.equal(await page.locator(".atlas-filter-disclosure").getAttribute("open"), null, "Connection filters must stay collapsed in the initial view");

    const pathway = page.locator("#academy-atlas-accessible button").filter({
      hasText: "Production mycologique, du laboratoire à la fructification"
    });
    await pathway.focus();
    await pathway.press("Enter");
    await page.waitForFunction(
      () => document.querySelector("#academy-atlas-selection")?.textContent.includes("Production mycologique, du laboratoire à la fructification")
    );
    assert.match(await page.locator("#academy-atlas-selection").innerText(), /séquence et ressources à construire/);
    await page.locator("#academy-atlas-selection .atlas-selection-link").click();
    await page.waitForURL("**/#/parcours/production-mycologique-laboratoire-fructification");
    await page.waitForFunction(() => document.querySelector(".page-intro h1")?.textContent.trim() === "Production mycologique, du laboratoire à la fructification");
    assert.equal(await page.locator(".page-intro h1").innerText(), "Production mycologique, du laboratoire à la fructification");

    await page.goto(`${siteBase}?smoke=departments#/departements`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll(".department-card").length === 9);
    assert.equal(await page.locator(".department-card").count(), 9, "All nine current departments must be visible");
    await page.goto(`${siteBase}?smoke=pathways#/parcours`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll(".pathway-card").length === 10);
    assert.equal(await page.locator(".pathway-card").count(), 10, "All ten cross-disciplinary pathways must be visible");

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
