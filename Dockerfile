# --- build du front ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY server/package.json ./server/
RUN npm ci
COPY . .
RUN npm run build

# --- image finale ---
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 4000
# DATABASE_URL (PostgreSQL) doit être fourni via l'environnement.
CMD ["node", "server/src/index.js"]
