import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  level: isProduction ? "info" : "debug",
});

export default logger;
