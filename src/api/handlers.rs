use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, patch},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::repository::FeedRepository;
use crate::models::{Feed, Category, Article};

#[derive(Clone)]
pub struct AppState {
    pub feed_repo: Arc<FeedRepository>,
}

pub fn create_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/auth/sign-up", post(sign_up))
        .route("/auth/sign-in", post(sign_in))
        .route("/auth/sign-out", post(sign_out))
        .route("/categories", get(get_categories).post(create_category))
        .route("/feeds", get(get_feeds).post(create_feed))
        .route("/articles", get(get_articles))
        .route("/articles/:id/read", patch(mark_article_as_read))
        .with_state(state)
}

// --- Auth Handlers ---

#[derive(Deserialize)]
struct SignUpRequest {
            email: String,
            password: String,
}

#[derive(Deserialize)]
struct SignInRequest {
    email: String,
    password: String,
}

async fn sign_up(_state: State<AppState>, _payload: Json<SignUpRequest>) -> impl IntoResponse {
    StatusCode::CREATED
}

async fn sign_in(_state: State<AppState>, _payload: Json<SignInRequest>) -> impl IntoResponse {
    StatusCode::OK
}

async fn sign_out(_state: State<AppState>) -> impl IntoResponse {
    StatusCode::OK
}

// --- Management Handlers ---

async fn get_categories(_state: State<AppState>) -> impl IntoResponse {
    Json::<Vec<Category>>(vec![])
}

async fn create_category(_state: State<AppState>, _payload: Json<Category>) -> impl IntoResponse {
    StatusCode::CREATED
}

async fn get_feeds(state: State<AppState>) -> Result<Json<Vec<Feed>>, StatusCode> {
    match state.feed_repo.get_all_enabled().await {
        Ok(feeds) => Ok(Json(feeds)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn create_feed(_state: State<AppState>, _payload: Json<Feed>) -> impl IntoResponse {
    StatusCode::CREATED
}

// --- Consumption Handlers ---

async fn get_articles(_state: State<AppState>) -> impl IntoResponse {
    Json::<Vec<Article>>(vec![])
}

async fn mark_article_as_read(_state: State<AppState>, Path(_id): Path<uuid::Uuid>) -> impl IntoResponse {
    StatusCode::OK
}
