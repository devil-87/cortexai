import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/s3.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";

// S3 refuses presigned links that last longer than 7 days when the server uses normal access keys
const MAX_EXPIRES_SECONDS = 60 * 60 * 24 * 7

// downloadName (optional): the link then downloads the file under this name instead of opening it in the tab
export const getFromS3 = async (filename, expiresIn = 600, downloadName) => {
  // FIXED: a value above 7 days would make the SDK throw, so it is limited here
  const seconds = Math.min(Math.max(Number(expiresIn) || 600, 1), MAX_EXPIRES_SECONDS)

  // quotes and odd characters in a title must not break the header
  const safeName = downloadName
    ? String(downloadName).replace(/[^\w.\- ]+/g, "_").trim().slice(0, 100)
    : ""

  return await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
      ...(safeName && {
        ResponseContentDisposition: `attachment; filename="${safeName}"`
      })
    }),
    { expiresIn: seconds }
  )
}