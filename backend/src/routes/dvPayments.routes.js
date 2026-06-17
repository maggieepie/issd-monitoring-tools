import { Router } from "express";

import { dvPaymentAttachmentHandlers } from "../controllers/attachments.controller.js";
import * as dvController from "../controllers/dvPayments.controller.js";
import { upload } from "../middleware/upload.js";

const dvPaymentsRouter = Router();

dvPaymentsRouter.get("/", dvController.list);
dvPaymentsRouter.post("/", dvController.create);
dvPaymentsRouter.put("/:id", dvController.update);
dvPaymentsRouter.delete("/:id", dvController.remove);
dvPaymentsRouter.get("/:id/attachments", dvPaymentAttachmentHandlers.list);
dvPaymentsRouter.post("/:id/attachments", upload.single("attachment"), dvPaymentAttachmentHandlers.upload);
dvPaymentsRouter.get("/:id/attachments/:attachmentId", dvPaymentAttachmentHandlers.getOne);
dvPaymentsRouter.delete("/:id/attachments/:attachmentId", dvPaymentAttachmentHandlers.removeOne);
dvPaymentsRouter.delete("/:id/attachments", dvPaymentAttachmentHandlers.removeAll);

export { dvPaymentsRouter };
