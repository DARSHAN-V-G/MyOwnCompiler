# MyOwnCompiler

A secure, scalable C compiler service built with Node.js that provides a REST API for compiling and executing C code with test case validation.

## 🚀 Features

- **Secure Code Execution**: Built-in security measures to prevent malicious code execution
- **Test Case Validation**: Submit C code with multiple test cases for automated validation
- **Load Balanced Architecture**: Nginx load balancing across 10 Docker containers for high availability
- **Compilation Safety**: Comprehensive error handling and timeout protection
- **Cross-Platform Support**: Dockerized environment ensures consistent behavior across platforms
- **RESTful API**: Simple HTTP API for easy integration with frontend applications

## 🏗️ Architecture

The service consists of several key components:

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────────┐
│   Client App    │────│    nginx     │────│  Node.js Containers │
│   (Frontend)    │    │ Load Balancer│    │     (c1 - c10)      │
└─────────────────┘    └──────────────┘    └─────────────────────┘
                              │                       │
                              └───────────────────────┘
                                   Port 6004 → 9000
```

### Components:

1. **Express Server** (`server.js`): Core API server handling code compilation and execution
2. **nginx Load Balancer**: Distributes requests across multiple container instances
3. **Docker Containers**: 10 isolated instances for parallel processing
4. **GCC Compiler**: Integrated C compiler with security restrictions

## 📦 Installation & Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 22.x+ (for local development)
- GCC compiler (included in Docker image)

### Quick Start with Docker

1. **Clone the repository**:
```bash
git clone https://github.com/akashShanmugraj/MyOwnCompiler.git
cd MyOwnCompiler
```

2. **Build the Docker image**:
```bash
docker build -t compiler:latest .
```

3. **Start the services**:
```bash
docker-compose up -d
```

4. **Verify the service is running**:
```bash
curl http://localhost:6004/
# Expected response: "Server is running -> No issues"
```

### Local Development Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Start the development server**:
```bash
node server.js
```

The server will be available at `http://localhost:3000`

## 🔌 API Documentation

### Base URL
- **Production**: `http://localhost:6004` (load-balanced)
- **Development**: `http://localhost:3000` (single instance)

### Endpoints

#### `GET /`
Health check endpoint.

**Response:**
```
Server is running -> No issues
```

#### `POST /submit-c`
Submit C code for compilation and execution with test cases.

**Request Body:**
```json
{
  "code": "string",        // C source code
  "testCases": [           // Array of test cases
    {
      "input": "string",           // Input to provide to the program
      "expectedOutput": "string"   // Expected output from the program
    }
  ],
  "submissionid": "string" // Unique identifier for this submission
}
```

**Example Request:**
```json
{
  "code": "#include <stdio.h>\nint main() {\n    int a, b;\n    scanf(\"%d %d\", &a, &b);\n    printf(\"%d\\n\", a + b);\n    return 0;\n}",
  "testCases": [
    {
      "input": "5 3",
      "expectedOutput": "8"
    },
    {
      "input": "10 15", 
      "expectedOutput": "25"
    }
  ],
  "submissionid": "submission_123"
}
```

**Success Response (200):**
```json
{
  "results": [
    {
      "input": "5 3",
      "expectedOutput": "8", 
      "actualOutput": "8",
      "passed": true
    },
    {
      "input": "10 15",
      "expectedOutput": "25",
      "actualOutput": "25", 
      "passed": true
    }
  ]
}
```

**Error Responses:**

- **400 Bad Request**: Missing required fields, compilation errors, or malicious code detected
- **500 Internal Server Error**: Server-side execution errors

#### `POST /submit-python`
Submit C code for compilation and execution with test cases.

**Request Body:**
```json
{
  "code": "string",        // C source code
  "testCases": [           // Array of test cases
    {
      "input": "string",           // Input to provide to the program
      "expectedOutput": "string"   // Expected output from the program
    }
  ],
  "submissionid": "string" // Unique identifier for this submission
}
```

**Example Request:**
```json
{
  "code": "n = int(input())\nnumbers = []\nfor _ in range(n):\n    numbers.append(int(input()))\nprint(sum(numbers))",
  "testCases": [
    {
      "input": "3\n1\n2\n3",
      "expectedOutput": "6"
    },
    {
      "input": "4\n10\n20\n30\n40",
      "expectedOutput": "100"
    }
  ],
  "submissionid": "sum-array-py-001"
}
```

