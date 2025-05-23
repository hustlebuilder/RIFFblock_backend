import express from "express"
import { PrismaClient } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"
import multer from "multer"
import path from "path"
import fs from "fs"
import { uploadToS3 } from "../services/storageService"
import logger from "../../config/logger"

const router = express.Router()
const prisma = new PrismaClient()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../../uploads")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "audio") {
      if (file.mimetype.startsWith("audio/")) {
        cb(null, true)
      } else {
        logger.warn("Invalid file type: audio file expected", {
          mimetype: file.mimetype,
          fieldname: file.fieldname,
        })
        cb(new Error("Only audio files are allowed"))
      }
    } else if (file.fieldname === "coverImage") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true)
      } else {
        logger.warn("Invalid file type: image file expected", {
          mimetype: file.mimetype,
          fieldname: file.fieldname,
        })
        cb(new Error("Only image files are allowed"))
      }
    } else {
      logger.warn("Unexpected field in file upload", { fieldname: file.fieldname })
      cb(new Error("Unexpected field"))
    }
  },
})

// Get all riffs (public)
router.get("/", async (req, res) => {
  try {
    const { genre, mood, instrument, sort = "newest" } = req.query
    logger.info("Fetching all riffs", { genre, mood, instrument, sort })

    // Build filter conditions
    const where: any = {}

    if (genre && genre !== "All") {
      where.genre = genre as string
    }

    if (mood && mood !== "All") {
      where.mood = mood as string
    }

    if (instrument && instrument !== "All") {
      where.instrument = instrument as string
    }

    // Build sort options
    let orderBy: any = { createdAt: "desc" }

    if (sort === "oldest") {
      orderBy = { createdAt: "asc" }
    } else if (sort === "a-z") {
      orderBy = { title: "asc" }
    } else if (sort === "z-a") {
      orderBy = { title: "desc" }
    }

    const riffs = await prisma.riff.findMany({
      where,
      orderBy,
      include: {
        user: true,
        nft: true,
        tips: true,
        stakingRecords: true,
      },
    })

    logger.debug(`Found ${riffs.length} riffs matching criteria`, { filters: where, sort: orderBy })
    res.json(riffs)
  } catch (error) {
    logger.error(`Error fetching riffs: ${error}`, { query: req.query })
    res.status(500).json({ message: "Server error" })
  }
})

