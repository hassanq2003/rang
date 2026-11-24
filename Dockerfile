# Rang game server (Socket.io). Used by Railway / any Docker host. Listens on $PORT.
FROM node:24-slim
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev
COPY server/index.ts server/
COPY src/game/rang.ts src/game/
ENV NODE_ENV=production
CMD ["node", "server/index.ts"]