**Success Response (200):**
```json
{
    "results": [
        {
            "input": "3\n1\n2\n3",
            "expectedOutput": "6",
            "actualOutput": "6\n",
            "passed": true
        },
        {
            "input": "4\n10\n20\n30\n40",
            "expectedOutput": "100",
            "actualOutput": "100\n",
            "passed": true
        }
    ]
}
```

**Error Responses:**

- **400 Bad Request**: Missing required fields, compilation errors, or malicious code detected
- **500 Internal Server Error**: Server-side execution errors


## 🔒 Security Features

The service implements multiple security layers to prevent malicious code execution:

### Dangerous Function Detection
The following functions are blocked to prevent system exploitation:
- File operations: `fopen`, `freopen`, `remove`, `rename`, `tmpfile`, etc.
- System calls: `system`, `exec`, `fork`, `popen`, etc.
- Memory operations: `memcpy`, `memmove` (in unsafe contexts)
- Network operations: `socket`, `connect`, `listen`, `accept`, etc.
- Process control: `kill`, `signal`, `raise`, etc.

### Execution Limits
- **Compilation timeout**: 10 seconds maximum
- **Execution timeout**: 5 seconds per test case
- **Process isolation**: Each execution runs in a separate process
- **Automatic cleanup**: Temporary files are safely deleted after execution

### Input Validation
- All request fields are validated for presence and type
- Code content is scanned for dangerous patterns
- Submission IDs are used to prevent file conflicts

## 🐳 Docker Deployment

### Container Architecture
The deployment uses:
- **1 nginx container**: Load balancer and reverse proxy
- **10 Node.js containers**: Application servers (c1-c10)
- **Custom network**: Isolated bridge network for inter-container communication

### Configuration Files
- `Dockerfile`: Node.js application container definition
- `docker-compose.yml`: Multi-container orchestration
- `conf/nginx.conf`: Load balancer configuration

### Scaling
To modify the number of application containers:

1. Edit `docker-compose.yml` to add/remove service definitions
2. Update `conf/nginx.conf` upstream configuration
3. Rebuild and restart: `docker-compose up -d --build`

## 🛠️ Development Workflow

### Code Structure
```
MyOwnCompiler/
├── server.js              # Main application server
├── package.json           # Node.js dependencies
├── Dockerfile             # Container definition
├── docker-compose.yml     # Multi-container setup
├── conf/
│   └── nginx.conf         # Load balancer config
└── README.md             # This file
```

### Key Functions
- `safeDeleteFile()`: Robust file cleanup with retry logic
- `POST /submit` handler: Main code processing pipeline
- Security validation: Pattern matching for dangerous functions

### Testing Your Changes

1. **Test locally**:
```bash
node server.js
curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  -d '{"code":"#include <stdio.h>\nint main(){printf(\"Hello World\");return 0;}", "testCases":[{"input":"", "expectedOutput":"Hello World"}], "submissionid":"test1"}'
```

2. **Test with Docker**:
```bash
docker build -t compiler:latest .
docker-compose up -d
curl http://localhost:6004/
```

## 🤝 Contributing

### Guidelines
1. **Security First**: Any changes must maintain or improve security measures
2. **Test Coverage**: Test both successful and error scenarios
3. **Documentation**: Update README for any API or architecture changes
4. **Code Style**: Follow existing patterns and include proper error handling

### Common Development Tasks

**Adding new security restrictions**:
- Update the `dangerousFunctions` array in `server.js`
- Test with various malicious code samples

**Modifying compilation options**:
- Update the `gccCmd` variable in the `/submit` endpoint
- Ensure timeout and error handling remain intact

**Scaling adjustments**:
- Modify container count in `docker-compose.yml`
- Update nginx upstream configuration accordingly

### Reporting Issues
When reporting bugs or requesting features:
- Include code samples that demonstrate the issue
- Specify whether the problem occurs in local or Docker environments
- Provide logs from both the Node.js server and nginx (if applicable)

## 📝 License

This project is available for educational and non-commercial use. Please respect the security measures implemented and use responsibly.

## 🔧 Troubleshooting

### Common Issues

**"Server is not responding"**:
- Check if Docker containers are running: `docker ps`
- Verify port availability: `netstat -tulpn | grep 6004`

**"Compilation timeout"**:
- Code may have infinite loops or complex operations
- Check the 10-second compilation limit is appropriate for your use case

**"Malicious function detected"**:
- Review the security section for blocked functions
- Ensure your C code doesn't use restricted system calls

**File cleanup errors (Windows)**:
- The service includes retry logic for file deletion issues
- Warnings about cleanup failures are logged but don't crash the service