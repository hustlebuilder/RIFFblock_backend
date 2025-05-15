import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"
import { mintNFT } from "../services/blockchainService"
import logger from "../../config/logger"

const router = express.Router()
const prisma = new PrismaClient()

// Get all NFTs
router.get("/", async (req, res) => {
  try {
    logger.info("Fetching all NFTs")

    const nfts = await prisma.nFT.findMany({
      include: {
        riff: {
          include: {
            user: true,
          },
        },
        owner: true,
      },
    })

    logger.debug(`Found ${nfts.length} NFTs`)
    res.json(nfts)
  } catch (error) {
    logger.error(`Error fetching NFTs: ${error}`)
    res.status(500).json({ message: "Server error" })
  }
})

// Get a single NFT by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params
    logger.info(`Fetching NFT by ID: ${id}`)

    const nft = await prisma.nFT.findUnique({
      where: { id },
      include: {
        riff: {
          include: {
            user: true,
          },
        },
        owner: true,
      },
    })

    if (!nft) {
      logger.warn(`NFT not found: ${id}`)
      return res.status(404).json({ message: "NFT not found" })
    }

    logger.debug(`NFT found: ${id}`, {
      tokenId: nft.tokenId,
      contractAddress: nft.contractAddress,
      riffId: nft.riffId,
    })
    res.json(nft)
  } catch (error) {
    logger.error(`Error fetching NFT: ${error}`, { id: req.params.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Mint a new NFT from a riff
router.post("/mint", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const {
      riffId,
      price,
      currency,
      royaltyPercentage,
      enableStaking,
      customRoyaltyShare,
      unlockSourceFiles,
      unlockRemixRights,
      unlockPrivateMessages,
      unlockBackstageContent,
    } = req.body

    logger.info(`Minting NFT for riff: ${riffId}`, { userId })
    logger.debug("NFT minting parameters", {
      price,
      currency,
      royaltyPercentage,
      enableStaking,
      customRoyaltyShare,
    })

    // Check if riff exists and belongs to user
    const riff = await prisma.riff.findUnique({
      where: { id: riffId },
    })

    if (!riff) {
      logger.warn(`Riff not found for NFT minting: ${riffId}`)
      return res.status(404).json({ message: "Riff not found" })
    }

    if (riff.userId !== userId) {
      logger.warn(`Unauthorized NFT minting attempt for riff: ${riffId}`, {
        requestUserId: userId,
        ownerUserId: riff.userId,
      })
      return res.status(403).json({ message: "Not authorized to mint this riff" })
    }

    // Check if riff is already minted
    const existingNFT = await prisma.nFT.findUnique({
      where: { riffId },
    })

    if (existingNFT) {
      logger.warn(`Riff already minted as NFT: ${riffId}`, { existingNftId: existingNFT.id })
      return res.status(400).json({ message: "Riff is already minted as an NFT" })
    }

    // Mint the NFT on the blockchain
    logger.info(`Initiating blockchain minting for riff: ${riffId}`)
    const { tokenId, contractAddress } = await mintNFT(riff.audioUrl, {
      title: riff.title,
      description: riff.description || "",
      coverImage: riff.coverImageUrl || "",
      royaltyPercentage: Number.parseFloat(royaltyPercentage),
    })

    logger.debug(`Blockchain minting successful`, { tokenId, contractAddress })

    // Create NFT record in database
    const nft = await prisma.nFT.create({
      data: {
        tokenId,
        contractAddress,
        riffId,
        price: Number.parseFloat(price),
        currency,
        royaltyPercentage: Number.parseFloat(royaltyPercentage),
        enableStaking: enableStaking === "true",
        customRoyaltyShare: Number.parseFloat(customRoyaltyShare),
        unlockSourceFiles: unlockSourceFiles === "true",
        unlockRemixRights: unlockRemixRights === "true",
        unlockPrivateMessages: unlockPrivateMessages === "true",
        unlockBackstageContent: unlockBackstageContent === "true",
        ownerId: userId,
      },
    })

    logger.info(`NFT created successfully: ${nft.id}`, { tokenId, riffId })
    res.status(201).json(nft)
  } catch (error) {
    logger.error(`Error minting NFT: ${error}`, {
      userId: req.user?.id,
      riffId: req.body?.riffId,
    })
    res.status(500).json({ message: "Server error" })
  }
})

// Update NFT settings
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    logger.info(`Updating NFT: ${id}`, { userId })

    // Check if NFT exists and belongs to user
    const existingNFT = await prisma.nFT.findUnique({
      where: { id },
    })

    if (!existingNFT) {
      logger.warn(`NFT not found for update: ${id}`)
      return res.status(404).json({ message: "NFT not found" })
    }

    if (existingNFT.ownerId !== userId) {
      logger.warn(`Unauthorized NFT update attempt: ${id}`, {
        requestUserId: userId,
        ownerUserId: existingNFT.ownerId,
      })
      return res.status(403).json({ message: "Not authorized to update this NFT" })
    }

    const {
      price,
      currency,
      enableStaking,
      customRoyaltyShare,
      unlockSourceFiles,
      unlockRemixRights,
      unlockPrivateMessages,
      unlockBackstageContent,
    } = req.body

    logger.debug("NFT update data", {
      id,
      price,
      currency,
      enableStaking,
      customRoyaltyShare,
    })

    const updatedNFT = await prisma.nFT.update({
      where: { id },
      data: {
        price: price ? Number.parseFloat(price) : undefined,
        currency,
        enableStaking: enableStaking === "true",
        customRoyaltyShare: customRoyaltyShare ? Number.parseFloat(customRoyaltyShare) : undefined,
        unlockSourceFiles: unlockSourceFiles === "true",
        unlockRemixRights: unlockRemixRights === "true",
        unlockPrivateMessages: unlockPrivateMessages === "true",
        unlockBackstageContent: unlockBackstageContent === "true",
      },
    })

    logger.info(`NFT updated successfully: ${id}`)
    res.json(updatedNFT)
  } catch (error) {
    logger.error(`Error updating NFT: ${error}`, { id: req.params.id, userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

export const nftRoutes = router
