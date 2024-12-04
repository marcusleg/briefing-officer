FROM docker.io/library/node:22.12.0@sha256:1f0aa340dba56b9de84f817e6ce1df1d1edd77e1d7597f9d56087bd64582d7ff AS build
WORKDIR /app

COPY . /app

ENV DATABASE_URL="file:/tmp/database.sqlite"
ENV OPENAI_API_KEY="any-value-will-do-at-build-time"
ENV OPENAI_API_URL="http://localhost"

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.12.0-slim@sha256:1e3c0d7648ecb3425fc500d3d3abb1b1ff54e324045a898103944cb4eff92451
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
