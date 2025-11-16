import express from "express";
import redis from "redis";
import dotenv from "dotenv";
import { downloadCodeFromS3 } from "./S3/retrieveFromS3.js";
import { pythonController } from "./pythonComplier.js";

const subscriber = redis.createClient();
subscriber.connect();

subscriber.on("ready", () => {
  console.log("subcriber redis is connected");
});
// const publisher = redis.createClient();
// publisher.connect()

// publisher.on("ready", () => {
//     console.log("subcriber redis is connected");
// })

async function main() {
  console.log("🚀 Waiting for items in python...");
  while (true) {
    const response = await subscriber.brPop("python-queue", 0);
    console.log("📦 Received:", response);
    //@ts-ignore
    const code = await downloadCodeFromS3(
      `submissions/${response?.element}/code.py`
    );
    let testCases = await downloadCodeFromS3(
      `submissions/${response?.element}/tests.json`
    );
    console.log(code);
    console.log(testCases);
    testCases = JSON.parse(testCases as string);
    await pythonController(code, testCases, response?.element);
  }
}
await main();
