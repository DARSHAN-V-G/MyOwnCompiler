import fs from "fs";
import { exec } from "child_process";
import path from "path";
import { safeDeleteFile } from "./utils/safeDelete.js";
import redis from "redis";
import { uploadResultToS3 } from "./S3/uploadToS3.js";

const publisher = redis.createClient();
publisher.connect();

const subscriber = redis.createClient();
subscriber.connect();

publisher.on("ready", () => {
  console.log("redis publisher is connected successfully");
});
subscriber.on("ready", () => {
  console.log("redis subscriber is connected successfully");
});

export const cController = async (
  code: any,
  testCases: any,
  submissionid: any
) => {
  const cFile = `${submissionid}.c`;
  const exeFile = `${submissionid}.exe`;

  const dangerousFunctions = [
    "system",
    "exec",
    "fork",
    "popen",
    "fopen",
    "freopen",
    "remove",
    "rename",
    "tmpfile",
    "tmpnam",
    "open",
    "creat",
    "unlink",
    "rmdir",
    "chdir",
    "chmod",
    "chown",
    "kill",
    "signal",
    "raise",
    "socket",
    "connect",
    "listen",
    "accept",
    "bind",
    "memcpy",
    "memmove",
    "dlopen",
    "dlsym",
    "dlclose",
    "dlerror",
  ];

  const escapeRegExp = (s: any) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const foundDangerous = dangerousFunctions.filter((fn) =>
    new RegExp(`\\b${escapeRegExp(fn)}\\s*\\(`).test(code)
  );
  if (foundDangerous.length > 0) {
    return "malicious code suspected";
  }

  fs.writeFileSync(cFile, code); // should optimise this way of handling the malicious codes later

  try {
    await publisher.hSet("submission-status", submissionid, "compiling");
    const gccCmd = `gcc -Wall -Wextra -pedantic -g ${cFile} -o ${exeFile}`;
    exec(gccCmd, { timeout: 10000 }, async (err, stdout, stderr) => {
      if (err) {
        await safeDeleteFile(cFile);
        if (err.killed && err.signal === "SIGTERM") {
          return "Compilation timeout: Code took too long to compile";
        }
        return "Compilation failed";
      }
      await publisher.hSet("submission-status", submissionid, "executing");

      const results = [];
      for (const testCase of testCases) {
        const { input, expectedOutput } = testCase;
        let actualOutput = "";
        let passed = false;

        try {
          actualOutput = await new Promise((resolve, reject) => {
            const child = exec(
              `.${path.sep}${exeFile}`,
              (error, stdout, stderr) => {
                if (error) return reject(stderr || error.message);
                resolve(stdout);
              }
            );

            // Set a timeout to kill the process if it runs too long (prevents infinite loops)
            const timeout = setTimeout(() => {
              child.kill("SIGTERM"); // Try graceful termination first
              setTimeout(() => {
                child.kill("SIGKILL"); // Force kill if graceful termination fails
              }, 1000);
              reject(
                "Execution timeout: Program took too long to execute (possible infinite loop)"
              );
            }, 5000); // 5 second timeout

            child.on("exit", () => {
              clearTimeout(timeout);
            });

            child.stdin?.write(input + "\n");
            child.stdin?.end();

            // Ensure the process is fully terminated
            child.on("exit", () => {
              // Small delay to ensure file handles are released on Windows
              setTimeout(() => {}, 100);
            });
          });
          const normalize = (str: any) =>
            str.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
          passed = normalize(actualOutput) === normalize(expectedOutput);
        } catch (e: any) {
          actualOutput =
            typeof e === "string" ? e : e.message || "Runtime error";
          passed = false;
        }

        results.push({
          input,
          expectedOutput,
          actualOutput,
          passed,
        });
      }

      await safeDeleteFile(cFile);
      await safeDeleteFile(exeFile);
      await publisher.hSet("submission-status", submissionid, "completed");

      console.log(results);
      await uploadResultToS3(submissionid, JSON.stringify(results));
    });
  } catch (err) {
    await safeDeleteFile(cFile);
    await safeDeleteFile(exeFile);
    return "Internal server error";
  }
};
