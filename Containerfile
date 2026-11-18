FROM docker.io/library/node:26.13.0 AS build
WORKDIR /app

ENV AUTH_SECRET="any-value-will-do-at-build-time1"
ENV AZURE_OPENAI_API_KEY="0123456789abcdef"
ENV AZURE_OPENAI_MODEL="gpt-0-example"
ENV AZURE_OPENAI_RESOURCE_NAME="oai-example-dev-001"
ENV DATABASE_URL="file:/tmp/database.sqlite"
ENV OPENAI_API_KEY="any-value-will-do-at-build-time"
ENV OPENAI_API_URL="http://localhost"

# Install dependencies before copying the sources so a source-only change
# reuses the cached install.
COPY package.json package-lock.json /app/
RUN npm ci

# The Prisma CLI applies migrations when the container starts, but the
# standalone server does not include it. Copy the CLI and everything it
# depends on out of the install above.
RUN mkdir /prisma-cli \
    && npm query '#prisma, #prisma *, #dotenv' \
    | node -p 'JSON.parse(fs.readFileSync(0, "utf8")).map((p) => p.location).join("\n")' \
    | xargs cp -a --parents -t /prisma-cli

COPY . /app
RUN npx prisma generate
RUN npx prisma db push
RUN npm run build


FROM docker.io/library/node:26.13.0-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /prisma-cli/node_modules /app/migrate/node_modules
COPY prisma.config.ts /app/migrate/prisma.config.ts
COPY prisma /app/migrate/prisma

COPY --from=build /app/.next/standalone /app
COPY --from=build /app/.next/static /app/.next/static
COPY --from=build /app/public /app/public

# HOSTNAME is set on the command line because container runtimes set it to
# the pod or container name, and server.js binds to whatever it holds.
CMD (cd migrate && node node_modules/prisma/build/index.js migrate deploy) \
    && HOSTNAME=0.0.0.0 exec node server.js
