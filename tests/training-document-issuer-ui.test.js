import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const sql=await readFile(new URL("../supabase/migrations/20261122016000_academy_training_document_lifecycle_v1.sql",import.meta.url),"utf8");
test("training document UI requires an explicit issuer for partner routes",()=>{assert.match(main,/name="issuer_kind"/);assert.match(main,/name="issuer_reference"/);assert.match(main,/v\.get\("issuer_kind"\)/);assert.match(main,/v\.get\("issuer_reference"\)/);});
test("private workshop documents are explicitly issued by BA Labs",()=>{assert.match(main,/value="BA_LABS_PRIVATE"/);});
test("partner and authority issuance types are constrained by backend",()=>{assert.match(sql,/k='APPROVED_PARTNER'/);assert.match(sql,/k='PUBLIC_AUTHORITY'/);assert.match(sql,/a\.document_issuer<>'PARTNER'/);assert.match(sql,/p_document_type<>'STATE_RECOGNIZED_CERTIFICATE'/);});
