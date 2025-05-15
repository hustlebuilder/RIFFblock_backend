import AWS from "aws-sdk"
import fs from "fs"
import path from "path"
import logger from "../../config/logger"

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
})

const s3 = new AWS.S3()
const bucketName = process.env.AWS_S3_BUCKET || "riffblock-storage"

/**
 * Upload a file to S3
 * @param filePath Local path to the file
 * @param key S3 object key (path in the bucket)
 * @returns URL of the uploaded file
 */
export async function uploadToS3(filePath: string, key: string): Promise<string> {
  try {
    logger.info(`Uploading file to S3: ${key}`, {
      bucket: bucketName,
      fileSize: fs.statSync(filePath).size,
    })

    const fileContent = fs.readFileSync(filePath)
    const fileExtension = path.extname(filePath).toLowerCase()

    // Determine content type based on file extension
    let contentType = "application/octet-stream"
    if (fileExtension === ".mp3") contentType = "audio/mpeg"
    else if (fileExtension === ".wav") contentType = "audio/wav"
    else if (fileExtension === ".jpg" || fileExtension === ".jpeg") contentType = "image/jpeg"
    else if (fileExtension === ".png") contentType = "image/png"

    logger.debug(`Determined content type: ${contentType}`, { fileExtension })

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      ACL: "public-read", // Make the file publicly accessible
    }

    const uploadResult = await s3.upload(params).promise()
    logger.info(`File uploaded successfully to S3: ${key}`, {
      location: uploadResult.Location,
      etag: uploadResult.ETag,
    })

    return uploadResult.Location
  } catch (error) {
    logger.error(`Error uploading file to S3: ${error}`, {
      filePath,
      key,
      bucket: bucketName,
    })
    throw new Error(`Failed to upload file to S3: ${error}`)
  }
}

/**
 * Delete a file from S3
 * @param key S3 object key (path in the bucket)
 * @returns Success status
 */
export async function deleteFromS3(key: string): Promise<boolean> {
  try {
    logger.info(`Deleting file from S3: ${key}`, { bucket: bucketName })

    const params = {
      Bucket: bucketName,
      Key: key,
    }

    await s3.deleteObject(params).promise()
    logger.info(`File deleted successfully from S3: ${key}`)

    return true
  } catch (error) {
    logger.error(`Error deleting file from S3: ${error}`, {
      key,
      bucket: bucketName,
    })
    throw new Error(`Failed to delete file from S3: ${error}`)
  }
}

/**
 * Generate a pre-signed URL for direct upload to S3
 * @param key S3 object key (path in the bucket)
 * @param contentType MIME type of the file
 * @param expiresIn Expiration time in seconds (default: 3600)
 * @returns Pre-signed URL
 */
export function generatePresignedUrl(key: string, contentType: string, expiresIn = 3600): string {
  try {
    logger.info(`Generating pre-signed URL for S3 upload: ${key}`, {
      bucket: bucketName,
      contentType,
      expiresIn,
    })

    const params = {
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      Expires: expiresIn,
      ACL: "public-read",
    }

    const url = s3.getSignedUrl("putObject", params)
    logger.debug(`Pre-signed URL generated successfully`, {
      key,
      urlLength: url.length,
    })

    return url
  } catch (error) {
    logger.error(`Error generating pre-signed URL: ${error}`, {
      key,
      bucket: bucketName,
      contentType,
    })
    throw new Error(`Failed to generate pre-signed URL: ${error}`)
  }
}
