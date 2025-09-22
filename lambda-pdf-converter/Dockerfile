# Use AWS Lambda Node.js 20 base image
FROM public.ecr.aws/lambda/nodejs:20

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/var/task/.playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

# Set working directory
WORKDIR /var/task

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Install Playwright browsers (Chromium only)
RUN npx playwright install chromium

# Copy your Lambda function code
COPY index.js ./

# Lambda CMD
CMD ["index.handler"]
