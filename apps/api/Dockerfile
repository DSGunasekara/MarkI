FROM node:20-alpine

WORKDIR /app

ENV CI=true

RUN corepack enable && apk add --no-cache git docker-cli

COPY . .

RUN pnpm install --frozen-lockfile

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @hiring-engine/db migrate && pnpm --filter api exec tsx src/index.ts"]
