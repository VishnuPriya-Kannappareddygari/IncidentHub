# Single-service image: builds the React client and serves it from the Express API.
FROM node:20-bookworm-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# Empty = same origin (the API serves the UI), so no CORS or API URL needed.
ENV VITE_API_URL=""
RUN npm run build

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate
COPY --from=client /app/client/dist /app/client/dist
# Most hosts inject PORT; the server reads it and binds 0.0.0.0.
EXPOSE 4000
# Apply pending migrations (never `migrate dev`), then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
