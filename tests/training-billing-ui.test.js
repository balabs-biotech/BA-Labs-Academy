import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const data=await readFile(new URL("../src/data.js",import.meta.url),"utf8");
test("billing controls are present in the training participant console",()=>{assert.match(main,/data-training-billing=/);assert.match(main,/data-training-billing-update=/);assert.match(main,/amount_da/);assert.match(main,/amount_minor_units/);});
test("billing actions call the governed billing RPC",()=>{assert.match(main,/saveTrainingBillingRecord/);assert.match(data,/academy_save_training_billing_record/);});
test("billing entry uses DZD centimes and status updates include an audit note",()=>{assert.match(main,/Math\.round\(amount\*100\)/);assert.match(main,/accounting_note/);});
