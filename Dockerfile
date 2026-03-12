FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["npm", "start"]
