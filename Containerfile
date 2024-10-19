FROM docker.io/library/node:22.10.0@sha256:545b0979454e889c3a49a4b2dff2c80cdb4ab37ac3e7053ecc1257b097dc81d5 AS build
WORKDIR /app

COPY . /app

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.10.0-slim@sha256:e09207f9eca57bc0f93f35f5e252f46ce4c8f86cf2ab4ede5e2a75d1dbc9ae74
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
