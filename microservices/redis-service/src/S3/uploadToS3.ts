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

export async function uploadCodeToS3(
  submissionId: string,
  code: string,
  language: string
) {
  const bucket = process.env.AWS_S3_BUCKET;
  let Key;
  if (language === "c") {
    Key = `submissions/${submissionId}/code.c`;
  } else {
    Key = `submissions/${submissionId}/code.py`;
  }

  const params = {
    Bucket: bucket,
    Key,
    Body: Buffer.from(code, "utf-8"),
    ContentType: "text/plain",
  };

  try {
    await s3.send(new PutObjectCommand(params));
    console.log("✅ Code uploaded to:", Key);
    return Key;
  } catch (err) {
    console.error("❌ Error uploading code:", err);
    throw err;
  }
}
export async function uploadTestCasesToS3(
  submissionId: string,
  testCases: string,
  language: string
) {
  const Key = `submissions/${submissionId}/tests.json`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key,
    Body: JSON.stringify(testCases),
    ContentType: "application/json",
  };
  try {
    await s3.send(new PutObjectCommand(params));
    console.log("✅ testcases uploaded to:", Key);
    return Key;
  } catch (err) {
    console.error("❌ Error uploading code:", err);
    throw err;
  }
}
