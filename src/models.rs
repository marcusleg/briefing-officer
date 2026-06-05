use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Feed {
    pub id: Uuid,
    pub user_id: Uuid,
    pub category_id: Option<Uuid>,
    pub name: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}
