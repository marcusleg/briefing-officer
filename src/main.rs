use std::net::SocketAddr;
use dotenvy::dotenv;
use std::sync::Arc;
use axum::Router;

mod api;
mod db;
mod models;
mod repository;
mod frontend;

use crate::repository::FeedRepository;
use crate::api::handlers::AppState;

#[tokio::main]
async fn main() {
    dotenv().ok();
    let pool = db::create_pool().await;
    let feed_repo = Arc::new(FeedRepository::new(pool.clone()));
    let state = AppState {
        feed_repo: feed_repo.clone(),
    };
    
    let app = api::handlers::create_router(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app.into_make_service()).await.unwrap();
}
