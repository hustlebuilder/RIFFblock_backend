import morgan from "morgan"
import type { NextFunction, Request, Response } from "express"
import logger from "../config/logger"

// Create a token for request body
morgan.token("req-body", (req: Request) => {
    const body = { ...req.body }

    // Redact sensitive information
    if (body.password) body.password = "[REDACTED]"
    if (body.token) body.token = "[REDACTED]"
    if (body.apiKey) body.apiKey = "[REDACTED]"

    return JSON.stringify(body)
})

// Create a token for response body (only in development)
morgan.token("res-body", (req: Request, res: Response) => {
    const rawBody = res.locals.rawBody
    if (!rawBody) return ""

    try {
        const body = JSON.parse(rawBody)

        // Redact sensitive information
        if (body.token) body.token = "[REDACTED]"
        if (body.password) body.password = "[REDACTED]"

        return JSON.stringify(body)
    } catch (e) {
        return rawBody
    }
})

// Create a token for response time in a more readable format
morgan.token("response-time-formatted", (req: Request, res: Response) => {
    const responseTime = res.getHeader("X-Response-Time");
    return typeof responseTime === "string" ? `${responseTime}` : "-";
});

// Define format for development
const developmentFormat = ":method :url :status :response-time-formatted - :req-body - :res-body"

// Define format for production (no bodies)
const productionFormat = ":remote-addr - :method :url :status :response-time-formatted"

// Create middleware to capture response body
const captureResponseBody = (req: Request, res: Response, next: Function) => {
    if (process.env.NODE_ENV !== "production") {
        const originalSend = res.send
        res.send = function (body) {
            res.locals.rawBody = body
            return originalSend.call(this, body)
        }
    }
    next()
}

// Create HTTP logger middleware
const httpLogger = (req: Request, res: Response, next: NextFunction) => {
    // Skip logging for health check endpoints
    if (req.path === "/health" || req.path === "/api/health") {
        return next()
    }

    const format = process.env.NODE_ENV === "production" ? productionFormat : developmentFormat

    morgan(format, {
        stream: {
            write: (message) => {
                logger.http(message.trim())
            },
        },
    })(req, res, next)
}

export { captureResponseBody, httpLogger }
