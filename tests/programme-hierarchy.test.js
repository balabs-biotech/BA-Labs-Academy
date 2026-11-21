import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const data=await readFile(new URL("../src/data.js",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20261122018000_academy_programme_hierarchy_v1.sql",import.meta.url),"utf8");
const depthMigration=await readFile(new URL("../supabase/migrations/20261122018200_academy_programme_hierarchy_depth_v1.sql",import.meta.url),"utf8");
const curriculumMigration=await readFile(new URL("../supabase/migrations/20261122019500_academy_programme_curriculum_mapping_v1.sql",import.meta.url),"utf8");
const pathMappingMigration=await readFile(new URL("../supabase/migrations/20261122019600_academy_programme_node_paths_v1.sql",import.meta.url),"utf8");
const identityMigration=await readFile(new URL("../supabase/migrations/20261122018300_academy_programme_node_identity_preservation_v1.sql",import.meta.url),"utf8");



test("programme hierarchy has its own curriculum entity and ordered tree",()=>{
 assert.match(migration,/create table if not exists public\.academy_programs/);
 assert.match(migration,/create table if not exists public\.academy_program_nodes/);
 assert.match(migration,/parent_node_id/);
 assert.match(depthMigration,/CHAPTER','SEQUENCE','LESSON','ACTIVITY/);
});

test("programme hierarchy enforces parent order and rejects missing parents or cycles",()=>{
 assert.match(depthMigration,/academy_validate_program_node_parent/);
 assert.match(depthMigration,/Programme hierarchy cannot move to the same or a higher level/);
 assert.match(depthMigration,/when 'ACTIVITY' then 10/);
 assert.match(migration,/Programme hierarchy contains a missing parent or cycle/);
});

test("programme scope spans departments while domains stay inside selected departments",()=>{
 assert.match(migration,/academy_program_departments/);
 assert.match(migration,/academy_program_domains/);
 assert.match(migration,/Programme domain must belong to one of its selected departments/);
 assert.match(migration,/exactly one must be primary/);
});

test("programme editor exposes the complete structure without authoring lessons",()=>{
 assert.match(main,/function programmeEditorView/);
 assert.match(main,/data-program-node-row/);
 assert.match(main,/data-program-node-parent/);
 assert.match(main,/CHAPTER/);
 assert.match(main,/SEQUENCE/);
 assert.match(main,/LESSON/);
 assert.match(main,/ACTIVITY/);
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

test("curriculum nodes have explicit competency, resource, assessment and path relationships",()=>{
 assert.match(curriculumMigration,/academy_program_node_competencies/);
 assert.match(curriculumMigration,/academy_program_node_resources/);
 assert.match(curriculumMigration,/academy_program_node_assessments/);
 assert.match(pathMappingMigration,/academy_program_node_paths/);
 assert.match(curriculumMigration,/academy_training_offering_program_node_fk/);
 assert.match(data,/editorialProgramNodeCompetencies/);
 assert.match(data,/editorialProgramNodeResources/);
 assert.match(data,/editorialProgramNodeAssessments/);
 assert.match(data,/editorialProgramNodePaths/);
});
test("curriculum mapping tables are protected by RLS and read-only outside controlled workflows",()=>{
 assert.match(curriculumMigration,/enable row level security/);
 assert.match(curriculumMigration,/Editors can read programme node competencies/);
 assert.match(curriculumMigration,/grant select on public\.academy_program_node_competencies/);
 assert.match(pathMappingMigration,/enable row level security/);
});
test("programme hierarchy preview is refreshed after initial load and structural edits",()=>{
 assert.match(main,/programme-hierarchy-preview/);
 assert.match(main,/refreshHierarchyPreview/);
});

test("editing a programme preserves stable node IDs for future curriculum links",()=>{
 assert.match(identityMigration,/select n\.id into v_node_id/);
 assert.match(identityMigration,/update public\.academy_program_nodes set parent_node_id/);
 assert.match(identityMigration,/stable node identifiers preserved/);
 assert.doesNotMatch(identityMigration,/delete from public\.academy_program_nodes where program_id=v_id/);
});
