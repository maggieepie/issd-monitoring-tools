import { Router } from "express";

import * as projectsController from "../controllers/projects.controller.js";

const projectsRouter = Router();

projectsRouter.get("/", projectsController.list);
projectsRouter.post("/", projectsController.create);
projectsRouter.put("/:id", projectsController.update);
projectsRouter.delete("/:id", projectsController.remove);

export { projectsRouter };
