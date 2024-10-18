FROM docker.io/library/node:22.10.0@sha256:f99edd2b6668ef0cf395f37c0be18f1e38b6a608837e159c3fdce63642c3943d AS build
WORKDIR /app

COPY . /app

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.10.0-slim@sha256:7dd4a8d231f0f72d9fc932fd5ba1e06fcc375a5948fb229630c8901de2c7650f
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
