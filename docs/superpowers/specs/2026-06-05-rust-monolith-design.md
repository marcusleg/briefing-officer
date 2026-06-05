# Design Spec: Rust Monolith Port

**Date**: 2026-06-05
**Status**: Draft

## Overview
This document outlines the architecture for a complete rewrite of the application from a Next.js/TypeScript stack to a high-performance, single-binary Rust monolith.

## Goals
- **Simplicity**: A single Rust binary handling both API and Frontend (via Leptos/WASM).
- **Performance**: Leverage Rust's concurrency for efficient web scraping and AI orchestration.
- **Portability**: Deployable via `Containerfile` to Kubernetes, Podman, and Docker.
- **Extensibility**: Support for any OpenAI-compatible API endpoint.

## Tech Stack
- **Language**: Rust
- **Web Framework**: Axum (Backend API & Server-Side Rendering)
- **Frontend**: Leptos (Full-stack, reactive UI via WASM/SSR)
- **Database**: PostgreSQL (with `sqlx` for type-safe queries)
- **Async Runtime**: Tokio
- **Containerization**: `Containerfile` using multi-stage builds and a **distroless** runtime image.

## Data Model

### `users`
- `id`: UUID (PK)
- `email`: String (Unique)
- `password_hash`: String
- `created_at`: Timestamp

### `categories`
- `id`: UUID (PK)
- `user_id`: UUID (FK to `users`)
- `name`: String

### `feeds`
- `id`: UUID (PK)
- `user_id`: UUID (FK to `users`)
- `category_id`: UUID (FK to `categories`, **Nullable**)
- `name`: String
- `enabled`: Boolean
- `created_at`: Timestamp

### `feed_sources`
- `id`: UUID (PK)
- `feed_id`: UUID (FK to `feeds`)
- `url`: String
- `last_scraped_at`: Timestamp (Nullable)
- `created_at`: Timestamp

### `articles`
- `id`: UUID (PK)
- `feed_id`: UUID (FK to `feeds`)
- `source_id`: UUID (FK to `feed_sources`)
- `title`: String
- `content_url`: String
- `summary`: Text
- `published_at`: Timestamp
- `scraped_at`: Timestamp
- `is_read`: Boolean (Default: false)

## Core Logic

### Scraping Engine
A background task running on a `tokio::time::interval` loop:
1. Identify enabled `feed_sources` requiring updates.
2. Fetch and parse content (RSS/Atom/HTML) using `reqwest` and `scraper`.
3. Detect new articles and insert into `articles`.
4. Trigger the AI Summarization Pipeline.

### AI Summarization Pipeline
A decoupled pipeline triggered by new article detection:
- **Configuration**: Supports any OpenAI-compatible endpoint via `OPENAI_API_BASE_URL` and `OPENAI_API_KEY`.
- **Functionality**: Generates concise (Type 1) and detailed (Type 2) summaries using LLM requests.

### API Endpoints (Axum)
- **Auth**: Signup, Sign-in, Sign-out.
- **Management**: CRUD for Categories, Feeds, and Feed Sources.
- **Consumption**: Fetching articles, marking as read, filtering by category/feed.

## Deployment
- **Containerization**: `Containerfile` for multi-platform compatibility (K8s, Podman, Docker).
- **Runtime**: Distroless image for security and minimal footprint.
- **Config**: Environment variables for DB and AI credentials.
