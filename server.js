const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(bodyParser.json());

app.post('/submit', async (req, res) => {
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
      exec(gccCmd, async (err, stdout, stderr) => {
      if (err) {
        fs.unlinkSync(cFile);
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
            child.stdin.write(input + '\n');
            child.stdin.end();
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

      fs.unlinkSync(cFile);
      fs.unlinkSync(exeFile);

      res.json({ results });
    });
  } catch (err) {
    if (fs.existsSync(cFile)) fs.unlinkSync(cFile);
    if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.status(200).send('Server is running -> No issues');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});