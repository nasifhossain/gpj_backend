# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including nodemon for dev)
RUN npm install

# Copy application files
COPY . .

# Expose the port
EXPOSE 8000

# Set default environment to production
ENV NODE_ENV=production

# Start the application based on NODE_ENV
CMD if [ "$NODE_ENV" = "development" ]; then npm run dev; else npm start; fi
