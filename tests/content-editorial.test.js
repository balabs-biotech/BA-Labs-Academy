import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [editorialSql, accessSql, dataSource, mainSource] = await Promise.all([
  readFile(new URL("../supabase/migrations/20261121200000_academy_content_editorial_classification_v1.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261121201500_academy_content_editor_read_access_v1.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/data.js", import.meta.url), "utf8"),
  readFile(new URL("../src/main.js", import.meta.url), "utf8")
]);

test("content editor is a role-gated atomic RPC", () => {
  assert.match(editorialSql, /academy_assert_role\(array\['OWNER','ADMIN','EDITOR'\]\)/);
  assert.match(editorialSql, /revoke all on function public\.academy_save_content_editorial[\s\S]*from public,anon/i);
  assert.match(editorialSql, /grant execute on function public\.academy_save_content_editorial[\s\S]*to authenticated/i);
});

test("resource classification requires one primary department and matching domains", () => {
  assert.match(editorialSql, /Exactly one primary department is required/);
  assert.match(editorialSql, /Domain must belong to one of the selected departments/);
  assert.match(editorialSql, /relation_type,'USES'/);
});

test("editorial reads remain private to active editorial members", () => {
  assert.match(accessSql, /membership_status='ACTIVE'/);
  assert.match(accessSql, /'OWNER','ADMIN','EDITOR','REVIEWER'/);
  assert.doesNotMatch(accessSql, /to anon/i);
});

test("resource workflow is wired through the UI and RPC wrappers", () => {
  for (const name of ["saveContentEditorial", "submitContentForReview", "reviewContent", "publishContent"]) {
    assert.match(dataSource, new RegExp("export function " + name));
  }
  for (const route of ["contentEditorView", "data-content-submit", "data-content-review", "data-content-publish"]) {
    assert.ok(mainSource.includes(route), "missing UI workflow element: " + route);
  }
});
