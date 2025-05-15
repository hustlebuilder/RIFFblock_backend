import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"
import { mintNFT } from "../services/blockchainService"

const router = express.Router()
const prisma = new PrismaClient()

// Get all NFTs
router.get("/", async (req, res) => {
  try {
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

    res.json(nfts)
  } catch (error) {
    console.error("Error fetching NFTs:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get a single NFT by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params

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
      return res.status(404).json({ message: "NFT not found" })
    }

    res.json(nft)
  } catch (error) {
    console.error("Error fetching NFT:", error)
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

    // Check if riff exists and belongs to user
    const riff = await prisma.riff.findUnique({
      where: { id: riffId },
    })

    if (!riff) {
      return res.status(404).json({ message: "Riff not found" })
    }

    if (riff.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to mint this riff" })
    }

    // Check if riff is already minted
    const existingNFT = await prisma.nFT.findUnique({
      where: { riffId },
    })

    if (existingNFT) {
      return res.status(400).json({ message: "Riff is already minted as an NFT" })
    }

    // Mint the NFT on the blockchain
    const { tokenId, contractAddress } = await mintNFT(riff.audioUrl, {
      title: riff.title,
      description: riff.description,
      coverImage: riff.coverImageUrl,
      royaltyPercentage: Number.parseFloat(royaltyPercentage),
    })

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

    res.status(201).json(nft)
  } catch (error) {
    console.error("Error minting NFT:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Update NFT settings
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Check if NFT exists and belongs to user
    const existingNFT = await prisma.nFT.findUnique({
      where: { id },
    })

    if (!existingNFT) {
      return res.status(404).json({ message: "NFT not found" })
    }

    if (existingNFT.ownerId !== userId) {
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

    res.json(updatedNFT)
  } catch (error) {
    console.error("Error updating NFT:", error)
    res.status(500).json({ message: "Server error" })
  }
})

export const nftRoutes = router
