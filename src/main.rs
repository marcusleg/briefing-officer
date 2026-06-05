use axum::{routing::get, Router};
use std::net::SocketAddr;
use dotenvy::dotenv;
use std::sync::Arc;

mod db;
mod models;
mod repository;

use crate::repository::FeedRepository;

#[tokio::main]
async fn main() {
    dotenv().ok();
    let pool = db::create_pool().await;
    let feed_repo = Arc::new(FeedRepository::new(pool.clone()));
    
    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .with_state(feed_repo);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
