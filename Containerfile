FROM docker.io/library/node:22.11.0@sha256:cb244536f6047c0057f1c6d90ae404880155c49b78fe2e8f25ef90c4fa7127a6 AS build
WORKDIR /app

COPY . /app

ENV DATABASE_URL="file:/tmp/database.sqlite"
ENV OPENAI_API_KEY="any-value-will-do-at-build-time"
ENV OPENAI_API_URL="http://localhost"

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.11.0-slim@sha256:f035ba7ffee18f67200e2eb8018e0f13c954ec16338f264940f701997e3c12da
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
