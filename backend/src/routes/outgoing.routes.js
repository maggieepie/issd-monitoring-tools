import { Router } from "express";

import { outgoingAttachmentHandlers } from "../controllers/attachments.controller.js";
import * as outgoingController from "../controllers/outgoing.controller.js";
import { upload } from "../middleware/upload.js";

const outgoingRouter = Router();

outgoingRouter.get("/", outgoingController.list);
outgoingRouter.post("/", outgoingController.create);
outgoingRouter.put("/:id", outgoingController.update);
outgoingRouter.delete("/:id", outgoingController.remove);
outgoingRouter.get("/:id/attachments", outgoingAttachmentHandlers.list);
outgoingRouter.post("/:id/attachments", upload.single("attachment"), outgoingAttachmentHandlers.upload);
outgoingRouter.get("/:id/attachments/:attachmentId", outgoingAttachmentHandlers.getOne);
outgoingRouter.delete("/:id/attachments/:attachmentId", outgoingAttachmentHandlers.removeOne);
outgoingRouter.delete("/:id/attachments", outgoingAttachmentHandlers.removeAll);

export { outgoingRouter };
