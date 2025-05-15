import express from "express"
import cors from "cors"
import helmet from "helmet"
import { PrismaClient } from "@prisma/client"
import { userRoutes } from "./api/routes/userRoutes"
import { riffRoutes } from "./api/routes/riffRoutes"
import { nftRoutes } from "./api/routes/nftRoutes"
import { stakingRoutes } from "./api/routes/stakingRoutes"
import { tokenRoutes } from "./api/routes/tokenRoutes"
import { captureResponseBody, httpLogger } from "./middleware/requestLogger"
import logger from "./config/logger"

// Initialize Express app
const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet()) // Security headers
app.use(cors()) // CORS
app.use(express.json()) // Parse JSON bodies
app.use(express.urlencoded({ extended: true })) // Parse URL-encoded bodies

// Request logging
app.use(captureResponseBody)
app.use(httpLogger)

// API routes
app.use("/api/users", userRoutes)
app.use("/api/riffs", riffRoutes)
app.use("/api/nfts", nftRoutes)
app.use("/api/staking", stakingRoutes)
app.use("/api/tokens", tokenRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  })

  res.status(500).json({
    message: "An unexpected error occurred",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  })
})

// Start server
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack })
  process.exit(1)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  process.exit(1)
})

export default app
