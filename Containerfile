FROM docker.io/library/node:22.9.0@sha256:8398ea18b8b72817c84af283f72daed9629af2958c4f618fe6db4f453c5c9328 AS build
WORKDIR /app

COPY . /app

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.9.0-slim@sha256:4fd4447d2a0b726763799eac6cf2e7eac5b32806af6aea7f3075cb79946140be
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
