FROM docker.io/library/node:22.9.0@sha256:5f1c795962b43876b4f35957cb85f362eafbc879312dd8f904e24246aa506f49 AS build
WORKDIR /app

COPY . /app

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.9.0-slim@sha256:713d770035d11331e61cb2cde6c50520281be5fe5dc69a6e98dec1b4b4a2b050
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
