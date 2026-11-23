import assert from "node:assert/strict";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

const bundle = await build({
  entryPoints: ["tests/atlas-v2-browser-entry.js"],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2022"],
  write: false,
  sourcemap: "inline"
});
const javascript = bundle.outputFiles[0].text;
const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;width:100%;height:100%;background:#111820;color:#e8edf0;font:14px sans-serif}
#stage{width:100%;height:100%;position:relative;overflow:hidden}canvas{width:100%;height:100%;display:block}
#atlas-v2-status{position:absolute;left:12px;top:12px;z-index:2}</style></head>
<body><main id="stage"><canvas id="atlas-v2-canvas"></canvas><output id="atlas-v2-status">BOOT</output></main>
<script src="/bundle.js"></script></body></html>`;

const server = createServer((request, response) => {
  if (request.url === "/bundle.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    response.end(javascript);
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
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
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "load" });
    const result = await page.evaluate(() => window.runAtlasV2BrowserSmoke());
    assert.equal(result.state, "ready", viewport.name + ": supervisor must reach ready state");
    assert.equal(result.renderer, "academy-atlas-v2-pixijs");
    assert.ok(result.width > 0 && result.height > 0, viewport.name + ": PixiJS must allocate a drawing surface");
    assert.equal(result.firstRender, true);
    assert.equal(result.firstResize, true);
    assert.equal(result.secondRender, true);
    assert.equal(result.capabilities.backend, "pixijs");
    assert.deepEqual(errors, [], viewport.name + ": no uncaught errors or console errors");
    await page.screenshot({ path: `artifacts/atlas-v2-${viewport.name}.png` });
    await page.evaluate(() => window.__atlasV2Supervisor.dispose());
    await page.close();
    process.stdout.write(JSON.stringify({ viewport: viewport.name, ...result, errors: errors.length }) + "\n");
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
