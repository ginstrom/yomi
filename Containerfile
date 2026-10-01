# Keep in step with package.json "engines" and @types/node; scripts/*.ts
# rely on Node running TypeScript natively.
FROM node:26-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
