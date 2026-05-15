import { Router } from "express";

import * as departmentsController from "../controllers/departments.controller.js";

const departmentsRouter = Router();

departmentsRouter.get("/", departmentsController.list);
departmentsRouter.post("/", departmentsController.create);

export { departmentsRouter };
