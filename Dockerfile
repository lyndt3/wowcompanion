FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3300

ENV PORT=3300 \
    NODE_ENV=production

CMD ["node", "server.js"]
