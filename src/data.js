import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const API = `${SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  Accept: "application/json",
};

async function readTable(table, query) {
  const response = await fetch(`${API}/${table}?${query}`, { headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Lecture ${table} impossible (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

export async function loadAcademyData() {
  const [departments, domains, content, nodes, edges] = await Promise.all([
    readTable("departments", "select=code,slug,title,summary,color_token,sort_order&status=eq.PUBLISHED&visibility=eq.PUBLIC&order=sort_order.asc"),
    readTable("domains", "select=code,slug,department_code,title,summary,sort_order&status=eq.PUBLISHED&visibility=eq.PUBLIC&order=sort_order.asc"),
    readTable("content_items", "select=id,business_id,slug,title,summary,resource_type,language_code,learning_level,version_label,published_at&status=eq.PUBLISHED&editorial_status=eq.PUBLISHED&visibility=eq.PUBLIC&order=published_at.desc"),
    readTable("atlas_nodes", "select=id,node_key,entity_type,entity_key,title_override,position_x,position_y,layout_version&status=eq.PUBLISHED&visibility=eq.PUBLIC"),
    readTable("atlas_edges", "select=id,source_node_id,target_node_id,relation_type,rationale&status=eq.PUBLISHED"),
  ]);
  return { departments, domains, content, nodes, edges };
}
