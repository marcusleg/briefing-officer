# Briefing Officer

AI summaries for your favorite news feeds.

## Prerequisites

- An OpenAI API-compatible Large Language Model (LLM) or LLM Proxy (e.g. [LiteLLM](https://github.com/BerriAI/litellm)) 

## Getting Started

```
docker run -it --rm \
  -e DATABASE_URL=file:../data/database.sqlite \
  -e OPENAI_API_URL=http://localhost:4000 \
  -e OPENAI_API_KEY=lorem-ipsum \
  -p 3000:3000 \
  ghcr.io/marcusleg/briefing-officer:unstable
```

## Dependency documentation

To learn more about dependencies, take a look at the following resources:

- [Next.js](https://nextjs.org/docs)
- [Prisma ORM](https://www.prisma.io/docs/orm)
- [Tailwind CSS](https://tailwindcss.com/docs/installation)
- [shadcn/ui](https://ui.shadcn.com/docs)
- [Lucide Icons](https://lucide.dev/icons/)
