import { Router } from "express";

import { healthRouter } from "./health.routes.js";
import { projectsRouter } from "./projects.routes.js";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/projects", projectsRouter);

export { apiRouter };
