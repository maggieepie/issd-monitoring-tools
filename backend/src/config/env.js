import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const oracleUser = process.env.ORACLE_USER?.trim();
const oraclePassword = process.env.ORACLE_PASSWORD;
const oracleConnectString = process.env.ORACLE_CONNECT_STRING?.trim();

const oracleEnabled = Boolean(
  oracleUser && oraclePassword && oracleConnectString,
);

const oracleThinRaw = process.env.ORACLE_THIN?.trim().toLowerCase();
const oracleThinExplicit =
  oracleThinRaw === "1" ||
  oracleThinRaw === "true" ||
  oracleThinRaw === "yes";

const oracleThickRaw = process.env.ORACLE_THICK?.trim().toLowerCase();
const oracleThickExplicit =
  oracleThickRaw === "1" ||
  oracleThickRaw === "true" ||
  oracleThickRaw === "yes";

function readOracleClientLibDir() {
  let raw = process.env.ORACLE_CLIENT_LIB_DIR?.trim();
  if (!raw) return undefined;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }
  return path.normalize(raw);
}

const oracleClientLibDir = readOracleClientLibDir();

const monitoringAutoDdlRaw = process.env.MONITORING_AUTO_DDL?.trim().toLowerCase();
const monitoringAutoDdl =
  monitoringAutoDdlRaw !== "0" &&
  monitoringAutoDdlRaw !== "false" &&
  monitoringAutoDdlRaw !== "no";

if (!oracleUser || !oraclePassword || !oracleConnectString) {
  if (fs.existsSync(envPath)) {
    const { size } = fs.statSync(envPath);
    if (size === 0) {
      console.warn(
        `Oracle: ${envPath} is empty on disk (0 bytes). Save the file in your editor, then restart the server.`,
      );
    } else {
      console.warn(
        `Oracle: ${envPath} was read but ORACLE_USER, ORACLE_PASSWORD, or ORACLE_CONNECT_STRING is missing or blank.`,
      );
    }
  } else {
    console.warn(
      `Oracle: ${envPath} not found. Copy .env.example to .env and add your Oracle settings.`,
    );
  }
}

const env = {
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  oracle: {
    enabled: oracleEnabled,
    user: oracleUser,
    password: oraclePassword,
    connectString: oracleConnectString,
    poolMin: Number(process.env.ORACLE_POOL_MIN || 0),
    poolMax: Number(process.env.ORACLE_POOL_MAX || 10),
    /**
     * Thick mode (Oracle Instant Client) is the default whenever Oracle is enabled.
     * Opt into Thin-only with ORACLE_THIN=1 (only for DB versions supported by Thin).
     */
    thickMode: oracleThinExplicit
      ? false
      : oracleThickExplicit || Boolean(oracleClientLibDir) || oracleEnabled,
    clientLibDir: oracleClientLibDir,
    /** When true (default), server startup creates MONITORING_PROJECTS if missing. Set MONITORING_AUTO_DDL=0 to skip. */
    monitoringAutoDdl,
  },
};

export { env };
