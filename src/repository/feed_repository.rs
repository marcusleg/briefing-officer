use sqlx::PgPool;
use crate::models::Feed;

pub struct FeedRepository {
    pool: PgPool,
}

impl FeedRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_all_enabled(&self) -> Result<Vec<Feed>, sqlx::Error> {
        sqlx::query_as!(
            Feed,
            "SELECT id, user_id, category_id, name, enabled, created_at FROM feeds WHERE enabled = true"
        )
        .fetch_all(&self.pool)
        .await
    }
}
