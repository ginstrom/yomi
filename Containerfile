# Keep in step with package.json "engines" and @types/node; scripts/*.ts
# rely on Node running TypeScript natively.
FROM node:26-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Headless Chromium (all the in-browser tests launch) with the system libraries it needs. It
# goes outside /app, as node_modules there is hidden by the volume the Makefile
# mounts. Playwright fetches the build its own version wants, so this layer
# follows the lockfile above.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps --only-shell chromium

COPY . .

EXPOSE 5173
