FROM docker.io/library/node:23.1.0@sha256:840dad0077213cadd2d734d542ae11cd0f648200be29504eb1b6e2c995d2b75a AS build
WORKDIR /app

COPY . /app

ENV DATABASE_URL="file:/tmp/database.sqlite"

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:23.1.0-slim@sha256:64269df7ff9275757982994f6ee37268367d924f5f9086b5b0ed2e81e7c2ff20
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
