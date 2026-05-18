import { Router } from "express";

import * as policiesController from "../controllers/policies.controller.js";

const policiesRouter = Router();

policiesRouter.get("/", policiesController.list);
policiesRouter.post("/", policiesController.create);
policiesRouter.put("/:id", policiesController.update);
policiesRouter.delete("/:id", policiesController.remove);

export { policiesRouter };
