FROM node:22-bullseye
WORKDIR /usr/src/app

# Copy minimal files needed to install workspace deps
COPY package.json package-lock.json* ./
COPY server/package.json ./server/package.json

# Install workspace dependencies (includes devDeps like tsx)
RUN npm install --workspaces --no-audit --no-fund

EXPOSE 3001

# Default command: start the server in watch mode (overridden by compose if needed)
CMD ["sh", "-c", "cd server && npm run dev"]

