FROM docker.io/library/node:22 AS build
WORKDIR /app

COPY . /app

RUN npm ci
RUN npx prisma generate
RUN npm run build


FROM docker.io/library/node:22-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
