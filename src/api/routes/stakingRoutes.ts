import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"
import logger from "../../config/logger"

const router = express.Router()
const prisma = new PrismaClient()

// Get all staking records for a riff
router.get("/riff/:riffId", async (req, res) => {
  try {
    const { riffId } = req.params
    logger.info(`Fetching staking records for riff: ${riffId}`)

    const stakingRecords = await prisma.staking.findMany({
      where: { riffId },
      include: {
        user: true,
      },
    })

    logger.debug(`Found ${stakingRecords.length} staking records for riff: ${riffId}`)
    res.json(stakingRecords)
  } catch (error) {
    logger.error(`Error fetching staking records: ${error}`, { riffId: req.params.riffId })
    res.status(500).json({ message: "Server error" })
  }
})

// Stake on a riff
router.post("/stake", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { riffId, amount } = req.body
    logger.info(`User ${userId} staking on riff: ${riffId}`, { amount })

    // Check if riff exists and is mintable
    const riff = await prisma.riff.findUnique({
      where: { id: riffId },
      include: {
        nft: true,
      },
    })

    if (!riff) {
      logger.warn(`Riff not found for staking: ${riffId}`)
      return res.status(404).json({ message: "Riff not found" })
    }

    if (!riff.nft) {
      logger.warn(`Attempted to stake on non-NFT riff: ${riffId}`)
      return res.status(400).json({ message: "Riff is not minted as an NFT" })
    }

    if (!riff.nft.enableStaking) {
      logger.warn(`Attempted to stake on riff with staking disabled: ${riffId}`)
      return res.status(400).json({ message: "Staking is not enabled for this riff" })
    }

    // Calculate unlock date (90 days from now)
    const unlockAt = new Date()
    unlockAt.setDate(unlockAt.getDate() + 90)
    logger.debug(`Setting unlock date for staking: ${unlockAt.toISOString()}`)

    // Create staking record
    const stakingRecord = await prisma.staking.create({
      data: {
        amount: Number.parseFloat(amount),
        riffId,
        userId,
        unlockAt,
      },
    })

    logger.info(`Staking record created successfully: ${stakingRecord.id}`, {
      userId,
      riffId,
      amount: stakingRecord.amount,
      unlockAt,
    })
    res.status(201).json(stakingRecord)
  } catch (error) {
    logger.error(`Error staking on riff: ${error}`, {
      userId: req.user?.id,
      riffId: req.body?.riffId,
      amount: req.body?.amount,
    })
    res.status(500).json({ message: "Server error" })
  }
})

// Unstake from a riff
router.post("/unstake/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    logger.info(`User ${userId} unstaking record: ${id}`)

    // Check if staking record exists and belongs to user
    const stakingRecord = await prisma.staking.findUnique({
      where: { id },
    })

    if (!stakingRecord) {
      logger.warn(`Staking record not found: ${id}`)
      return res.status(404).json({ message: "Staking record not found" })
    }

    if (stakingRecord.userId !== userId) {
      logger.warn(`Unauthorized unstaking attempt: ${id}`, {
        requestUserId: userId,
        ownerUserId: stakingRecord.userId,
      })
      return res.status(403).json({ message: "Not authorized to unstake this record" })
    }

    // Check if staking period is over
    const now = new Date()
    if (now < stakingRecord.unlockAt) {
      logger.warn(`Attempted to unstake before unlock date: ${id}`, {
        currentDate: now.toISOString(),
        unlockDate: stakingRecord.unlockAt.toISOString(),
      })
      return res.status(400).json({
        message: "Staking period not over yet",
        unlockAt: stakingRecord.unlockAt,
      })
    }

    // Update staking record status
    const updatedStakingRecord = await prisma.staking.update({
      where: { id },
      data: {
        status: "withdrawn",
      },
    })

    logger.info(`Staking record withdrawn successfully: ${id}`)
    res.json(updatedStakingRecord)
  } catch (error) {
    logger.error(`Error unstaking from riff: ${error}`, { id: req.params.id, userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Get staking statistics for a riff
router.get("/stats/:riffId", async (req, res) => {
  try {
    const { riffId } = req.params
    logger.info(`Fetching staking statistics for riff: ${riffId}`)

    // Get total staked amount
    const stakingRecords = await prisma.staking.findMany({
      where: {
        riffId,
        status: { not: "withdrawn" },
      },
    })

    const totalStaked = stakingRecords.reduce((sum, record) => sum + record.amount, 0)
    const stakersCount = new Set(stakingRecords.map((record) => record.userId)).size

    logger.debug(`Staking stats for riff ${riffId}`, {
      totalStaked,
      stakersCount,
      recordsCount: stakingRecords.length,
    })

    res.json({
      totalStaked,
      stakersCount,
      records: stakingRecords.length,
    })
  } catch (error) {
    logger.error(`Error fetching staking stats: ${error}`, { riffId: req.params.riffId })
    res.status(500).json({ message: "Server error" })
  }
})

export const stakingRoutes = router
