import cors from "cors";
import express from "express";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
  }),
);
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Monitoring Tools backend is running.",
  });
});

app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

export { app };
