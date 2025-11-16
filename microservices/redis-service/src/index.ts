import express from "express";
import redis from "redis";
import dotenv from "dotenv";
dotenv.config();
import { uploadCodeToS3, uploadTestCasesToS3 } from "./S3/uploadToS3.js";

const PORT = process.env.PORT;

const publisher = redis.createClient();
publisher.connect();

publisher.on("ready", () => {
  console.log("redis connected successfully");
});

const app = express();
app.use(express.json());

app.post("/submit-c", async (req, res) => {
  const { code, testCases, submissionid } = req.body;
  await uploadCodeToS3(submissionid, code, "c");
  await uploadTestCasesToS3(submissionid, testCases, "c");

  await publisher.lPush("c-queue", submissionid);
  res.json({submissionid})
});

app.post("/submit-python", async (req, res) => {
  const { code, testCases, submissionid } = req.body;
  await uploadCodeToS3(submissionid, code, "python");
  await uploadTestCasesToS3(submissionid, testCases, "python");

  await publisher.lPush("python-queue", submissionid);
  res.json({submissionid})
});

app.listen(PORT, () => {
  console.log(`App is up and running on ${PORT}`);
});
