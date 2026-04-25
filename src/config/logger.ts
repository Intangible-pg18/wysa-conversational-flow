import pino, {type LoggerOptions} from "pino";

import {env} from "./env.js";

const baseOptions: LoggerOptions = {
    level: env.LOG_LEVEL,
    redact: {
        paths: ["password", "*.password", "authorization", "*.authorization"],
        censor: "[REDACTED]"
    },
};

const transport =
  env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined;

    export const logger = pino ({
        ...baseOptions,
        ...(transport ? {transport} : {}),
    })