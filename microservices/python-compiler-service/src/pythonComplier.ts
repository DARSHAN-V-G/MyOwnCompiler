import fs from "fs";
import { exec } from "child_process";
import { uploadResultToS3 } from "./S3/uploadToS3.js";
import redis from "redis";

const publisher = redis.createClient();
publisher.connect();

publisher.on("ready", () => {
  console.log("publisher redis is connected");
});

let count = 0;

export const pythonController = async (
  code: any,
  testCases: any,
  submissionid: any
) => {
  await publisher.hSet("submission-status", submissionid, "compiling");

  console.log(`count - ${count}, submission - ${submissionid}`);
  count++;

  const pyFile = `${submissionid}.py`;
  fs.writeFileSync(pyFile, code);

  try {
    await publisher.hSet("submission-status", submissionid, "executing");

    const results: any[] = [];

    for (const testCase of testCases) {
      const { input, expectedOutput } = testCase;
      let actualOutput = "";
      let passed = false;

      try {
        actualOutput = await new Promise<string>((resolve, reject) => {
          const child = exec(`python3 ${pyFile}`, { timeout: 5000 });

          let output = "";
          let error = "";

          child.stdout?.on("data", (data) => (output += data));
          child.stderr?.on("data", (data) => (error += data));

          child.on("close", (code) => {
            if (code !== 0) reject(error || `Exit code ${code}`);
            else resolve(output);
          });

          child.stdin?.write(input + "\n");
          child.stdin?.end();
        });

        const normalize = (str: string) =>
          str.replace(/[\s\u200B-\u200D\uFEFF]/g, "");

        passed = normalize(actualOutput) === normalize(expectedOutput);
      } catch (err: any) {
        actualOutput = err.message || "Runtime error";
        passed = false;
      }

      results.push({ input, expectedOutput, actualOutput, passed });
    }

    fs.unlinkSync(pyFile);

    await uploadResultToS3(submissionid, JSON.stringify(results));

    await publisher.hSet("submission-status", submissionid, "completed");

    console.log(`Execution finished for ${submissionid}`);
    console.log(results)
  } catch (err) {
    await publisher.hSet("submission-status", submissionid, "error");

    try {
      fs.unlinkSync(pyFile);
    } catch (e) {}

    return "Internal error during python execution";
  }
};
