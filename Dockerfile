FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev --prefer-offline --no-audit --no-fund
COPY . .
EXPOSE 8000
CMD ["node", "src/server.js"]
