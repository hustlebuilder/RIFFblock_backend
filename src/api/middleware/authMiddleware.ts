import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client"

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
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" })
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "Authentication token missing" })
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "default_secret")

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    })

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    req.user = user
    next()
  } catch (error) {
    console.error("Auth middleware error:", error)
    return res.status(401).json({ message: "Invalid or expired token" })
  }
}

// Middleware to check wallet ownership
export const walletAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.body

    if (!walletAddress) {
      return res.status(400).json({ message: "Wallet address required" })
    }

    // In a real implementation, you would verify a signed message here
    // For now, we'll just check if the wallet exists in our database
    const wallet = await prisma.wallet.findUnique({
      where: { address: walletAddress },
      include: { user: true },
    })

    if (!wallet) {
      return res.status(401).json({ message: "Wallet not registered" })
    }

    req.user = wallet.user
    next()
  } catch (error) {
    console.error("Wallet auth middleware error:", error)
    return res.status(401).json({ message: "Authentication failed" })
  }
}
