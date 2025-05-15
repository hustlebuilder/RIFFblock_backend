import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"

const router = express.Router()
const prisma = new PrismaClient()

// Get token info
router.get("/info", async (req, res) => {
  try {
    const token = await prisma.token.findFirst({
      where: { symbol: "RIFF" },
    })

    if (!token) {
      return res.status(404).json({ message: "Token info not found" })
    }

    res.json(token)
  } catch (error) {
    console.error("Error fetching token info:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Buy tokens (simulated)
router.post("/buy", authMiddleware, async (req, res) => {
  try {
    const { amount, currency } = req.body

    // In a real implementation, this would interact with a payment processor
    // and blockchain to actually purchase tokens

    // For now, we'll just return a simulated transaction
    res.json({
      success: true,
      transaction: {
        id: `tx_${Date.now()}`,
        amount: Number.parseFloat(amount),
        riffAmount: Number.parseFloat(amount) * 23.8095, // Simulated exchange rate
        currency,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    console.error("Error buying tokens:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Tip an artist
router.post("/tip", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { riffId, amount, message } = req.body

    // Check if riff exists
    const riff = await prisma.riff.findUnique({
      where: { id: riffId },
    })

    if (!riff) {
      return res.status(404).json({ message: "Riff not found" })
    }

    // Create tip record
    const tip = await prisma.tip.create({
      data: {
        amount: Number.parseFloat(amount),
        riffId,
        userId,
        message,
      },
    })

    res.status(201).json(tip)
  } catch (error) {
    console.error("Error tipping artist:", error)
    res.status(500).json({ message: "Server error" })
  }
})

export const tokenRoutes = router
