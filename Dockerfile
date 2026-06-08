FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source code and config files
COPY . .

# Expose app port (if needed, though tests don't strictly require it, it's good for the app)
EXPOSE 3000
