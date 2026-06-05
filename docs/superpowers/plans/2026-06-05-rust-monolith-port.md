# Rust Monolith Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the application to a single-binary Rust monolith.

**Architecture:** A single Axum server handling the API, background scraping, and serving a Leptos (WASM/SSR) frontend.

**Tech Stack:** Rust, Axum, Leptos, sqlx, PostgreSQL, Tokio, reqwest, scraper.

---

### Task 1: Project Scaffolding & Database Setup

**Files:**
- Create: `Cargo.toml`
- Create: `Containerfile`
- Create: `migrations/0001_init.sql`
- Create: `.env`

- [ ] **Step 1: Define Cargo dependencies**

```toml
[package]
name = "rust-monolith-port"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1.0", features = "full" }
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono"] }
leptos = { version = "0.6", features = ["ssr", "hydrate"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1.0", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
dotenvy = "0.15"
reqwest = { version = "0.11", features = ["json"] }
scraper = "0.18"
```

- [ ] **Step 2: Create the initial SQL migration**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);

CREATE TABLE feeds (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE feed_sources (
    id UUID PRIMARY KEY,
    feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE articles (
    id UUID PRIMARY KEY,
    feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_url TEXT NOT NULL,
    summary TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE
);
```

- [ ] **Step 3: Create the Containerfile (Distroless)**

```dockerfile
FROM rust:1.75-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/rust-monolith-port /app/rust-monolith-port
CMD ["/app/rust-monolith_port"]
```

- [ ] **Step 4: Commit**

```bash
git add Cargo.toml Containerfile migrations/0001_init.sql .env
git commit -m "feat: initial project scaffolding and database schema"
```

### Task 2: Database Connection & Repository Layer

**Files:**
- Create: `src/main.rs`
- Create: `src/db.rs`
- Create: `src/repository/mod.rs`
- Create: `src/repository/feed_repository.rs`

- [ ] **Step 1: Implement database connection pool in `src/db.rs`**

```rust
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::env;

pub async fn create_pool() -> PgPool {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to create pool")
}
```

- [ ] **Step 2: Implement basic Feed Repository in `src/repository/feed_repository.rs`**

```rust
use sqlx::PgPool;
use uuid::Uuid;

pub struct FeedRepository {
    pool: PgPool,
}

impl FeedRepository {
    pub fn new(pool: Pgpool) -> Self {
        Self { pool }
    }

    pub async fn get_all_enabled(&self) -> Result<Vec<Feed>, sqlx::Error> {
        sqlx::query_as!(Feed, "SELECT * FROM feeds WHERE enabled = true")
            .fetch_all(&self.pool)
            .await
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/db.rs src/repository/mod.rs src/repository/feed_repository.rs
git commit -m "feat: implement database connection and feed repository"
```

### Task 3: Scraping & AI Engine

**Files:**
- Create: `src/scraper/mod.rs`
- Create: `src/ai/mod.rs`
- Create: `src/worker.rs`

- [ ] **Step 1: Implement Scraper logic**
- [ ] **Step 2: Implement OpenAI-compatible AI client**
- [ ] **Step 3: Implement the background worker loop**
- [ ] **Step 4: Commit**

### Task 4: API Layer (Axum)

**Files:**
- Create: `src/api/mod.rs`
- Create: `src/api/handlers.rs`

- [ ] **Step 1: Implement Auth routes**
- [ ] **Step 2: Implement Feed/Category CRUD routes**
- [ ] **Step 3: Commit**

### Task 5: Frontend (Leptos)

**Files:**
- Create: `src/frontend/mod.rs`
- Create: `src/frontend/components/mod.rs`

- [ ] **Step 1: Setup Leptos SSR/WASM scaffolding**
- [ ] **Step 2: Implement Feed list and Article view**
- [ ] **Step 3: Commit**
