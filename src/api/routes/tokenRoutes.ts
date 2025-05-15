import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"
import logger from "../../config/logger"

const router = express.Router()
const prisma = new PrismaClient()

// Get token info
router.get("/info", async (req, res) => {
  try {
    logger.info("Fetching token info")

    const token = await prisma.token.findFirst({
      where: { symbol: "RIFF" },
    })

    if (!token) {
      logger.warn("Token info not found")
      return res.status(404).json({ message: "Token info not found" })
    }

    logger.debug("Token info retrieved", {
      symbol: token.symbol,
      totalSupply: token.totalSupply,
      // circulatingSupply: token.circulatingSupply,
    })
    res.json(token)
  } catch (error) {
    logger.error(`Error fetching token info: ${error}`)
    res.status(500).json({ message: "Server error" })
  }
})

// Buy tokens (simulated)
router.post("/buy", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { amount, currency } = req.body
    logger.info(`User ${userId} buying tokens`, { amount, currency })

    // In a real implementation, this would interact with a payment processor
    // and blockchain to actually purchase tokens

    // For now, we'll just return a simulated transaction
    const riffAmount = Number.parseFloat(amount) * 23.8095 // Simulated exchange rate
    const transactionId = `tx_${Date.now()}`

    logger.debug(`Token purchase simulation`, {
      transactionId,
      amount,
      riffAmount,
      currency,
      userId,
    })

    res.json({
      success: true,
      transaction: {
        id: transactionId,
        amount: Number.parseFloat(amount),
        riffAmount,
        currency,
        timestamp: new Date(),
      },
    })

    logger.info(`Token purchase simulated successfully: ${transactionId}`)
  } catch (error) {
    logger.error(`Error buying tokens: ${error}`, {
      userId: req.user?.id,
      amount: req.body?.amount,
      currency: req.body?.currency,
    })
    res.status(500).json({ message: "Server error" })
  }
})

// Tip an artist
router.post("/tip", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { riffId, amount, message } = req.body
    logger.info(`User ${userId} tipping for riff: ${riffId}`, { amount })

    // Check if riff exists
    const riff = await prisma.riff.findUnique({
      where: { id: riffId },
    })

    if (!riff) {
      logger.warn(`Riff not found for tipping: ${riffId}`)
      return res.status(404).json({ message: "Riff not found" })
    }

    logger.debug(`Tipping artist ${riff.userId} for riff ${riffId}`, {
      fromUserId: userId,
      amount,
      hasMessage: !!message,
    })

    // Create tip record
    const tip = await prisma.tip.create({
      data: {
        amount: Number.parseFloat(amount),
        riffId,
        userId,
        message,
      },
    })

    logger.info(`Tip created successfully: ${tip.id}`, {
      fromUserId: userId,
      toUserId: riff.userId,
      riffId,
      amount: tip.amount,
    })
    res.status(201).json(tip)
  } catch (error) {
    logger.error(`Error tipping artist: ${error}`, {
      userId: req.user?.id,
      riffId: req.body?.riffId,
      amount: req.body?.amount,
    })
    res.status(500).json({ message: "Server error" })
  }
})

export const tokenRoutes = router
