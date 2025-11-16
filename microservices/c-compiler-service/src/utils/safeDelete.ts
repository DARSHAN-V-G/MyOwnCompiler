import fs from "fs";
export const safeDeleteFile = async (filePath : any, maxRetries = 5, delay = 200) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return; // Success
    } catch (error : any) {
      if (error.code === "EPERM" || error.code === "EBUSY") {
        if (i < maxRetries - 1) {
          // Exponential backoff with jitter
          const waitTime = delay * Math.pow(2, i) + Math.random() * 100;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }
      console.warn(
        `Failed to delete ${filePath} after ${maxRetries} attempts:`,
        error.message
      );
      // Don't throw error, just log warning as cleanup failure shouldn't crash the server
    }
  }
};
