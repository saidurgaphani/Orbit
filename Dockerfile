FROM node:24.14.1-alpine

# Set working directory
WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the backend source code
COPY backend/ .

# Expose port (Render default uses $PORT env)
EXPOSE 8080

# Use the environment variable PORT if provided, otherwise default to 8080
ENV PORT=${PORT:-8080}

# Start the server
CMD ["npm", "run", "start"]
