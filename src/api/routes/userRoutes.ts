import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"
import logger from "../../config/logger"
import { z } from "zod" // For input validation

const router = express.Router()
const prisma = new PrismaClient()

// Input validation schemas
const stakingSettingsSchema = z.object({
  stakingEnabled: z.boolean(),
  defaultRoyalty: z.number().min(0).max(100),
  minimumStake: z.number().min(0),
  marketplaceRoyalty: z.boolean(),
  remixesRoyalty: z.boolean(),
  derivativesRoyalty: z.boolean(),
  collaborationsRoyalty: z.boolean(),
  licensingRoyalty: z.boolean(),
})

const tippingTierSchema = z.object({
  name: z.string().min(1).max(50),
  amount: z.number().min(0),
  description: z.string().min(1).max(500),
  perks: z.array(z.string()),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
})

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
        stakingSettings: true,
        tippingTiers: true,
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
        likes: true,
        comments: true,
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

// Get current user's activity
router.get("/activity", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Fetching activity for user ${userId}`)

    const activities = await prisma.activity.findMany({
      where: {
        OR: [{ userId }, { targetUserId: userId }],
      },
      include: {
        user: true,
        targetUser: true,
        riff: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    })

    logger.debug(`Found ${activities.length} activities for user ${userId}`)
    res.json(activities)
  } catch (error) {
    logger.error(`Error fetching user activity: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Get specific user's activity (public)
router.get("/:userId/activity", async (req, res) => {
  try {
    const { userId } = req.params
    logger.info(`Fetching public activity for user ${userId}`)

    const activities = await prisma.activity.findMany({
      where: {
        OR: [{ userId }, { targetUserId: userId }],
        isPublic: true,
      },
      include: {
        user: true,
        targetUser: true,
        riff: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    })

    logger.debug(`Found ${activities.length} public activities for user ${userId}`)
    res.json(activities)
  } catch (error) {
    logger.error(`Error fetching user public activity: ${error}`, { userId: req.params.userId })
    res.status(500).json({ message: "Server error" })
  }
})

// Get featured artists
router.get("/featured", async (req, res) => {
  try {
    logger.info("Fetching featured artists")

    // Get users with most riffs
    const topCreators = await prisma.user.findMany({
      where: {
        riffs: {
          some: {},
        },
      },
      include: {
        _count: {
          select: {
            riffs: true,
            likes: true,
          },
        },
      },
      orderBy: [
        {
          riffs: {
            _count: "desc",
          },
        },
      ],
      take: 10,
    })

    // Get users with most likes on their riffs
    const trendingArtists = await prisma.user.findMany({
      where: {
        riffs: {
          some: {
            likes: {
              some: {},
            },
          },
        },
      },
      include: {
        _count: {
          select: {
            riffs: true,
            likes: true,
          },
        },
        riffs: {
          include: {
            _count: {
              select: {
                likes: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: [
        {
          riffs: {
            likes: {
              _count: "desc",
            },
          },
        },
      ],
      take: 10,
    })

    // Get newest users with riffs
    const newArtists = await prisma.user.findMany({
      where: {
        riffs: {
          some: {},
        },
      },
      include: {
        _count: {
          select: {
            riffs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    })

    // Format the response
    const featuredArtists = [
      ...topCreators.map((user) => ({
        id: user.id,
        name: user.name,
        image: user.image,
        category: "Top Creators",
        riffCount: user._count.riffs,
        likeCount: user._count.likes,
      })),
      ...trendingArtists.map((user) => ({
        id: user.id,
        name: user.name,
        image: user.image,
        category: "Trending Artists",
        riffCount: user._count.riffs,
        likeCount: user._count.likes,
      })),
      ...newArtists.map((user) => ({
        id: user.id,
        name: user.name,
        image: user.image,
        category: "New Artists",
        riffCount: user._count.riffs,
        likeCount: 0,
      })),
    ]

    logger.debug(`Found ${featuredArtists.length} featured artists`)
    res.json(featuredArtists)
  } catch (error) {
    logger.error(`Error fetching featured artists: ${error}`)
    res.status(500).json({ message: "Server error" })
  }
})

// Get user's favorites (liked riffs)
router.get("/favorites", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Fetching favorites for user ${userId}`)

    const likes = await prisma.like.findMany({
      where: { userId },
      include: {
        riff: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const favorites = likes.map((like) => ({
      id: like.id,
      riffId: like.riffId,
      title: like.riff.title,
      artist: like.riff.user.name,
      artistId: like.riff.userId,
      image: like.riff.coverImageUrl,
      duration: like.riff.duration,
      createdAt: like.createdAt,
    }))

    logger.debug(`Found ${favorites.length} favorites for user ${userId}`)
    res.json(favorites)
  } catch (error) {
    logger.error(`Error fetching user favorites: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Like a riff
router.post("/like/:riffId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { riffId } = req.params
    logger.info(`User ${userId} liking riff ${riffId}`)

    // Check if riff exists
    const riff = await prisma.riff.findUnique({
      where: { id: riffId },
    })

    if (!riff) {
      logger.warn(`Riff not found: ${riffId}`)
      return res.status(404).json({ message: "Riff not found" })
    }

    // Check if already liked
    const existingLike = await prisma.like.findFirst({
      where: {
        userId,
        riffId,
      },
    })

    if (existingLike) {
      logger.warn(`User ${userId} already liked riff ${riffId}`)
      return res.status(400).json({ message: "Riff already liked" })
    }

    // Create like
    const like = await prisma.like.create({
      data: {
        userId,
        riffId,
      },
    })

    // Create activity
    await prisma.activity.create({
      data: {
        type: "like",
        userId,
        targetUserId: riff.userId,
        riffId,
        isPublic: true,
      },
    })

    logger.info(`User ${userId} liked riff ${riffId} successfully`)
    res.json(like)
  } catch (error) {
    logger.error(`Error liking riff: ${error}`, { userId: req.user?.id, riffId: req.params.riffId })
    res.status(500).json({ message: "Server error" })
  }
})

// Unlike a riff
router.delete("/like/:riffId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { riffId } = req.params
    logger.info(`User ${userId} unliking riff ${riffId}`)

    // Find the like
    const like = await prisma.like.findFirst({
      where: {
        userId,
        riffId,
      },
    })

    if (!like) {
      logger.warn(`Like not found for user ${userId} and riff ${riffId}`)
      return res.status(404).json({ message: "Like not found" })
    }

    // Delete the like
    await prisma.like.delete({
      where: {
        id: like.id,
      },
    })

    logger.info(`User ${userId} unliked riff ${riffId} successfully`)
    res.json({ message: "Riff unliked successfully" })
  } catch (error) {
    logger.error(`Error unliking riff: ${error}`, { userId: req.user?.id, riffId: req.params.riffId })
    res.status(500).json({ message: "Server error" })
  }
})

// ==================== STAKING SETTINGS ROUTES ====================

// Get user's staking settings
router.get("/staking-settings", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Fetching staking settings for user ${userId}`)

    // Find existing settings or create default
    let stakingSettings = await prisma.stakingSettings.findUnique({
      where: { userId },
    })

    // If no settings exist, create default settings
    if (!stakingSettings) {
      stakingSettings = await prisma.stakingSettings.create({
        data: {
          userId,
          stakingEnabled: true,
          defaultRoyalty: 10,
          minimumStake: 500,
          marketplaceRoyalty: true,
          remixesRoyalty: true,
          derivativesRoyalty: true,
          collaborationsRoyalty: true,
          licensingRoyalty: true,
        },
      })
      logger.info(`Created default staking settings for user ${userId}`)
    }

    // Format response
    const formattedSettings = {
      stakingEnabled: stakingSettings.stakingEnabled,
      defaultRoyalty: stakingSettings.defaultRoyalty,
      minimumStake: stakingSettings.minimumStake,
      royaltyApplicableTo: {
        marketplace: stakingSettings.marketplaceRoyalty,
        remixes: stakingSettings.remixesRoyalty,
        derivatives: stakingSettings.derivativesRoyalty,
        collaborations: stakingSettings.collaborationsRoyalty,
        licensing: stakingSettings.licensingRoyalty,
      },
    }

    logger.debug(`Staking settings fetched for user ${userId}`)
    res.json(formattedSettings)
  } catch (error) {
    logger.error(`Error fetching staking settings: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Update user's staking settings
router.put("/staking-settings", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Updating staking settings for user ${userId}`)

    // Validate input
    const validationResult = stakingSettingsSchema.safeParse(req.body)
    if (!validationResult.success) {
      logger.warn(`Invalid staking settings data: ${JSON.stringify(validationResult.error)}`)
      return res.status(400).json({ message: "Invalid staking settings data", errors: validationResult.error.format() })
    }

    const {
      stakingEnabled,
      defaultRoyalty,
      minimumStake,
      marketplaceRoyalty,
      remixesRoyalty,
      derivativesRoyalty,
      collaborationsRoyalty,
      licensingRoyalty,
    } = validationResult.data

    // Update or create settings
    const stakingSettings = await prisma.stakingSettings.upsert({
      where: { userId },
      update: {
        stakingEnabled,
        defaultRoyalty,
        minimumStake,
        marketplaceRoyalty,
        remixesRoyalty,
        derivativesRoyalty,
        collaborationsRoyalty,
        licensingRoyalty,
      },
      create: {
        userId,
        stakingEnabled,
        defaultRoyalty,
        minimumStake,
        marketplaceRoyalty,
        remixesRoyalty,
        derivativesRoyalty,
        collaborationsRoyalty,
        licensingRoyalty,
      },
    })

    // Format response
    const formattedSettings = {
      stakingEnabled: stakingSettings.stakingEnabled,
      defaultRoyalty: stakingSettings.defaultRoyalty,
      minimumStake: stakingSettings.minimumStake,
      royaltyApplicableTo: {
        marketplace: stakingSettings.marketplaceRoyalty,
        remixes: stakingSettings.remixesRoyalty,
        derivatives: stakingSettings.derivativesRoyalty,
        collaborations: stakingSettings.collaborationsRoyalty,
        licensing: stakingSettings.licensingRoyalty,
      },
    }

    logger.debug(`Staking settings updated for user ${userId}`)
    res.json(formattedSettings)
  } catch (error) {
    logger.error(`Error updating staking settings: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// ==================== TIPPING TIERS ROUTES ====================

// Get user's tipping tiers
router.get("/tipping-tiers", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Fetching tipping tiers for user ${userId}`)

    const tippingTiers = await prisma.tippingTier.findMany({
      where: { userId },
      orderBy: { amount: "asc" },
    })

    // Format response
    const formattedTiers = tippingTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      amount: tier.amount,
      description: tier.description,
      perks: tier.perks,
      image: tier.image,
      isActive: tier.isActive,
      supporterCount: tier.supporterCount,
    }))

    logger.debug(`Found ${tippingTiers.length} tipping tiers for user ${userId}`)
    res.json(formattedTiers)
  } catch (error) {
    logger.error(`Error fetching tipping tiers: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Get specific user's tipping tiers
router.get("/:userId/tipping-tiers", async (req, res) => {
  try {
    const { userId } = req.params
    logger.info(`Fetching tipping tiers for user ${userId}`)

    // Only return active tiers for other users
    const tippingTiers = await prisma.tippingTier.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { amount: "asc" },
    })

    // Format response
    const formattedTiers = tippingTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      amount: tier.amount,
      description: tier.description,
      perks: tier.perks,
      image: tier.image,
      supporterCount: tier.supporterCount,
    }))

    logger.debug(`Found ${tippingTiers.length} tipping tiers for user ${userId}`)
    res.json(formattedTiers)
  } catch (error) {
    logger.error(`Error fetching tipping tiers: ${error}`, { userId: req.params.userId })
    res.status(500).json({ message: "Server error" })
  }
})

// Create tipping tier
router.post("/tipping-tiers", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    logger.info(`Creating tipping tier for user ${userId}`)

    // Validate input
    const validationResult = tippingTierSchema.safeParse(req.body)
    if (!validationResult.success) {
      logger.warn(`Invalid tipping tier data: ${JSON.stringify(validationResult.error)}`)
      return res.status(400).json({ message: "Invalid tipping tier data", errors: validationResult.error.format() })
    }

    const { name, amount, description, perks, image, isActive = true } = validationResult.data

    // Create tier
    const tippingTier = await prisma.tippingTier.create({
      data: {
        userId,
        name,
        amount,
        description,
        perks,
        image,
        isActive,
      },
    })

    logger.debug(`Tipping tier created for user ${userId}`)
    res.status(201).json(tippingTier)
  } catch (error) {
    logger.error(`Error creating tipping tier: ${error}`, { userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Update tipping tier
router.put("/tipping-tiers/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params
    logger.info(`Updating tipping tier ${id} for user ${userId}`)

    // Validate input
    const validationResult = tippingTierSchema.safeParse(req.body)
    if (!validationResult.success) {
      logger.warn(`Invalid tipping tier data: ${JSON.stringify(validationResult.error)}`)
      return res.status(400).json({ message: "Invalid tipping tier data", errors: validationResult.error.format() })
    }

    // Check if tier exists and belongs to user
    const existingTier = await prisma.tippingTier.findUnique({
      where: { id },
    })

    if (!existingTier) {
      logger.warn(`Tipping tier not found: ${id}`)
      return res.status(404).json({ message: "Tipping tier not found" })
    }

    if (existingTier.userId !== userId) {
      logger.warn(`User ${userId} attempted to update tier ${id} belonging to user ${existingTier.userId}`)
      return res.status(403).json({ message: "Not authorized to update this tier" })
    }

    const { name, amount, description, perks, image, isActive } = validationResult.data

    // Update tier
    const updatedTier = await prisma.tippingTier.update({
      where: { id },
      data: {
        name,
        amount,
        description,
        perks,
        image,
        isActive: isActive !== undefined ? isActive : existingTier.isActive,
      },
    })

    logger.debug(`Tipping tier ${id} updated for user ${userId}`)
    res.json(updatedTier)
  } catch (error) {
    logger.error(`Error updating tipping tier: ${error}`, { userId: req.user?.id, tierId: req.params.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Delete tipping tier
router.delete("/tipping-tiers/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params
    logger.info(`Deleting tipping tier ${id} for user ${userId}`)

    // Check if tier exists and belongs to user
    const existingTier = await prisma.tippingTier.findUnique({
      where: { id },
    })

    if (!existingTier) {
      logger.warn(`Tipping tier not found: ${id}`)
      return res.status(404).json({ message: "Tipping tier not found" })
    }

    if (existingTier.userId !== userId) {
      logger.warn(`User ${userId} attempted to delete tier ${id} belonging to user ${existingTier.userId}`)
      return res.status(403).json({ message: "Not authorized to delete this tier" })
    }

    // Delete tier
    await prisma.tippingTier.delete({
      where: { id },
    })

    logger.debug(`Tipping tier ${id} deleted for user ${userId}`)
    res.json({ message: "Tipping tier deleted successfully" })
  } catch (error) {
    logger.error(`Error deleting tipping tier: ${error}`, { userId: req.user?.id, tierId: req.params.id })
    res.status(500).json({ message: "Server error" })
  }
})

export const userRoutes = router
