# Use official Node.js LTS image
FROM node:lts

# Install gcc for compiling C code
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the application code
COPY server.js ./

# Expose the port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
