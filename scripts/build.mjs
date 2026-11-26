import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { assertPublicBundleSafe } from "./public-bundle-guard.js";

const output = new URL("../dist/", import.meta.url);
const root = new URL("../", import.meta.url);
const sourceDirectory = new URL("../src/", import.meta.url);

async function verifyJavaScript(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = join(directory.pathname, entry.name);
    if (entry.isDirectory()) {
      await verifyJavaScript(new URL(`${entry.name}/`, directory));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      execFileSync(process.execPath, ["--check", filePath], { stdio: "inherit" });
    }
  }
}

await verifyJavaScript(sourceDirectory);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("index.html", root), new URL("index.html", output));
await cp(sourceDirectory, new URL("src/", output), { recursive: true });
await assertPublicBundleSafe(output.pathname);
console.log("Academy source syntax verified; public bundle credential guard passed; static build generated in dist/");
