FROM node:22-bullseye
WORKDIR /usr/src/app

# Copy minimal files needed to install workspace deps
COPY package.json package-lock.json* ./
COPY client/package.json ./client/package.json

# Install workspace dependencies (includes devDeps like vite)
RUN npm install --workspaces --no-audit --no-fund

EXPOSE 5173

# Default command: start Vite dev server (overridden by compose if needed)
CMD ["sh", "-c", "cd client && npm run dev -- --host 0.0.0.0"]

