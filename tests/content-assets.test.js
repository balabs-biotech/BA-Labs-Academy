import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration,dataSource,mainSource] = await Promise.all([
  readFile(new URL("../supabase/migrations/20261122013000_academy_content_asset_versioning_v1.sql", import.meta.url), "utf8").catch(()=> ""),
  readFile(new URL("../src/data.js", import.meta.url), "utf8"),
  readFile(new URL("../src/main.js", import.meta.url), "utf8")
]);

test("resource assets have typed metadata and immutable version history", () => {
  assert.match(migration, /academy_content_assets/);
  assert.match(migration, /asset_version/);
  assert.match(migration, /previous_version_id/);
  assert.match(migration, /checksum_sha256/);
  assert.match(migration, /license_code/);
});

test("resource asset writes are role-gated and storage objects must be private", () => {
  assert.match(migration, /academy_assert_role\(array\['OWNER','ADMIN','EDITOR'\]\)/);
  assert.match(migration, /b\.public=false/);
  assert.match(migration, /revoke all on function public\.academy_save_content_assets[\s\S]*from public,anon/i);
  assert.match(migration, /grant execute on function public\.academy_save_content_assets[\s\S]*to authenticated/i);
});

test("asset visibility inherits the parent resource publication state", () => {
  assert.match(migration, /c\.status='PUBLISHED'/);
  assert.match(migration, /c\.editorial_status='PUBLISHED'/);
  assert.match(migration, /'PUBLIC','DISCOVERABLE'/);
});

test("asset editor and data wrapper are wired", () => {
  assert.match(dataSource, /export function saveContentAssets/);
  assert.match(dataSource, /academy_content_assets/);
  assert.match(mainSource, /content-asset-form/);
  assert.match(mainSource, /saveContentAssets/);
});
