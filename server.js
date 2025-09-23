const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
let count = 0
// CORS middleware - allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(bodyParser.json());

// Helper function to safely delete files with retry logic (for Windows compatibility)
const safeDeleteFile = async (filePath, maxRetries = 5, delay = 200) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return; // Success
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EBUSY') {
        if (i < maxRetries - 1) {
          // Exponential backoff with jitter
          const waitTime = delay * Math.pow(2, i) + Math.random() * 100;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      console.warn(`Failed to delete ${filePath} after ${maxRetries} attempts:`, error.message);
      // Don't throw error, just log warning as cleanup failure shouldn't crash the server
    }
  }
};

app.post('/compiler/submit', async (req, res) => {
  const { code, testCases, submissionid } = req.body;
  if (!code || !testCases || !submissionid) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

    const cFile = `${submissionid}.c`;
    const exeFile = `${submissionid}.exe`;

    const dangerousFunctions = [
      'system', 'exec', 'fork', 'popen', 'fopen', 'freopen', 'remove', 'rename', 'tmpfile', 'tmpnam', 'open', 'creat', 'unlink', 'rmdir', 'chdir', 'chmod', 'chown', 'kill', 'signal', 'raise', 'socket', 'connect', 'listen', 'accept', 'bind', 'memcpy', 'memmove', 'dlopen', 'dlsym', 'dlclose', 'dlerror'
    ];

    const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const foundDangerous = dangerousFunctions.filter(fn => new RegExp(`\\b${escapeRegExp(fn)}\\s*\\(`).test(code));if (foundDangerous.length > 0) {
      return res.status(400).json({ error: 'Malicious or dangerous function calls detected', functions: foundDangerous });
    }

    fs.writeFileSync(cFile, code);

    try {
      const gccCmd = `gcc -Wall -Wextra -pedantic -g ${cFile} -o ${exeFile}`;
      exec(gccCmd, { timeout: 10000 }, async (err, stdout, stderr) => {
      if (err) {
        await safeDeleteFile(cFile);
        if (err.killed && err.signal === 'SIGTERM') {
          return res.status(400).json({ error: 'Compilation timeout: Code took too long to compile' });
        }
        return res.status(400).json({ error: 'Compilation failed', details: stderr });
      }

      const results = [];
      for (const testCase of testCases) {
        const { input, expectedOutput } = testCase;
        let actualOutput = '';
        let passed = false;

        try {
          actualOutput = await new Promise((resolve, reject) => {
            const child = exec(`.${path.sep}${exeFile}`, (error, stdout, stderr) => {
              if (error) return reject(stderr || error.message);
              resolve(stdout);
            });
            
            // Set a timeout to kill the process if it runs too long (prevents infinite loops)
            const timeout = setTimeout(() => {
              child.kill('SIGTERM'); // Try graceful termination first
              setTimeout(() => {
                child.kill('SIGKILL'); // Force kill if graceful termination fails
              }, 1000);
              reject('Execution timeout: Program took too long to execute (possible infinite loop)');
            }, 5000); // 5 second timeout
            
            child.on('exit', () => {
              clearTimeout(timeout);
            });
            
            child.stdin.write(input + '\n');
            child.stdin.end();
            
            // Ensure the process is fully terminated
            child.on('exit', () => {
              // Small delay to ensure file handles are released on Windows
              setTimeout(() => {}, 100);
            });
          });
          const normalize = str => str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
          passed = normalize(actualOutput) === normalize(expectedOutput);
        } catch (e) {
          actualOutput = typeof e === 'string' ? e : (e.message || 'Runtime error');
          passed = false;
        }

        results.push({
          input,
          expectedOutput,
          actualOutput,
          passed
        });
      }

      await safeDeleteFile(cFile);
      await safeDeleteFile(exeFile);

      res.json({ results });
    });
  } catch (err) {
    await safeDeleteFile(cFile);
    await safeDeleteFile(exeFile);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.post('//submit-python', async (req, res) => {
  const { code, testCases, submissionid } = req.body;
  if (!code || !testCases || !submissionid) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  console.log(`count - ${count}, submission - ${submissionid}`);
  count = count + 1;
  const pyFile = `${submissionid}.py`;
  fs.writeFileSync(pyFile, code);

  try {
    const results = [];
    for (const testCase of testCases) {
      const { input, expectedOutput } = testCase;
      let actualOutput = '';
      let passed = false;

      try {
        actualOutput = await new Promise((resolve, reject) => {
          const child = exec(`python ${pyFile}`, {
            timeout: 5000  // 5 second timeout
          });
          
          let output = '';
          let error = '';

          child.stdout.on('data', (data) => {
            output += data;
          });

          child.stderr.on('data', (data) => {
            error += data;
          });

          child.stdin.on('error', (err) => {
            if (err.code === 'EPIPE') {
              // Ignore EPIPE errors
              return;
            }
            reject(err);
          });

          child.on('close', (code) => {
            if (code !== 0) {
              reject(error || `Process exited with code ${code}`);
            } else {
              resolve(output);
            }
          });

          // Write input and end stdin
          try {
            child.stdin.write(input + '\n');
            child.stdin.end();
          } catch (err) {
            // Ignore write errors
          }
        });

    const normalize = str => str.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    passed = normalize(actualOutput) === normalize(expectedOutput);
    // console.log('actual')
    // console.log(normalize(actualOutput));
    // console.log('expected');
    // console.log(normalize(expectedOutput));
    // console.log(passed)
    console.log('\n')
      } catch (e) {
        actualOutput = typeof e === 'string' ? e : (e.message || 'Runtime error');
        passed = false;
      }

      results.push({
        input,
        expectedOutput,
        actualOutput,
        passed
      });
    }

    // Cleanup
    try {
      fs.unlinkSync(pyFile);
    } catch (err) {
      console.error('Error cleaning up:', err);
    }

    res.json({ results });
  } catch (err) {
    // Cleanup on error
    try {
      if (fs.existsSync(pyFile)) {
        fs.unlinkSync(pyFile);
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up:', cleanupErr);
    }

    return res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });
  }
});


app.get('/compiler', (req, res) => {
  res.status(200).send('Server is running -> No issues with /compiler');
});
app.get('/', (req, res) => {
  res.status(200).send('Server is running -> No issues without /compiler');
});
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});