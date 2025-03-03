FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY index.js matchingEngine.js matchingEngine.test.js ./
COPY routes ./routes
COPY config ./config

RUN npm install

EXPOSE 3001

CMD ["node", "index.js"]
