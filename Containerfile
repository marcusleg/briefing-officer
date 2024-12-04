FROM docker.io/library/node:22.12.0@sha256:e439f123f73545542424e39ebc5fd970f05f956eed9a48da5cbbd2894355cc0e AS build
WORKDIR /app

COPY . /app

ENV DATABASE_URL="file:/tmp/database.sqlite"
ENV OPENAI_API_KEY="any-value-will-do-at-build-time"
ENV OPENAI_API_URL="http://localhost"

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.12.0-slim@sha256:af534e18ad023c8dc7a420f636a1617f40887a57d4771a08a1ad045b837947d6
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
