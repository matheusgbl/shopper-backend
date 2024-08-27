FROM node:20-alpine AS build

WORKDIR /

COPY package*.json .

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine AS production

WORKDIR /

COPY package*.json .

RUN npm ci --only=production

COPY --from=build /dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
