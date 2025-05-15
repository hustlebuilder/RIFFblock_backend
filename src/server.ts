import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { userRoutes } from "./api/routes/userRoutes"
import { riffRoutes } from "./api/routes/riffRoutes"
import { nftRoutes } from "./api/routes/nftRoutes"
import { stakingRoutes } from "./api/routes/stakingRoutes"
import { tokenRoutes } from "./api/routes/tokenRoutes"
import { authMiddleware } from "./api/middleware/authMiddleware"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use("/api/users", userRoutes)
app.use("/api/riffs", riffRoutes)
app.use("/api/nfts", nftRoutes)
app.use("/api/staking", stakingRoutes)
app.use("/api/tokens", tokenRoutes)

// Protected routes example
app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user })
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
