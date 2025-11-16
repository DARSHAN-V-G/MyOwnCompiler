import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION || "",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_KEY!,
  },
});

export async function uploadResultToS3(submissionId: string, result: string) {
  const bucket = process.env.AWS_S3_BUCKET;
  const Key = `submissions/${submissionId}/result.json`;

  const params = {
    Bucket: bucket,
    Key,
    Body: Buffer.from(result, "utf-8"),
    ContentType: "application/json",
  };

  try {
    await s3.send(new PutObjectCommand(params));
    console.log("✅ result uploaded to:", Key);
    return Key;
  } catch (err) {
    console.error("❌ Error uploading code:", err);
    throw err;
  }
}
