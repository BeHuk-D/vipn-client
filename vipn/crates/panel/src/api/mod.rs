pub mod account;
pub mod admin;
pub mod agent;
pub mod public;
pub mod users;

use axum::http::header::SET_COOKIE;
use axum::http::{HeaderMap, HeaderValue};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use rusqlite::Connection;
use serde_json::Value;

use crate::crypto;
use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

pub const REFERRAL_REWARD_KOPECKS: i64 = 2_500;
pub const REFERRAL_DISCOUNT_KOPECKS: i64 = 2_500;

pub fn router(state: SharedState) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/app.js", get(app_js))
        .route("/style.css", get(style_css))
        .route("/account", get(account_redirect))
        .route("/account/", get(account_index))
        .route("/account/app.js", get(account_app_js))
        .route("/account/style.css", get(style_css))
        .route("/api/login", post(admin::login))
        .route("/api/logout", post(admin::logout))
        .route("/api/me", get(admin::me))
        .route("/api/keys", get(admin::list_keys).post(admin::create_key))
        .route("/api/keys/{id}", get(admin::get_key).patch(admin::patch_key))
        .route("/api/keys/{id}/devices", post(admin::create_device))
        .route("/api/devices/{id}/rotate", post(admin::rotate_device))
        .route("/api/devices/{id}/revoke", post(admin::revoke_device))
        .route("/api/devices/{id}/unbind", post(admin::unbind_device))
        .route("/api/devices", get(admin::list_devices))
        .route("/api/devices/{id}", patch(admin::patch_device))
        .route("/api/metrics", get(admin::metrics))
        .route("/api/speedtest", post(admin::speedtest))
        .route("/api/servers", get(admin::list_servers).post(admin::create_server))
        .route("/api/servers/{id}", patch(admin::patch_server))
        .route("/api/servers/{id}/agent-token", post(admin::rotate_agent_token))
        .route("/api/audit", get(admin::list_audit))
        .route("/api/stats", get(admin::stats))
        .route("/api/users", get(users::list))
        .route("/api/users/{id}", get(users::detail).patch(users::patch))
        .route("/api/users/{id}/password-reset", post(users::reset_password))
        .route("/api/users/{id}/subscription", post(users::grant_subscription))
        .route("/api/users/{id}/balance", post(users::adjust_balance))
        .route("/api/account/register", post(account::register))
        .route("/api/account/login", post(account::login))
        .route("/api/account/logout", post(account::logout))
        .route("/api/account/me", get(account::me))
        .route("/api/account/subscription", get(account::subscription))
        .route("/api/account/password", post(account::change_password))
        .route("/api/agent/state", get(agent::state))
        .route("/api/agent/report", post(agent::report))
        .route("/s/{token}", get(public::subscription))
        .with_state(state)
}

async fn index() -> impl IntoResponse {
    static_html(include_str!("../ui/index.html"), "text/html; charset=utf-8")
}

async fn app_js() -> impl IntoResponse {
    static_html(include_str!("../ui/app.js"), "application/javascript; charset=utf-8")
}

async fn account_redirect() -> impl IntoResponse {
    axum::response::Redirect::permanent("/account/")
}

async fn account_index() -> impl IntoResponse {
    static_html(include_str!("../ui/account/index.html"), "text/html; charset=utf-8")
}

async fn account_app_js() -> impl IntoResponse {
    static_html(include_str!("../ui/account/app.js"), "application/javascript; charset=utf-8")
}

async fn style_css() -> impl IntoResponse {
    static_html(include_str!("../ui/style.css"), "text/css; charset=utf-8")
}

fn static_html(body: &'static str, content_type: &'static str) -> Response {
    (
        [
            ("content-type", content_type),
            ("cache-control", "no-store"),
            ("x-content-type-options", "nosniff"),
            ("x-frame-options", "DENY"),
            ("referrer-policy", "same-origin"),
            (
                "content-security-policy",
                "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
            ),
        ],
        body,
    )
        .into_response()
}

pub fn client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-real-ip")
        .or_else(|| headers.get("x-forwarded-for"))
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(',').next().unwrap_or(value).trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub fn guard_origin(state: &SharedState, headers: &HeaderMap) -> ApiResult<()> {
    let Some(origin) = headers.get("origin").and_then(|value| value.to_str().ok()) else {
        return Ok(());
    };
    let origin = origin.trim_end_matches('/');
    if origin.eq_ignore_ascii_case(state.config.public_base_url.trim_end_matches('/')) {
        return Ok(());
    }
    let host = headers.get("host").and_then(|value| value.to_str().ok());
    if let (Some(origin_host), Some(host)) = (origin_host(origin), host) {
        if origin_host.eq_ignore_ascii_case(host.trim()) {
            return Ok(());
        }
    }
    Err(ApiError::Forbidden("недопустимый origin"))
}

fn origin_host(origin: &str) -> Option<&str> {
    let (_, rest) = origin.split_once("://")?;
    let host = rest.split('/').next()?;
    if host.is_empty() {
        None
    } else {
        Some(host)
    }
}

pub fn limit(state: &SharedState, bucket: &str, key: &str) -> ApiResult<()> {
    let key = format!("{bucket}:{key}");
    if state.limiter.check(&key) {
        Ok(())
    } else {
        Err(ApiError::TooManyRequests)
    }
}

pub fn subscription_secret(state: &SharedState) -> ApiResult<String> {
    Ok(state
        .db
        .get_or_create_meta("subscription_secret", crypto::new_token)?)
}

pub fn json_with_cookie(value: Value, cookie: String) -> Response {
    let mut response = (
        [("cache-control", "no-store")],
        Json(value),
    )
        .into_response();
    if let Ok(header) = HeaderValue::from_str(&cookie) {
        response.headers_mut().insert(SET_COOKIE, header);
    }
    response
}

pub fn json_nostore(value: Value) -> Response {
    ([("cache-control", "no-store")], Json(value)).into_response()
}

pub fn days_left(expires_at: i64, timestamp: i64) -> i64 {
    if expires_at <= timestamp {
        0
    } else {
        (expires_at - timestamp + 86_399) / 86_400
    }
}

pub struct NewAccessKey<'a> {
    pub server_id: &'a str,
    pub label: &'a str,
    pub email: Option<&'a str>,
    pub note: Option<&'a str>,
    pub duration_hours: i64,
    pub max_devices: i64,
    pub user_id: Option<&'a str>,
    pub created_by: &'a str,
    pub starts_at: i64,
    pub expires_at: i64,
}

pub fn insert_access_key(conn: &Connection, secret: &str, key: &NewAccessKey<'_>) -> ApiResult<String> {
    let id = uuid::Uuid::new_v4().to_string();
    let token_hash = crypto::token_hash(&crypto::subscription_token(secret, &id));
    conn.execute(
        "INSERT INTO access_keys(id, server_id, label, email, note, starts_at, expires_at,
                                 duration_hours, revoked_at, max_devices, created_by, created_at,
                                 subscription_token_hash, user_id)
         VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            &id,
            key.server_id,
            key.label,
            key.email,
            key.note,
            key.starts_at,
            key.expires_at,
            key.duration_hours,
            key.max_devices,
            key.created_by,
            key.starts_at,
            token_hash,
            key.user_id
        ],
    )?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_left_rounds_up() {
        assert_eq!(days_left(1000, 1000), 0);
        assert_eq!(days_left(1001, 1000), 1);
        assert_eq!(days_left(1000 + 86_400, 1000), 1);
        assert_eq!(days_left(1000 + 86_401, 1000), 2);
        assert_eq!(days_left(1000 + 2 * 86_400, 1000), 2);
    }
}
