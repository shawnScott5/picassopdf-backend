FROM node:20-slim

# Install dependencies needed for Chromium
RUN apt-get update && apt-get install -y \
  chromium \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libasound2 \
  libxss1 \
  libgtk-3-0

# Set environment variable to use system installed browser
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create playwright directory and symlink system chromium
RUN mkdir -p /usr/lib/playwright/chromium-1000 && \
    ln -sf /usr/bin/chromium /usr/lib/playwright/chromium-1000/chrome-linux/chrome

# Expose port
EXPOSE 10000

# Start the application
CMD ["node", "server.js"]
