import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const defaultLevel = isProduction ? "info" : "debug";

// An unknown LOG_LEVEL falls back to the default instead of crashing the
// server at startup, which is what pino does with a level it doesn't know.
const configuredLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
const level =
  configuredLevel && configuredLevel in pino.levels.values
    ? configuredLevel
    : defaultLevel;

const logger = pino({
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  level,
});

export default logger;
