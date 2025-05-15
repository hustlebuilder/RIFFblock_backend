import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"
import logger from "../../config/logger"

const router = express.Router()
const prisma = new PrismaClient()

// Get user profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Fetching profile for user ${userId}`)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: true,
        riffs: {
          include: {
            nft: true,
            tips: true,
            stakingRecords: true,
          },
        },
        collections: {
          include: {
            riffs: true,
          },
        },
      },
    })

    if (!user) {
      logger.warn(`User not found: ${userId}`)
      return res.status(404).json({ message: "User not found" })
    }

    logger.debug(`User profile fetched successfully: ${userId}`)
    res.json(user)
  } catch (error) {
    logger.error(`Error fetching user profile: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Update user profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { name, bio, location, ensName, image } = req.body

    logger.info(`Updating profile for user ${userId}`)
    logger.debug("Profile update data", { name, bio, location, ensName, hasImage: !!image })

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        bio,
        location,
        ensName,
        image,
      },
    })

    logger.info(`Profile updated successfully for user ${userId}`)
    res.json(updatedUser)
  } catch (error) {
    logger.error(`Error updating user profile: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Connect wallet to user
router.post("/connect-wallet", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { walletAddress } = req.body

    logger.info(`Connecting wallet for user ${userId}`, { walletAddress })

    // Check if wallet already exists
    const existingWallet = await prisma.wallet.findUnique({
      where: { address: walletAddress },
    })

    if (existingWallet) {
      logger.warn(`Wallet already connected to a user: ${walletAddress}`)
      return res.status(400).json({ message: "Wallet already connected to a user" })
    }

    // Create new wallet connection
    const wallet = await prisma.wallet.create({
      data: {
        address: walletAddress,
        userId,
      },
    })

    logger.info(`Wallet connected successfully: ${walletAddress}`)
    res.json(wallet)
  } catch (error) {
    logger.error(`Error connecting wallet: ${error}`, {
      userId: req.user?.id,
      walletAddress: req.body?.walletAddress,
    })
    res.status(500).json({ message: "Server error" })
  }
})

// Get user's riffs
router.get("/riffs", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Fetching riffs for user ${userId}`)

    const riffs = await prisma.riff.findMany({
      where: { userId },
      include: {
        nft: true,
        tips: true,
        stakingRecords: true,
        collection: true,
      },
    })

    logger.debug(`Found ${riffs.length} riffs for user ${userId}`)
    res.json(riffs)
  } catch (error) {
    logger.error(`Error fetching user riffs: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Get user's collections
router.get("/collections", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Fetching collections for user ${userId}`)

    const collections = await prisma.collection.findMany({
      where: { userId },
      include: {
        riffs: true,
      },
    })

    logger.debug(`Found ${collections.length} collections for user ${userId}`)
    res.json(collections)
  } catch (error) {
    logger.error(`Error fetching user collections: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Get user's staking records
router.get("/staking", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Fetching staking records for user ${userId}`)

    const stakingRecords = await prisma.staking.findMany({
      where: { userId },
      include: {
        riff: {
          include: {
            user: true,
            nft: true,
          },
        },
      },
    })

    logger.debug(`Found ${stakingRecords.length} staking records for user ${userId}`)
    res.json(stakingRecords)
  } catch (error) {
    logger.error(`Error fetching staking records: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

export const userRoutes = router
