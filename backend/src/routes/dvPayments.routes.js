import { Router } from "express";

import * as dvController from "../controllers/dvPayments.controller.js";

const dvPaymentsRouter = Router();

dvPaymentsRouter.get("/", dvController.list);
dvPaymentsRouter.post("/", dvController.create);
dvPaymentsRouter.put("/:id", dvController.update);
dvPaymentsRouter.delete("/:id", dvController.remove);

export { dvPaymentsRouter };
