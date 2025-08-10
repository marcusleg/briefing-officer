FROM docker.io/library/node:24.2.0 AS build
WORKDIR /app

COPY . /app

ENV AZURE_OPENAI_API_KEY="0123456789abcdef"
ENV AZURE_OPENAI_RESOURCE_NAME="oai-example-dev-001"
ENV BETTER_AUTH_SECRET="any-value-will-do-at-build-time"
ENV CRON_API_TOKEN="any-value-will-do-at-build-time"
ENV DATABASE_URL="file:/tmp/database.sqlite"
ENV OPENAI_API_KEY="any-value-will-do-at-build-time"
ENV OPENAI_API_URL="http://localhost"

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:24.2.0-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

RUN npm prune --omit=dev

CMD npx prisma migrate deploy && npm run start
