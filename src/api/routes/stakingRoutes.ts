import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"

const router = express.Router()
const prisma = new PrismaClient()

// Get all staking records for a riff
router.get("/riff/:riffId", async (req, res) => {
  try {
    const { riffId } = req.params

    const stakingRecords = await prisma.staking.findMany({
      where: { riffId },
      include: {
        user: true,
      },
    })

    res.json(stakingRecords)
  } catch (error) {
    console.error("Error fetching staking records:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Stake on a riff
router.post("/stake", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { riffId, amount } = req.body

    // Check if riff exists and is mintable
    const riff = await prisma.riff.findUnique({
      where: { id: riffId },
      include: {
        nft: true,
      },
    })

    if (!riff) {
      return res.status(404).json({ message: "Riff not found" })
    }

    if (!riff.nft) {
      return res.status(400).json({ message: "Riff is not minted as an NFT" })
    }

    if (!riff.nft.enableStaking) {
      return res.status(400).json({ message: "Staking is not enabled for this riff" })
    }

    // Calculate unlock date (90 days from now)
    const unlockAt = new Date()
    unlockAt.setDate(unlockAt.getDate() + 90)

    // Create staking record
    const stakingRecord = await prisma.staking.create({
      data: {
        amount: Number.parseFloat(amount),
        riffId,
        userId,
        unlockAt,
      },
    })

    res.status(201).json(stakingRecord)
  } catch (error) {
    console.error("Error staking on riff:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Unstake from a riff
router.post("/unstake/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Check if staking record exists and belongs to user
    const stakingRecord = await prisma.staking.findUnique({
      where: { id },
    })

    if (!stakingRecord) {
      return res.status(404).json({ message: "Staking record not found" })
    }

    if (stakingRecord.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to unstake this record" })
    }

    // Check if staking period is over
    const now = new Date()
    if (now < stakingRecord.unlockAt) {
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

    res.json(updatedStakingRecord)
  } catch (error) {
    console.error("Error unstaking from riff:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get staking statistics for a riff
router.get("/stats/:riffId", async (req, res) => {
  try {
    const { riffId } = req.params

    // Get total staked amount
    const stakingRecords = await prisma.staking.findMany({
      where: {
        riffId,
        status: { not: "withdrawn" },
      },
    })

    const totalStaked = stakingRecords.reduce((sum, record) => sum + record.amount, 0)
    const stakersCount = new Set(stakingRecords.map((record) => record.userId)).size

    res.json({
      totalStaked,
      stakersCount,
      records: stakingRecords.length,
    })
  } catch (error) {
    console.error("Error fetching staking stats:", error)
    res.status(500).json({ message: "Server error" })
  }
})

export const stakingRoutes = router
