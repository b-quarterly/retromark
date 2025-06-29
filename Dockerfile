FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run package
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/public ./public
COPY --from=builder /app/presets ./presets
COPY --from=builder /app/src/themes ./src/themes
COPY --from=builder /app/retro.yml ./retro.yml
ENTRYPOINT ["node", "./bin/retromark.js"]
CMD ["--help"]
