import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"]
});

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
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${address.port}/atlas-v2-preview.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#status")?.textContent.includes("V2 actif"), { timeout: 60000 });
    const result = await page.evaluate(() => ({
      renderer: document.querySelector("canvas")?.dataset.renderer,
      nodes: document.querySelector("#node-count")?.textContent,
      departments: document.querySelector("#department-count")?.textContent,
      pathways: document.querySelector("#pathway-count")?.textContent,
      links: document.querySelector("#link-count")?.textContent,
      status: document.querySelector("#status")?.textContent,
      canvasWidth: document.querySelector("canvas")?.width,
      canvasHeight: document.querySelector("canvas")?.height,
      visibleLabels: Number(document.querySelector("canvas")?.dataset.visibleLabelCount || 0),
      hiddenLabels: Number(document.querySelector("canvas")?.dataset.hiddenLabelCount || 0),
      sceneNodes: Number(document.querySelector("canvas")?.dataset.sceneNodeCount || 0),
      secondaryHyphae: Number(document.querySelector("canvas")?.dataset.secondaryHyphaCount || 0)
    }));
    assert.equal(result.renderer, "academy-atlas-v2-pixijs", viewport.name + ": V2 PixiJS renderer");
    assert.equal(result.nodes, "330", viewport.name + ": all canonical nodes");
    assert.equal(result.departments, "9", viewport.name + ": central core and departments");
    assert.equal(result.pathways, "10", viewport.name + ": pathway orbit");
    assert.ok(Number(result.links) > 0, viewport.name + ": canonical relationships");
    assert.ok(result.canvasWidth > 0 && result.canvasHeight > 0, viewport.name + ": allocated canvas");
    assert.equal(result.sceneNodes, 330, viewport.name + ": label LOD must not remove scene nodes");
    assert.ok(result.visibleLabels > 0, viewport.name + ": structural labels must remain visible");
    assert.ok(result.hiddenLabels > 0, viewport.name + ": overview LOD must hide some labels");
    assert.ok(result.secondaryHyphae > 0, viewport.name + ": biological secondary hyphae must render");

    const initialVisibleLabels = result.visibleLabels;
    for (let step = 0; step < 7; step += 1) await page.locator("#zoom-in").click();
    const detailed = await page.locator("canvas").evaluate((canvas) => ({
      visible: Number(canvas.dataset.visibleLabelCount || 0),
      nodes: Number(canvas.dataset.sceneNodeCount || 0)
    }));
    assert.equal(detailed.nodes, 330, viewport.name + ": zoom must preserve the full node set");
    assert.ok(detailed.visible >= initialVisibleLabels, viewport.name + ": closer zoom must not reduce label visibility");
    await page.locator("#fit").click();
    assert.deepEqual(errors, [], viewport.name + ": no browser errors");
    await page.screenshot({ path: `artifacts/atlas-v2-preview-${viewport.name}.png`, fullPage: true });
    await page.close();
    process.stdout.write(JSON.stringify({ viewport: viewport.name, ...result, errors: errors.length }) + "\n");
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
