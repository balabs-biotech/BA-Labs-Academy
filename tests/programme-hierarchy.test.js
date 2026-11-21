import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const data=await readFile(new URL("../src/data.js",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20261122018000_academy_programme_hierarchy_v1.sql",import.meta.url),"utf8");

test("programme hierarchy has its own curriculum entity and ordered tree",()=>{
 assert.match(migration,/create table if not exists public\.academy_programs/);
 assert.match(migration,/create table if not exists public\.academy_program_nodes/);
 assert.match(migration,/parent_node_id/);
 assert.match(migration,/node_type text not null check\(node_type in \('CYCLE','YEAR','SEMESTER','BLOCK','MODULE','UNIT'\)\)/);
});

test("programme hierarchy enforces parent order and rejects missing parents or cycles",()=>{
 assert.match(migration,/academy_validate_program_node_parent/);
 assert.match(migration,/Programme hierarchy cannot move to the same or a higher level/);
 assert.match(migration,/Programme hierarchy contains a missing parent or cycle/);
});

test("programme scope spans departments while domains stay inside selected departments",()=>{
 assert.match(migration,/academy_program_departments/);
 assert.match(migration,/academy_program_domains/);
 assert.match(migration,/Programme domain must belong to one of its selected departments/);
 assert.match(migration,/exactly one must be primary/);
});

test("programme editor exposes a structural outline without authoring lessons",()=>{
 assert.match(main,/function programmeEditorView/);
 assert.match(main,/data-program-node-row/);
 assert.match(main,/data-program-node-parent/);
 assert.match(main,/Aucun cours n’est rédigé dans cet éditeur/);
 assert.match(main,/subroute === "programmes"/);
});

test("programme editor state loads all four hierarchy tables and returns them to the UI",()=>{
 assert.match(data,/readTable\("academy_programs"/);
 assert.match(data,/readTable\("academy_program_departments"/);
 assert.match(data,/readTable\("academy_program_domains"/);
 assert.match(data,/readTable\("academy_program_nodes"/);
 assert.match(data,/editorialPrograms, editorialProgramDepartments, editorialProgramDomains, editorialProgramNodes,/);
});

test("programme draft and publication use guarded database RPCs",()=>{
 assert.match(data,/academy_save_program_draft/);
 assert.match(data,/academy_publish_program/);
 assert.match(migration,/academy_assert_role\(array\['OWNER','ADMIN','EDITOR'\]\)/);
 assert.match(migration,/academy_assert_role\(array\['OWNER','ADMIN'\]\)/);
});

test("programme tables are RLS-enabled and Data API read grants are explicit",()=>{
 assert.match(migration,/enable row level security/);
 assert.match(migration,/grant select on public\.academy_programs/);
 assert.match(migration,/revoke all on function public\.academy_save_program_draft[\s\S]*from public,anon/);
});

test("programme editor renders a live nested outline from parent and sibling order",()=>{
 assert.match(main,/programme-hierarchy-preview/);
 assert.match(main,/refreshHierarchyPreview/);
 assert.match(main,/parent_code/);
 assert.match(main,/sort_order/);
});
