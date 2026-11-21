import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const taxonomy=await readFile(new URL("../supabase/migrations/20261122001000_academy_disciplinary_architecture_v2.sql",import.meta.url),"utf8");
const atlas=await readFile(new URL("../supabase/migrations/20261122002000_academy_disciplinary_atlas_sync_v1.sql",import.meta.url),"utf8");
test("Academy defines eight disciplinary pillars and transversal MYCOLOGIE",()=>{
 for(const code of ["MIC","BIO","AGR","BPR","BMT","GEN","INF","PHY","MYC"]) assert.match(taxonomy,new RegExp("'"+code+"'"));
 assert.match(taxonomy,/title='MYCOLOGIE'/);
 assert.match(taxonomy,/Pôle central et transversal relié aux huit autres disciplines/);
});
test("the legacy zootechny taxonomy is archived rather than deleted",()=>{
 assert.match(taxonomy,/code='ZOO'/);
 assert.match(taxonomy,/status='ARCHIVED'/);
});
test("new bioprocess, biomaterial and physical-chemical domains are scaffolded",()=>{
 for(const code of ["BPR-D01","BPR-D04","BMT-D01","BMT-D04","PHY-D01","PHY-D04"]) assert.match(taxonomy,new RegExp("'"+code+"'"));
});
test("Atlas links MYCOLOGIE to the eight pillars and rebuilds domain ownership edges",()=>{
 assert.match(taxonomy,/discipline\.entity_key in \('MIC','BIO','AGR','BPR','BMT','GEN','INF','PHY'\)/);
 assert.match(atlas,/relation_type='BELONGS_TO'/);
 assert.match(atlas,/domain_node\.id,department_node\.id,'BELONGS_TO'/);
});
