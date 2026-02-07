FROM docker.io/library/node:24.13.0 AS build
WORKDIR /app

COPY . /app

ENV AUTH_SECRET="any-value-will-do-at-build-time1"
ENV AZURE_OPENAI_API_KEY="0123456789abcdef"
ENV AZURE_OPENAI_MODEL="gpt-0-example"
ENV AZURE_OPENAI_RESOURCE_NAME="oai-example-dev-001"
ENV CRON_API_TOKEN="any-value-will-do-at-build-time"
ENV DATABASE_URL="file:/tmp/database.sqlite"
ENV OPENAI_API_KEY="any-value-will-do-at-build-time"
ENV OPENAI_API_URL="http://localhost"

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build
RUN npm prune --omit=dev


FROM docker.io/library/node:24.13.0-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

CMD npx prisma migrate deploy && npm run start
