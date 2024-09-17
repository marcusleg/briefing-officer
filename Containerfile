FROM docker.io/library/node:22.8.0@sha256:bd00c03095f7586432805dbf7989be10361d27987f93de904b1fc003949a4794 AS build
WORKDIR /app

COPY . /app

RUN npm ci
RUN npx prisma generate
RUN npm run build


FROM docker.io/library/node:22.8.0-slim@sha256:377674fd5bb6fc2a5a1ec4e0462c4bfd4cee1c51f705bbf4bda0ec2c9a73af72
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
