# Use the official Microsoft Playwright image which includes Node.js and all browser dependencies
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Install Java JRE (required for Allure report generation)
RUN apt-get update && apt-get install -y default-jre && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Google Chrome for Playwright MCP compatibility
RUN npx playwright install chrome

# Copy the rest of the application files
COPY . .

# Set environment variables
ENV PORT=3000

# Expose ports if running server
EXPOSE 3000

# Default command: initialize databases, run the agent, generate allure report, and exit with the correct test status code
CMD ["sh", "-c", "npm run db:init && (npm start scenarios.yaml; EXIT_CODE=$?; npx allure generate allure-results --clean -o test-results/allure-report; exit $EXIT_CODE)"]
