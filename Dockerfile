FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
WORKDIR /app
RUN npm install --global pnpm@10.20.0
COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile --prod --filter @mandate/api...
USER node
ENV APP_ENV=production API_HOST=0.0.0.0 API_PORT=3000
EXPOSE 3000
CMD ["packages/platform/node_modules/.bin/tsx", "apps/api/src/main.ts"]
