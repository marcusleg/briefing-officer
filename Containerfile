FROM dhi.io/node:24.12.0-dev AS build
WORKDIR /app

COPY . /app

ENV AZURE_OPENAI_API_KEY="0123456789abcdef"
ENV AZURE_OPENAI_RESOURCE_NAME="oai-example-dev-001"
ENV AUTH_SECRET="any-value-will-do-at-build-time0"
ENV CRON_API_TOKEN="any-value-will-do-at-build-time"
ENV DATABASE_URL="file:/tmp/database.sqlite"
ENV OPENAI_API_KEY="any-value-will-do-at-build-time"
ENV OPENAI_API_URL="http://localhost"

RUN npm ci
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build
RUN npm prune --omit=dev

FROM dhi.io/node:24.12.0-debian13
WORKDIR /app

COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public /app/public
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package*.json .

CMD node node_modules/prisma/build/index.js migrate deploy && node node_modules/next/dist/bin/next start