// Get a single riff by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params
    logger.info(`Fetching riff by ID: ${id}`)

    const riff = await prisma.riff.findUnique({
      where: { id },
      include: {
        user: true,
        nft: true,
        tips: true,
        stakingRecords: true,
        collection: true,
      },
    })

    if (!riff) {
      logger.warn(`Riff not found: ${id}`)
      return res.status(404).json({ message: "Riff not found" })
    }

    logger.debug(`Riff found: ${id}`, { title: riff.title, userId: riff.userId })
    res.json(riff)
  } catch (error) {
    logger.error(`Error fetching riff: ${error}`, { id: req.params.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Upload a new riff
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  async (req: any, res: any) => {
    try {
      const userId = req.user.id
      logger.info(`Uploading new riff for user: ${userId}`)

      const files = req.files as { [fieldname: string]: Express.Multer.File[] }

      if (!files.audio || !files.audio[0]) {
        logger.warn("Audio file missing in upload request", { userId })
        return res.status(400).json({ message: "Audio file is required" })
      }

      const audioFile = files.audio[0]
      const coverImageFile = files.coverImage ? files.coverImage[0] : null

      logger.debug("Files received for upload", {
        audioFile: audioFile.originalname,
        audioSize: audioFile.size,
        hasCoverImage: !!coverImageFile,
        coverImageSize: coverImageFile?.size,
      })

      // Upload files to S3
      const audioUrl = await uploadToS3(audioFile.path, `riffs/${userId}/${Date.now()}-${audioFile.originalname}`)
      let coverImageUrl = null

      if (coverImageFile) {
        coverImageUrl = await uploadToS3(
          coverImageFile.path,
          `covers/${userId}/${Date.now()}-${coverImageFile.originalname}`,
        )
      }

      logger.debug("Files uploaded to S3", { audioUrl, hasCoverImage: !!coverImageUrl })

      // Clean up local files
      fs.unlinkSync(audioFile.path)
      if (coverImageFile) {
        fs.unlinkSync(coverImageFile.path)
      }

      const {
        title,
        description,
        genre,
        mood,
        instrument,
        keySignature,
        timeSignature,
        isBargainBin,
        duration,
        collectionId,
        newCollectionName,
      } = req.body

      // Handle collection
      let finalCollectionId = collectionId

      if (!collectionId && newCollectionName) {
        logger.info(`Creating new collection: ${newCollectionName}`, { userId })
        const newCollection = await prisma.collection.create({
          data: {
            name: newCollectionName,
            userId,
          },
        })

        finalCollectionId = newCollection.id
        logger.debug(`New collection created with ID: ${finalCollectionId}`)
      }

      // Create the riff
      const riff = await prisma.riff.create({
        data: {
          title,
          description,
          audioUrl,
          coverImageUrl,
          genre,
          mood,
          instrument,
          keySignature,
          timeSignature,
          isBargainBin: isBargainBin === "true",
          duration: duration ? Number.parseFloat(duration) : null,
          userId,
          collectionId: finalCollectionId || null,
        },
      })

      logger.info(`Riff created successfully: ${riff.id}`, { title, userId })
      res.status(201).json(riff)
    } catch (error) {
      logger.error(`Error uploading riff: ${error}`, { userId: req.user?.id })
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Update a riff
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    logger.info(`Updating riff: ${id}`, { userId })

    // Check if riff exists and belongs to user
    const existingRiff = await prisma.riff.findUnique({
      where: { id },
    })

    if (!existingRiff) {
      logger.warn(`Riff not found for update: ${id}`)
      return res.status(404).json({ message: "Riff not found" })
    }

    if (existingRiff.userId !== userId) {
      logger.warn(`Unauthorized riff update attempt: ${id}`, {
        requestUserId: userId,
        ownerUserId: existingRiff.userId,
      })
      return res.status(403).json({ message: "Not authorized to update this riff" })
    }

    const { title, description, genre, mood, instrument, keySignature, timeSignature, isBargainBin, collectionId } =
      req.body

    logger.debug("Riff update data", {
      id,
      title,
      genre,
      mood,
      instrument,
      collectionId,
    })

    const updatedRiff = await prisma.riff.update({
      where: { id },
      data: {
        title,
        description,
        genre,
        mood,
        instrument,
        keySignature,
        timeSignature,
        isBargainBin: isBargainBin === "true",
        collectionId: collectionId || null,
      },
    })

    logger.info(`Riff updated successfully: ${id}`)
    res.json(updatedRiff)
  } catch (error) {
    logger.error(`Error updating riff: ${error}`, { id: req.params.id, userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

// Delete a riff
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    logger.info(`Deleting riff: ${id}`, { userId })

    // Check if riff exists and belongs to user
    const existingRiff = await prisma.riff.findUnique({
      where: { id },
    })

    if (!existingRiff) {
      logger.warn(`Riff not found for deletion: ${id}`)
      return res.status(404).json({ message: "Riff not found" })
    }

    if (existingRiff.userId !== userId) {
      logger.warn(`Unauthorized riff deletion attempt: ${id}`, {
        requestUserId: userId,
        ownerUserId: existingRiff.userId,
      })
      return res.status(403).json({ message: "Not authorized to delete this riff" })
    }

    // Delete the riff
    await prisma.riff.delete({
      where: { id },
    })

    logger.info(`Riff deleted successfully: ${id}`)
    res.json({ message: "Riff deleted successfully" })
  } catch (error) {
    logger.error(`Error deleting riff: ${error}`, { id: req.params.id, userId: req.user?.id })
    res.status(500).json({ message: "Server error" })
  }
})

export const riffRoutes = router
