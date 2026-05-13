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

if (
  !oracleUser ||
  !oraclePassword ||
  !oracleConnectString
) {
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

const oracleThickRaw = process.env.ORACLE_THICK?.trim().toLowerCase();
const oracleThickExplicit =
  oracleThickRaw === "1" ||
  oracleThickRaw === "true" ||
  oracleThickRaw === "yes";
const oracleClientLibDir = process.env.ORACLE_CLIENT_LIB_DIR?.trim();

const env = {
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  oracle: {
    enabled: Boolean(oracleUser && oraclePassword && oracleConnectString),
    user: oracleUser,
    password: oraclePassword,
    connectString: oracleConnectString,
    poolMin: Number(process.env.ORACLE_POOL_MIN || 0),
    poolMax: Number(process.env.ORACLE_POOL_MAX || 10),
    /** Thick mode uses Oracle Instant Client (required for many older DB versions; fixes NJS-138 in Thin). */
    thickMode: oracleThickExplicit || Boolean(oracleClientLibDir),
    clientLibDir: oracleClientLibDir,
  },
};

export { env };
