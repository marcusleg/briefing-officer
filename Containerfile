FROM docker.io/library/node:22.10.0@sha256:5c291843eb932b5e0e7b25ea2a43d7c951042917e9fc724d251feead3044630f AS build
WORKDIR /app

COPY . /app

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:22.10.0-slim@sha256:5f2f5525fe1350569d74785d4bce90f379cbfd5ab17afcb89e0a34988e0849eb
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
