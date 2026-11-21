import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import { getAccessToken, getCurrentUser } from "./core/auth.js";

const API = `${SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  Accept: "application/json",
};

async function readTable(table, params, accessToken = null) {
  const query = new URLSearchParams(params);
  const requestHeaders = {
    ...headers,
    Authorization: `Bearer ${accessToken || SUPABASE_PUBLISHABLE_KEY}`
  };
  const response = await fetch(`${API}/${table}?${query}`, { headers: requestHeaders });
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
  const accessToken = await getAccessToken();
  const memberData = accessToken
    ? Promise.all([
        readTable("academy_path_enrollments", {
          select: "path_id,enrollment_status,enrolled_at,completed_at",
          order: "enrolled_at.desc"
        }, accessToken),
        readTable("academy_member_progress", {
          select: "content_id,progress_status,progress_percent,started_at,completed_at,last_accessed_at",
          order: "last_accessed_at.desc"
        }, accessToken),
        readTable("academy_memberships", {
          select: "role,membership_status"
        }, accessToken),
        readTable("academy_path_item_progress", {
          select: "path_item_id,progress_status,progress_percent,started_at,completed_at,last_accessed_at",
          order: "last_accessed_at.desc"
        }, accessToken)
      ]).then(([enrollments, progress, memberships, pathItemProgress]) => ({
        enrollments, progress, pathItemProgress, membership: memberships[0] || null, error: null
      })).catch((error) => ({
        enrollments: [], progress: [], pathItemProgress: [], membership: null, error: error.message
      }))
    : Promise.resolve({ enrollments: [], progress: [], pathItemProgress: [], membership: null, error: null });
  const [departments, domains, content, departmentLinks, domainLinks, learningPaths, pathItems, pathPrerequisites, competencies, contentCompetencies, rawNodes, edges, memberRecords] = await Promise.all([
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
    }),
    memberData
  ]);
  const { enrollments, progress, pathItemProgress, membership, error: memberError } = memberRecords;
  const editorialPaths = accessToken
    ? await readTable("academy_learning_paths", {
        select: "id,code,slug,title,summary,target_audience,difficulty_level,estimated_duration_minutes,version_label,status,visibility,published_at,updated_at",
        order: "updated_at.desc"
      }, accessToken).catch(() => [])
    : [];
  const nodes = resolveAtlasTitles(rawNodes, departments, domains, content, learningPaths, competencies);
  return {
    departments, domains, content, departmentLinks, domainLinks,
    learningPaths, editorialPaths, pathItems, pathPrerequisites, competencies, contentCompetencies,
    enrollments, progress, pathItemProgress, membership, memberError, nodes, edges
  };
}

async function writeMemberRecord(table, payload, conflictColumns) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Connecte-toi pour enregistrer ta progression.");
  const response = await fetch(`${API}/${table}?on_conflict=${conflictColumns}`, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Enregistrement impossible (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

export async function enrollInPath(pathId) {
  const user = await getCurrentUser();
  if (!user?.id) throw new Error("Session apprenant introuvable.");
  return writeMemberRecord("academy_path_enrollments", {
    user_id: user.id,
    path_id: pathId,
    enrollment_status: "ACTIVE",
    completed_at: null,
    updated_at: new Date().toISOString()
  }, "user_id,path_id");
}

export async function saveResourceProgress(contentId, completed = true) {
  const user = await getCurrentUser();
  if (!user?.id) throw new Error("Session apprenant introuvable.");
  const now = new Date().toISOString();
  return writeMemberRecord("academy_member_progress", {
    user_id: user.id,
    content_id: contentId,
    progress_status: completed ? "COMPLETED" : "IN_PROGRESS",
    progress_percent: completed ? 100 : 10,
    started_at: now,
    completed_at: completed ? now : null,
    last_accessed_at: now
  }, "user_id,content_id");
}

export async function savePathItemProgress(pathItemId, completed = true) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Connecte-toi pour enregistrer ta progression.");
  const response = await fetch(`${API}/rpc/academy_record_path_item_progress`, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_path_item_id: pathItemId,
      p_completed: completed
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Validation de l’étape impossible (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}


async function callEditorialRpc(name, payload, errorLabel) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Connecte-toi pour accéder à l’espace éditorial.");
  const response = await fetch(`${API}/rpc/${name}`, {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${errorLabel} (HTTP ${response.status})${detail ? `: ${detail.slice(0, 220)}` : ""}`);
  }
  return response.json();
}
export function saveLearningPathDraft(path) {
  return callEditorialRpc("academy_save_learning_path_draft", {
    p_path_id: path.id || null, p_code: path.code, p_slug: path.slug, p_title: path.title,
    p_summary: path.summary || "", p_target_audience: path.targetAudience || "",
    p_difficulty_level: path.difficultyLevel || "FOUNDATION",
    p_estimated_duration_minutes: path.durationMinutes ? Number(path.durationMinutes) : null,
    p_version_label: path.versionLabel || "0.1"
  }, "Enregistrement du parcours impossible");
}
export function saveLearningPathItems(pathId, items) {
  return callEditorialRpc("academy_save_learning_path_items", { p_path_id: pathId, p_items: items },
    "Enregistrement de la séquence impossible");
}
export function publishLearningPath(pathId, note = "") {
  return callEditorialRpc("academy_publish_learning_path", { p_path_id: pathId, p_note: note },
    "Publication du parcours impossible");
}
