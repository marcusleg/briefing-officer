FROM docker.io/library/node:22.9.0@sha256:188193aa85489bfc9751402d63f5f105ec7c3f42ae8519cb93e9c1f85a471c23 AS build
WORKDIR /app

COPY . /app

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.9.0-slim@sha256:ddd35141c4d266ea6ed7a037892a0c61b5fa415976494977166afaa118cc6b30
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
