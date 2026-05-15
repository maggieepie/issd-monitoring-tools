import { Router } from "express";

import * as outgoingController from "../controllers/outgoing.controller.js";

const outgoingRouter = Router();

outgoingRouter.get("/", outgoingController.list);
outgoingRouter.post("/", outgoingController.create);
outgoingRouter.put("/:id", outgoingController.update);
outgoingRouter.delete("/:id", outgoingController.remove);

export { outgoingRouter };
