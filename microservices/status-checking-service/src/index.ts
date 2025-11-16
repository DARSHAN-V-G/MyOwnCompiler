import express from "express";
import redis from "redis";
import dotenv from "dotenv";
dotenv.config();
const PORT = process.env.PORT;

const subscriber = redis.createClient();
subscriber.connect();
subscriber.on("ready", () => console.log("Redis connected"));

const app = express();

app.get("/api/status", async (req, res) => {
  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid id parameter" });
  }
  const response = await subscriber.hGet("submission-status", id);
  res.json({ status: response });
});

app.listen(PORT, () => {
  console.log(`App is up and running on ${PORT}`);
});
