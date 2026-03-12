FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start Next.js (worker is initialized via instrumentation)
CMD ["npm", "start"]
