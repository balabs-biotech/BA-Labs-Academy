import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const API = `${SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  Accept: "application/json",
};

async function readTable(table, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${API}/${table}?${query}`, { headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Lecture ${table} impossible (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

function resolveAtlasTitles(nodes, departments, domains, content, learningPaths, competencies) {
  const titles = new Map();
  for (const item of departments) titles.set(`DEPARTMENT:${item.code}`, item.title);
  for (const item of domains) titles.set(`DOMAIN:${item.code}`, item.title);
  for (const item of learningPaths) {
    titles.set(`PATHWAY:${item.code}`, item.title);
    titles.set(`PATHWAY:${item.slug}`, item.title);
  }
  for (const item of competencies) {
    titles.set(`SKILL:${item.code}`, item.title);
  }
  for (const item of content) {
    titles.set(`CONTENT:${item.business_id}`, item.title);
    titles.set(`MODULE:${item.business_id}`, item.title);
    titles.set(`CONTENT:${item.slug}`, item.title);
    titles.set(`MODULE:${item.slug}`, item.title);
  }
  return nodes.map((node) => ({
    ...node,
    title: titles.get(`${node.entity_type}:${node.entity_key}`) ||
      node.title_override || node.entity_key || node.node_key
  }));
}

export async function loadAcademyData() {
  const [departments, domains, content, departmentLinks, domainLinks, learningPaths, pathItems, pathPrerequisites, competencies, contentCompetencies, rawNodes, edges] = await Promise.all([
    readTable("departments", {
      select: "code,slug,title,summary,color_token,sort_order",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "sort_order.asc"
    }),
    readTable("domains", {
      select: "code,slug,department_code,title,summary,sort_order",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "sort_order.asc"
    }),
    readTable("content_items", {
      select: "id,business_id,slug,title,summary,resource_type,language_code,learning_level,version_label,published_at,destination_url",
      status: "eq.PUBLISHED",
      editorial_status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "published_at.desc"
    }),
    readTable("content_department_links", {
      select: "content_id,department_code,is_primary"
    }),
    readTable("content_domain_links", {
      select: "content_id,domain_code"
    }),
    readTable("academy_learning_paths", {
      select: "id,code,slug,title,summary,target_audience,difficulty_level,estimated_duration_minutes,version_label,published_at",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "title.asc"
    }),
    readTable("academy_learning_path_items", {
      select: "id,path_id,content_id,sort_order,is_required",
      order: "sort_order.asc"
    }),
    readTable("academy_path_item_prerequisites", {
      select: "path_id,item_id,prerequisite_item_id"
    }),
    readTable("academy_competencies", {
      select: "id,code,title,description,competency_level",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "title.asc"
    }),
    readTable("academy_content_competencies", {
      select: "content_id,competency_id,expected_level,assessment_hint"
    }),
    readTable("atlas_nodes", {
      select: "id,node_key,entity_type,entity_key,title_override,position_x,position_y,layout_version",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC"
    }),
    readTable("atlas_edges", {
      select: "id,source_node_id,target_node_id,relation_type,rationale",
      status: "eq.PUBLISHED"
    })
  ]);
  const nodes = resolveAtlasTitles(rawNodes, departments, domains, content, learningPaths, competencies);
  return {
    departments, domains, content, departmentLinks, domainLinks,
    learningPaths, pathItems, pathPrerequisites, competencies, contentCompetencies,
    nodes, edges
  };
}
