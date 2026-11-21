const ROLE_CAPABILITIES = Object.freeze({
  OWNER: ["CREATE_CONTENT", "EDIT_CONTENT", "SUBMIT_REVIEW", "REVIEW_CONTENT", "PUBLISH_CONTENT", "MANAGE_MEMBERS"],
  ADMIN: ["CREATE_CONTENT", "EDIT_CONTENT", "SUBMIT_REVIEW", "REVIEW_CONTENT", "PUBLISH_CONTENT"],
  EDITOR: ["CREATE_CONTENT", "EDIT_CONTENT", "SUBMIT_REVIEW"],
  REVIEWER: ["REVIEW_CONTENT"]
});

export function getRoleCapabilities(role) {
  return [...(ROLE_CAPABILITIES[role] || [])];
}

export function hasEditorialAccess(membership) {
  return membership?.membership_status === "ACTIVE" &&
    getRoleCapabilities(membership.role).length > 0;
}
