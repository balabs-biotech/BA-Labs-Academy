import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const sql=await readFile(new URL("../supabase/migrations/20261121213000_academy_membership_governance_v1.sql",import.meta.url),"utf8");
const policySql=await readFile(new URL("../supabase/migrations/20261121214500_academy_membership_policy_no_recursion_v1.sql",import.meta.url),"utf8");
const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const data=await readFile(new URL("../src/data.js",import.meta.url),"utf8");
test("membership read policy avoids recursive RLS evaluation",()=>{
 assert.match(policySql,/academy_is_owner_or_admin/);
 assert.match(policySql,/security definer/);
});
test("membership changes require active Owner\/Admin and restrict Admin grants",()=>{
 assert.match(sql,/v_actor_role not in \('OWNER','ADMIN'\)/);
 assert.match(sql,/Admins may assign only Editor or Reviewer roles/);
 assert.match(sql,/At least one active Owner must remain/);
 assert.match(sql,/revoke all on function public\.academy_manage_membership[\s\S]*from public,anon/i);
});
test("first Owner bootstrap remains unavailable to browser roles",()=>{
 assert.match(sql,/academy_list_members/);
 assert.match(sql,/academy_manage_membership/);
 assert.doesNotMatch(sql,/grant execute on function public\.academy_bootstrap_first_owner[\s\S]*to authenticated/i);
});
test("member console uses controlled RPC and lists active administration data",()=>{
 assert.match(main,/membership-form/);
 assert.match(main,/data\.editorialMembers/);
 assert.match(data,/export function manageAcademyMembership/);
});
