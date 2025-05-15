import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client"
import logger from "../../config/logger"

const prisma = new PrismaClient()

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      logger.warn("Authentication failed: No token provided", {
        path: req.path,
        method: req.method,
        ip: req.ip,
      })
      return res.status(401).json({ message: "Authentication required" })
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as any
    logger.debug("Token verified", { userId: decoded.id })

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    })

    if (!user) {
      logger.warn("Authentication failed: User not found", { userId: decoded.id })
      return res.status(401).json({ message: "Authentication failed" })
    }

    // Add user to request
    req.user = user
    logger.debug("User authenticated successfully", {
      userId: user.id,
      path: req.path,
      method: req.method,
    })

    next()
  } catch (error) {
    logger.error(`Authentication error: ${error}`, {
      path: req.path,
      method: req.method,
      ip: req.ip,
    })
    res.status(401).json({ message: "Authentication failed" })
  }
}

// Middleware to check wallet ownership
export const walletAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.body

    if (!walletAddress) {
      logger.warn(`Wallet authentication failed: No wallet address`, { path: req.path })
      return res.status(400).json({ message: "Wallet address required" })
    }

    // In a real implementation, you would verify a signed message here
    // For now, we'll just check if the wallet exists in our database
    const wallet = await prisma.wallet.findUnique({
      where: { address: walletAddress },
      include: { user: true },
    })

    if (!wallet) {
      logger.warn(`Wallet authentication failed: Wallet not registered`, { walletAddress, path: req.path })
      return res.status(401).json({ message: "Wallet not registered" })
    }

    req.user = wallet.user
    logger.debug(`Wallet authenticated: ${walletAddress} for user: ${wallet.user.id}`, { path: req.path })
    next()
  } catch (error) {
    logger.error(`Wallet auth middleware error: ${error}`, { path: req.path })
    return res.status(401).json({ message: "Authentication failed" })
  }
}
