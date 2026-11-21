import test from "node:test";
import assert from "node:assert/strict";
import { buildAcademySearchIndex, searchAcademy } from "../src/features/search/index.js";

const data = {
  departments: [{ code: "BIO", slug: "biologie", title: "Biologie", summary: "Sciences du vivant" }],
  domains: [{ code: "MYCO", slug: "mycologie", department_code: "BIO", title: "Mycologie", summary: "Étude des champignons" }],
  content: [{ id: "r1", slug: "culture-pleurote", title: "Culture du Pleurote", summary: "Bases de culture fongique", resource_type: "COURSE" }],
  departmentLinks: [{ content_id: "r1", department_code: "BIO" }],
  domainLinks: [{ content_id: "r1", domain_code: "MYCO" }],
  learningPaths: [{ id: "p1", code: "PATH-01", slug: "initiation-mycologie", title: "Initiation à la mycologie", summary: "Parcours débutant" }],
  competencies: [{ id: "c1", code: "COMP-01", title: "Culture aseptique", description: "Maîtriser les gestes aseptiques" }],
  contentCompetencies: [{ competency_id: "c1", content_id: "r1" }]
};

test("search indexes all public academic entity types", () => {
  const index = buildAcademySearchIndex(data);
  assert.deepEqual(new Set(index.map((entry) => entry.type)), new Set([
    "DEPARTMENT", "DOMAIN", "RESOURCE", "PATHWAY", "COMPETENCY"
  ]));
});

test("search is accent-insensitive and returns related resources", () => {
  const results = searchAcademy("mycologie", data);
  assert.equal(results[0].type, "DOMAIN");
  assert.ok(results.some((entry) => entry.type === "RESOURCE"));
  assert.ok(results.some((entry) => entry.type === "PATHWAY"));
});

test("search uses linked department and competency metadata", () => {
  assert.ok(searchAcademy("biologie", data).some((entry) => entry.title === "Culture du Pleurote"));
  assert.equal(searchAcademy("aseptique", data)[0].type, "COMPETENCY");
});

test("empty and unmatched queries return no results", () => {
  assert.deepEqual(searchAcademy("   ", data), []);
  assert.deepEqual(searchAcademy("quantique", data), []);
});
