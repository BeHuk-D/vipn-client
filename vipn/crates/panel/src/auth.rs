use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::crypto;
use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

pub const COOKIE_NAME: &str = "vipn_session";
pub const USER_COOKIE_NAME: &str = "vipn_user_session";
const SESSION_TTL_SECONDS: i64 = 60 * 60 * 12;
const USER_SESSION_TTL_SECONDS: i64 = 60 * 60 * 24 * 7;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub login: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub ver: Option<i64>,
    pub exp: i64,
}

pub struct AuthAdmin {
    pub id: String,
    pub email: String,
}

impl AuthAdmin {
    pub fn actor(&self) -> &str {
        &self.email
    }
}

pub struct AuthUser {
    pub id: String,
    pub login: String,
    pub must_change_password: bool,
}

pub fn secret(state: &SharedState) -> ApiResult<String> {
    Ok(state
        .db
        .get_or_create_meta("jwt_secret", || crypto::new_token())?)
}

pub fn issue_token(state: &SharedState, admin_id: &str, email: &str) -> ApiResult<String> {
    let claims = Claims {
        sub: admin_id.to_string(),
        email: Some(email.to_string()),
        login: None,
        kind: Some("admin".to_string()),
        ver: None,
        exp: chrono::Utc::now().timestamp() + SESSION_TTL_SECONDS,
    };
    encode_token(state, &claims)
}

pub fn issue_user_token(
    state: &SharedState,
    user_id: &str,
    login: &str,
    version: i64,
) -> ApiResult<String> {
    let claims = Claims {
        sub: user_id.to_string(),
        email: None,
        login: Some(login.to_string()),
        kind: Some("user".to_string()),
        ver: Some(version),
        exp: chrono::Utc::now().timestamp() + USER_SESSION_TTL_SECONDS,
    };
    encode_token(state, &claims)
}

fn encode_token(state: &SharedState, claims: &Claims) -> ApiResult<String> {
    let token = encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret(state)?.as_bytes()),
    )?;
    Ok(token)
}

fn verify_token(state: &SharedState, token: &str) -> ApiResult<Claims> {
    let validation = Validation::new(Algorithm::HS256);
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret(state)?.as_bytes()),
        &validation,
    )
    .map_err(|_| ApiError::Unauthorized)?;
    Ok(data.claims)
}

fn cookie_value(parts: &Parts, name: &str) -> Option<String> {
    let header = parts.headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
    header.split(';').find_map(|pair| {
        let (cookie, value) = pair.split_once('=')?;
        (cookie.trim() == name).then(|| value.trim().to_string())
    })
}

impl FromRequestParts<SharedState> for AuthAdmin {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &SharedState) -> Result<Self, Self::Rejection> {
        let token = cookie_value(parts, COOKIE_NAME).ok_or(ApiError::Unauthorized)?;
        let claims = verify_token(state, &token)?;
        if claims.kind.as_deref() == Some("user") {
            return Err(ApiError::Unauthorized);
        }

        let active: Option<i64> = {
            let conn = state.db.conn();
            conn.query_row(
                "SELECT active FROM admins WHERE id = ?1",
                [&claims.sub],
                |row| row.get(0),
            )
            .ok()
        };
        if active != Some(1) {
            return Err(ApiError::Unauthorized);
        }

        Ok(Self {
            id: claims.sub,
            email: claims.email.unwrap_or_default(),
        })
    }
}

impl FromRequestParts<SharedState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &SharedState) -> Result<Self, Self::Rejection> {
        let token = cookie_value(parts, USER_COOKIE_NAME).ok_or(ApiError::Unauthorized)?;
        let claims = verify_token(state, &token)?;
        if claims.kind.as_deref() != Some("user") {
            return Err(ApiError::Unauthorized);
        }
        let version = claims.ver.ok_or(ApiError::Unauthorized)?;

        let row: Option<(String, i64, i64, i64)> = {
            let conn = state.db.conn();
            conn.query_row(
                "SELECT login, active, session_version, must_change_password
                 FROM users WHERE id = ?1",
                [&claims.sub],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .ok()
        };

        let Some((login, active, session_version, must_change_password)) = row else {
            return Err(ApiError::Unauthorized);
        };
        if active != 1 || session_version != version {
            return Err(ApiError::Unauthorized);
        }

        Ok(Self {
            id: claims.sub,
            login,
            must_change_password: must_change_password == 1,
        })
    }
}

pub fn session_cookie(state: &SharedState, token: &str) -> String {
    let secure = if state.config.cookie_secure { "; Secure" } else { "" };
    format!(
        "{COOKIE_NAME}={token}; HttpOnly; Path=/; SameSite=Strict; Max-Age={SESSION_TTL_SECONDS}{secure}"
    )
}

pub fn clear_cookie(state: &SharedState) -> String {
    clear(COOKIE_NAME, state)
}

pub fn user_session_cookie(state: &SharedState, token: &str) -> String {
    let secure = if state.config.cookie_secure { "; Secure" } else { "" };
    format!(
        "{USER_COOKIE_NAME}={token}; HttpOnly; Path=/; SameSite=Strict; Max-Age={USER_SESSION_TTL_SECONDS}{secure}"
    )
}

pub fn clear_user_cookie(state: &SharedState) -> String {
    clear(USER_COOKIE_NAME, state)
}

fn clear(name: &str, state: &SharedState) -> String {
    let secure = if state.config.cookie_secure { "; Secure" } else { "" };
    format!("{name}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0{secure}")
}
