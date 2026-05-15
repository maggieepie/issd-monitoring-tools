import { Router } from "express";

import { healthRouter } from "./health.routes.js";
import { dvPaymentsRouter } from "./dvPayments.routes.js";
import { departmentsRouter } from "./departments.routes.js";
import { outgoingRouter } from "./outgoing.routes.js";
import { projectsRouter } from "./projects.routes.js";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/dv-payments", dvPaymentsRouter);
apiRouter.use("/outgoing", outgoingRouter);
apiRouter.use("/departments", departmentsRouter);

export { apiRouter };
