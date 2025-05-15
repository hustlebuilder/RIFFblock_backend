import AWS from "aws-sdk"
import fs from "fs"
import dotenv from "dotenv"

dotenv.config()

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
})

const s3 = new AWS.S3()
const bucketName = process.env.AWS_S3_BUCKET || "riffblock-assets"

export const uploadToS3 = async (filePath: string, key: string): Promise<string> => {
  try {
    const fileContent = fs.readFileSync(filePath)

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ACL: "public-read",
    }

    const result = await s3.upload(params).promise()
    return result.Location
  } catch (error) {
    console.error("Error uploading to S3:", error)
    throw new Error("Failed to upload file to storage")
  }
}

export const getSignedUrl = async (key: string, expiresIn = 3600): Promise<string> => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
      Expires: expiresIn,
    }

    return s3.getSignedUrl("getObject", params)
  } catch (error) {
    console.error("Error generating signed URL:", error)
    throw new Error("Failed to generate signed URL")
  }
}

export const deleteFromS3 = async (key: string): Promise<void> => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
    }

    await s3.deleteObject(params).promise()
  } catch (error) {
    console.error("Error deleting from S3:", error)
    throw new Error("Failed to delete file from storage")
  }
}
