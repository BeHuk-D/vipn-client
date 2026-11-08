use std::sync::Arc;

use crate::config::Config;
use crate::db::Db;
use crate::ratelimit::RateLimiter;

pub struct AppState {
    pub db: Arc<Db>,
    pub config: Config,
    pub limiter: RateLimiter,
    pub login_limiter: RateLimiter,
    pub user_login_limiter: RateLimiter,
    pub password_limiter: RateLimiter,
    pub register_limiter: RateLimiter,
}

pub type SharedState = Arc<AppState>;
