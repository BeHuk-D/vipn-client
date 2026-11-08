mod api;
mod auth;
mod conf;
mod config;
mod crypto;
mod db;
mod error;
mod ratelimit;
mod state;

use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use tracing_subscriber::EnvFilter;

use crate::config::Config;
use crate::db::Db;
use crate::ratelimit::RateLimiter;
use crate::state::{AppState, SharedState};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let config = Config::from_env();
    let db = Db::open(&config.db_path)?;
    db.seed_admin(config.admin_email.as_deref(), config.admin_password.as_deref())?;
    crypto::verify_dummy("");

    let state: SharedState = Arc::new(AppState {
        db,
        config: config.clone(),
        limiter: RateLimiter::new(120, Duration::from_secs(60)),
        login_limiter: RateLimiter::new(5, Duration::from_secs(60)),
        user_login_limiter: RateLimiter::new(5, Duration::from_secs(60)),
        password_limiter: RateLimiter::new(5, Duration::from_secs(600)),
        register_limiter: RateLimiter::new(3, Duration::from_secs(3600)),
    });

    let app = api::router(state);
    let listener = tokio::net::TcpListener::bind(&config.bind).await?;
    tracing::info!(addr = %config.bind, public_url = %config.public_base_url, "vipn-panel listening");
    axum::serve(listener, app).await?;
    Ok(())
}
