import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const sourceCommit = "9a38b8a3a2a0dbd5ed139deba0620fd7f5bb151c";
const sourceRepository = "balabs-biotech/BA-lab";
const files = [
  { source: "ecosystem-core/explorer-2d-network.js", target: "src/features/atlas/shared/explorer-2d-network.js" },
  { source: "ecosystem-core/explorer-2d-pixi.js", target: "src/features/atlas/shared/explorer-2d-pixi.js" }
];

for (const file of files) {
  const url = `https://raw.githubusercontent.com/${sourceRepository}/${sourceCommit}/${file.source}`;
  const response = await fetch(url, { headers: { "Accept": "text/plain" } });
  if (!response.ok) throw new Error(`Shared engine sync failed (${response.status}): ${file.source}`);
  const content = await response.text();
  if (!content.trim()) throw new Error(`Shared engine source is empty: ${file.source}`);
  await mkdir(dirname(file.target), { recursive: true });
  await writeFile(file.target, content, "utf8");
  process.stdout.write(`Synced ${file.source} -> ${file.target}\n`);
}
process.stdout.write(`Shared engine pinned to ${sourceCommit}\n`);
