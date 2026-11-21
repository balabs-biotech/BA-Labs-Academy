export function buildPathProgress(items, progressRecords = []) {
  const requiredItems = items.filter((item) => item.is_required !== false);
  const completedIds = new Set(
    progressRecords
      .filter((record) => record.progress_status === "COMPLETED")
      .map((record) => record.path_item_id)
  );
  const completedRequired = requiredItems.filter((item) => completedIds.has(item.id)).length;
  const totalRequired = requiredItems.length;
  return {
    completedRequired,
    totalRequired,
    percent: totalRequired ? Math.round((completedRequired / totalRequired) * 100) : 0,
    isComplete: totalRequired > 0 && completedRequired === totalRequired
  };
}

export function resolvePathItems(items, prerequisites = [], progressRecords = []) {
  const progressByItemId = new Map(progressRecords.map((record) => [record.path_item_id, record]));
  const completedItemIds = new Set(
    items
      .filter((item) => progressByItemId.get(item.id)?.progress_status === "COMPLETED")
      .map((item) => item.id)
  );
  const prerequisitesByItem = new Map();
  for (const relation of prerequisites) {
    if (!prerequisitesByItem.has(relation.item_id)) prerequisitesByItem.set(relation.item_id, []);
    prerequisitesByItem.get(relation.item_id).push(relation.prerequisite_item_id);
  }

  return items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)))
    .map((item) => {
      const record = progressByItemId.get(item.id);
      const requiredIds = prerequisitesByItem.get(item.id) || [];
      const missingPrerequisiteIds = requiredIds.filter((id) => !completedItemIds.has(id));
      return {
        ...item,
        progressStatus: record?.progress_status || "NOT_STARTED",
        progressPercent: Number(record?.progress_percent || 0),
        isLocked: missingPrerequisiteIds.length > 0,
        missingPrerequisiteIds
      };
    });
}
