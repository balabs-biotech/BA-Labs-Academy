import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.ACADEMY_URL || "http://127.0.0.1:4173/";
const siteBase = base.split("#")[0].replace(/\/?$/, "/");
const browser = await chromium.launch({ headless: true });
const results = [];
await mkdir("artifacts", { recursive: true });
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

    await page.goto(siteBase + "#/atlas", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#academy-atlas-v2-canvas", { state: "visible", timeout: 30000 });
    await page.waitForFunction(
      () => document.querySelector("#atlas-v2-state")?.textContent.includes("Moteur biologique partagé actif"),
      undefined,
      { timeout: 30000 }
    );

    const canvas = page.locator("#academy-atlas-v2-canvas");
    const surface = await canvas.evaluate((element) => ({
      renderer: element.dataset.renderer,
      width: element.width,
      height: element.height,
      rect: element.getBoundingClientRect().toJSON(),
      stage: element.parentElement.getBoundingClientRect().toJSON(),
      sceneNodes: Number(element.dataset.sceneNodeCount || 0),
      secondaryHyphae: Number(element.dataset.secondaryHyphaCount || 0),
      visibleLabels: Number(element.dataset.visibleLabelCount || 0),
      hiddenLabels: Number(element.dataset.hiddenLabelCount || 0),
      labelBoxes: JSON.parse(element.dataset.visibleNodeHitBoxes || "{}")
    }));
    assert.equal(surface.renderer, "pixijs-webgl");
    assert.ok(surface.width > 0 && surface.height > 0, "V2 must create a real WebGL drawing surface");
    assert.ok(surface.rect.width >= surface.stage.width * 0.98, "Canvas must fill the stage width");
    assert.ok(surface.rect.height >= surface.stage.height * 0.98, "Canvas must fill the stage height");
    assert.equal(surface.sceneNodes, 330, "All canonical Academy nodes must be represented");
    assert.ok(surface.secondaryHyphae > 0, "The biological engine must render secondary hyphae");
    assert.ok(surface.visibleLabels > 0, "The label layout must expose readable labels");
    for (const [id, box] of Object.entries(surface.labelBoxes)) {
      assert.ok(box.left >= 0 && box.right <= surface.rect.width, `Label ${id} must remain inside the horizontal viewport`);
      assert.ok(box.top >= 0 && box.bottom <= surface.rect.height, `Label ${id} must remain inside the vertical viewport`);
    }
    assert.equal(await page.locator(".atlas-root-chip").count(), 19, "All nine departments and ten pathways remain navigable");
    assert.match(await page.locator(".atlas-topline-copy strong").innerText(), /8 univers/);
    assert.match(await page.locator(".atlas-topline-copy strong").innerText(), /1 noyau MYC/);
    assert.match(await page.locator(".atlas-topline-copy strong").innerText(), /10 parcours/);
    await page.screenshot({ path: `artifacts/atlas-${viewport.name}.png`, fullPage: false });

    await page.locator('[data-v2-focus="department:MYC"]').click();
    await page.waitForFunction(() => document.querySelector("#atlas-v2-status")?.textContent.includes("MYCOLOGIE"));
    assert.equal(await page.locator("#atlas-v2-selection").isVisible(), true);

    await page.locator('[data-v2-action="in"]').click();
    await page.locator('[data-v2-action="out"]').click();
    await page.locator('[data-v2-action="fit"]').click();
    assert.equal(await canvas.getAttribute("data-renderer"), "pixijs-webgl");

    assert.deepEqual(errors, [], "No uncaught browser errors");
    assert.deepEqual(consoleErrors, [], "No browser console errors");
    assert.deepEqual(failedRequests, [], "No failed network requests");
    results.push({
      viewport: viewport.name,
      canvas: [surface.width, surface.height],
      canonicalNodes: surface.sceneNodes,
      secondaryHyphae: surface.secondaryHyphae,
      visibleLabels: surface.visibleLabels,
      hiddenLabels: surface.hiddenLabels,
      renderer: surface.renderer,
      errors: errors.length
    });
    await page.close();
  }
  console.log(JSON.stringify({ academySharedAtlas: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
