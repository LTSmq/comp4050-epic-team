FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN MONGODB_URI=mongodb://127.0.0.1:27017 MONGODB_DB=fitvisualizer JWT_SECRET=build-placeholder npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 8080
CMD ["node", "node_modules/next/dist/bin/next", "start"]
