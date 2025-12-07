# Briefing Officer

AI summaries for your favorite news feeds.

![Screenshot of Briefing Officer](./screenshot.png)

## Features

- News reader with RSS and Atom support.
- Three types of AI summaries:
  - Short descriptions that summarize the article instead of just teasing it.
  - A bullet-point list of the key points and takeaways.
  - Executive summary, a detailed summary containing all the original
    information but very condensed.
- Save articles for later using the "Read Later" and "Star" feature.
- Support for multiple AI providers (currently Azure OpenAI and Anthropic).
- Multi-user support.
- Dark mode.
- Mobile friendly design.

## Getting Started

```bash
docker run -it --rm \
  -e DATABASE_URL=file:/data/database.sqlite \
  -e AZURE_OPENAI_RESOURCE_NAME=oai-example-dev-001 \
  -e AZURE_OPENAI_API_KEY=lorem-ipsum \
  -e BETTER_AUTH_SECRET=something-random \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e CRON_API_TOKEN=something-else-random \
  -p 3000:3000 \
  ghcr.io/marcusleg/briefing-officer
```
