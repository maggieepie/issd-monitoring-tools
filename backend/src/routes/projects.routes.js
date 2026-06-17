import { Router } from "express";

import { projectAttachmentHandlers } from "../controllers/attachments.controller.js";
import * as projectsController from "../controllers/projects.controller.js";
import { upload } from "../middleware/upload.js";

const projectsRouter = Router();

projectsRouter.get("/", projectsController.list);
projectsRouter.post("/", projectsController.create);
projectsRouter.put("/:id", projectsController.update);
projectsRouter.delete("/:id", projectsController.remove);
projectsRouter.get("/:id/attachments", projectAttachmentHandlers.list);
projectsRouter.post("/:id/attachments", upload.single("attachment"), projectAttachmentHandlers.upload);
projectsRouter.get("/:id/attachments/:attachmentId", projectAttachmentHandlers.getOne);
projectsRouter.delete("/:id/attachments/:attachmentId", projectAttachmentHandlers.removeOne);
projectsRouter.delete("/:id/attachments", projectAttachmentHandlers.removeAll);

export { projectsRouter };
