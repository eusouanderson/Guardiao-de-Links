FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production --prefer-offline --no-audit --no-fund
COPY . .
EXPOSE 8000
CMD ["node", "server.js"]
