import { Router } from "express";

import { healthRouter } from "./health.routes.js";
import { dvPaymentsRouter } from "./dvPayments.routes.js";
import { projectsRouter } from "./projects.routes.js";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/dv-payments", dvPaymentsRouter);

export { apiRouter };
