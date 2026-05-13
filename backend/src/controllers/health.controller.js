import { getDbHealth } from "../db/oraclePool.js";

async function getHealth(_req, res) {
  const database = await getDbHealth();

  const payload = {
    status: database.status === "unavailable" ? "degraded" : "ok",
    service: "monitoring-tools-backend",
    timestamp: new Date().toISOString(),
    database,
  };

  res.json(payload);
}

export { getHealth };
