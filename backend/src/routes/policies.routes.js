import { Router } from "express";

import { policyAttachmentHandlers } from "../controllers/attachments.controller.js";
import * as policiesController from "../controllers/policies.controller.js";
import { upload } from "../middleware/upload.js";

const policiesRouter = Router();

policiesRouter.get("/", policiesController.list);
policiesRouter.post("/", policiesController.create);
policiesRouter.put("/:id", policiesController.update);
policiesRouter.delete("/:id", policiesController.remove);
policiesRouter.get("/:id/attachments", policyAttachmentHandlers.list);
policiesRouter.post("/:id/attachments", upload.single("attachment"), policyAttachmentHandlers.upload);
policiesRouter.get("/:id/attachments/:attachmentId", policyAttachmentHandlers.getOne);
policiesRouter.delete("/:id/attachments/:attachmentId", policyAttachmentHandlers.removeOne);
policiesRouter.delete("/:id/attachments", policyAttachmentHandlers.removeAll);

export { policiesRouter };
