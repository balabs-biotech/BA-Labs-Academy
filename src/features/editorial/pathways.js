export function buildPathwayItems(selectedContentIds, existingItems = [], existingPrerequisites = []) {
  const selected = new Set(selectedContentIds);
  const existingByContent = new Map(existingItems.map((item) => [item.content_id, item]));
  const existingById = new Map(existingItems.map((item) => [item.id, item]));

  return selectedContentIds.map((contentId) => {
    const current = existingByContent.get(contentId);
    const prerequisites = current
      ? existingPrerequisites
          .filter((link) => link.item_id === current.id)
          .map((link) => existingById.get(link.prerequisite_item_id)?.content_id)
          .filter((id) => id && selected.has(id))
      : [];

    return {
      content_id: contentId,
      is_required: current?.is_required ?? true,
      prerequisites: [...new Set(prerequisites)]
    };
  });
}
