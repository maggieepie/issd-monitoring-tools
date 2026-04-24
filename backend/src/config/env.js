import dotenv from "dotenv";

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
};

export { env };
