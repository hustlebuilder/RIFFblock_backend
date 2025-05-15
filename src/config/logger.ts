import winston from "winston"
import path from "path"
import fs from "fs"

// Ensure logs directory exists
const logDir = path.join(__dirname, "../../logs")
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
}

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    const metaStr = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : ""
    return `${timestamp} [${level}]: ${message} ${metaStr}`
})

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
}

// Determine log level based on environment
const level = () => {
    const env = process.env.NODE_ENV || "development"
    const isDevelopment = env === "development"
    return isDevelopment ? "debug" : "info"
}

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || level(),
    levels,
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
    ),
    defaultMeta: { service: "riffblock-api" },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: path.join(logDir, "error.log"),
            level: "error",
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),

        // Write all logs to combined.log
        new winston.transports.File({
            filename: path.join(logDir, "combined.log"),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, "exceptions.log"),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, "rejections.log"),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
    ],
})

// Add console transport in development environment
if (process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                logFormat,
            ),
        }),
    )
}

export default logger
