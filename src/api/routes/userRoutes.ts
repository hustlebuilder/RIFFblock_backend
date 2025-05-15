import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"

const router = express.Router()
const prisma = new PrismaClient()

// Get user profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

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
      return res.status(404).json({ message: "User not found" })
    }

    res.json(user)
  } catch (error) {
    console.error("Error fetching user profile:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Update user profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { name, bio, location, ensName, image } = req.body

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

    res.json(updatedUser)
  } catch (error) {
    console.error("Error updating user profile:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Connect wallet to user
router.post("/connect-wallet", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { walletAddress } = req.body

    // Check if wallet already exists
    const existingWallet = await prisma.wallet.findUnique({
      where: { address: walletAddress },
    })

    if (existingWallet) {
      return res.status(400).json({ message: "Wallet already connected to a user" })
    }

    // Create new wallet connection
    const wallet = await prisma.wallet.create({
      data: {
        address: walletAddress,
        userId,
      },
    })

    res.json(wallet)
  } catch (error) {
    console.error("Error connecting wallet:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get user's riffs
router.get("/riffs", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const riffs = await prisma.riff.findMany({
      where: { userId },
      include: {
        nft: true,
        tips: true,
        stakingRecords: true,
        collection: true,
      },
    })

    res.json(riffs)
  } catch (error) {
    console.error("Error fetching user riffs:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get user's collections
router.get("/collections", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const collections = await prisma.collection.findMany({
      where: { userId },
      include: {
        riffs: true,
      },
    })

    res.json(collections)
  } catch (error) {
    console.error("Error fetching user collections:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get user's staking records
router.get("/staking", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

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

    res.json(stakingRecords)
  } catch (error) {
    console.error("Error fetching staking records:", error)
    res.status(500).json({ message: "Server error" })
  }
})

export const userRoutes = router
