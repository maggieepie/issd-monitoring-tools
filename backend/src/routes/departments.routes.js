import { Router } from "express";

import * as departmentsController from "../controllers/departments.controller.js";

const departmentsRouter = Router();

departmentsRouter.get("/", departmentsController.list);
departmentsRouter.post("/", departmentsController.create);
departmentsRouter.put("/:id", departmentsController.update);
departmentsRouter.delete("/:id", departmentsController.remove);

export { departmentsRouter };
