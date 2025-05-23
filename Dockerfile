# Generated by https://smithery.ai. See: https://smithery.ai/docs/build/project-config
# syntax=docker/dockerfile:1.4
FROM node:lts-alpine AS builder
WORKDIR /app

# install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install

# build TypeScript
COPY . .
RUN npm run build

# runtime image
FROM node:lts-alpine AS runner
WORKDIR /app
# copy production dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install --omit=dev
# copy built files
COPY --from=builder /app/dist ./dist

EXPOSE 8080
# default command
CMD ["node","dist/index.js"]
