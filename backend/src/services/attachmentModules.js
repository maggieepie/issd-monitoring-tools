/** @typedef {{ table: string; apiSegment: string }} AttachmentModuleConfig */

/** @type {Record<string, AttachmentModuleConfig>} */
const ATTACHMENT_MODULES = {
  projects: { table: "MONITORING_PROJECTS", apiSegment: "projects" },
  "dv-payments": { table: "MONITORING_DV_PAYMENTS", apiSegment: "dv-payments" },
  outgoing: { table: "MONITORING_OUTGOING", apiSegment: "outgoing" },
  policies: { table: "MONITORING_POLICIES", apiSegment: "policies" },
};

function getAttachmentModule(moduleKey) {
  const cfg = ATTACHMENT_MODULES[moduleKey];
  if (!cfg) {
    const err = new Error(`Unknown attachment module: ${moduleKey}`);
    err.status = 400;
    throw err;
  }
  return cfg;
}

export { ATTACHMENT_MODULES, getAttachmentModule };
