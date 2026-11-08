use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::api::{
    client_ip, days_left, guard_origin, insert_access_key, json_nostore, json_with_cookie,
    subscription_secret, NewAccessKey, REFERRAL_DISCOUNT_KOPECKS, REFERRAL_REWARD_KOPECKS,
};
use crate::auth::{self, AuthUser};
use crate::crypto;
use crate::db::{now, unique_referral_code};
use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

const TRIAL_HOURS: i64 = 48;

#[derive(Deserialize)]
pub struct Credentials {
    login: String,
    password: String,
    #[serde(rename = "ref", default)]
    ref_code: Option<String>,
}

fn normalize_login(raw: &str) -> ApiResult<String> {
    let login = raw.trim().to_ascii_lowercase();
    let mut chars = login.chars();
    let first_ok = chars
        .next()
        .map(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit())
        .unwrap_or(false);
    let rest_ok = chars.all(|ch| {
        ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-'
    });
    if !(3..=32).contains(&login.len()) || !first_ok || !rest_ok {
        return Err(ApiError::BadRequest(
            "Логин: от 3 до 32 символов, латиница, цифры, _ и -".into(),
        ));
    }
    Ok(login)
}

fn validate_password(password: &str) -> ApiResult<()> {
    if !(8..=128).contains(&password.chars().count()) {
        return Err(ApiError::BadRequest(
            "Пароль должен быть от 8 до 128 символов".into(),
        ));
    }
    Ok(())
}

pub async fn register(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(body): Json<Credentials>,
) -> ApiResult<Response> {
    guard_origin(&state, &headers)?;
    if !state.register_limiter.check(&client_ip(&headers)) {
        return Err(ApiError::TooManyRequests);
    }

    let login = normalize_login(&body.login)?;
    validate_password(&body.password)?;

    let server_id: Option<String> = {
        let conn = state.db.conn();
        conn.query_row(
            "SELECT id FROM servers WHERE enabled = 1 ORDER BY created_at ASC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()?
    };
    let Some(server_id) = server_id else {
        return Err(ApiError::Conflict("Регистрация временно недоступна".into()));
    };

    let secret = subscription_secret(&state)?;
    let password_hash = crypto::hash_password(&body.password)?;
    let user_id = uuid::Uuid::new_v4().to_string();
    let timestamp = now();
    let signup_ip = client_ip(&headers);

    let requested_ref = body
        .ref_code
        .as_deref()
        .and_then(crate::db::normalize_referral_code);
    let inviter: Option<(String, Option<String>)> = match requested_ref.as_deref() {
        Some(code) => {
            let conn = state.db.conn();
            conn.query_row(
                "SELECT id, signup_ip FROM users WHERE referral_code = ?1 AND active = 1",
                [&code],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?
        }
        None => None,
    };
    let ip_match = inviter
        .as_ref()
        .and_then(|(_, inviter_ip)| inviter_ip.as_deref())
        .map(|inviter_ip| signup_ip != "unknown" && inviter_ip == signup_ip)
        .unwrap_or(false);
    let attributed = inviter.is_some() && !ip_match;
    let referral_status = inviter
        .as_ref()
        .map(|_| if attributed { "credited" } else { "ip_match" });

    {
        let conn = state.db.conn();
        let tx = conn.unchecked_transaction()?;

        let own_code = unique_referral_code(&tx)?;
        let discount = if attributed {
            REFERRAL_DISCOUNT_KOPECKS
        } else {
            0
        };
        let inserted = tx.execute(
            "INSERT INTO users(id, login, password_hash, active, session_version,
                               must_change_password, trial_used_at, created_at,
                               referral_code, referred_by, signup_ip, discount_kopecks)
             VALUES(?1, ?2, ?3, 1, 0, 0, ?4, ?4, ?5, ?6, ?7, ?8)",
            params![
                &user_id,
                &login,
                password_hash,
                timestamp,
                &own_code,
                inviter.as_ref().map(|(id, _)| id.as_str()),
                &signup_ip,
                discount
            ],
        );
        match inserted {
            Ok(_) => {}
            Err(rusqlite::Error::SqliteFailure(error, _))
                if error.code == rusqlite::ErrorCode::ConstraintViolation =>
            {
                return Err(ApiError::Conflict("Логин уже занят".into()));
            }
            Err(error) => return Err(error.into()),
        }

        if let (true, Some((inviter_id, _))) = (attributed, inviter.as_ref()) {
            tx.execute(
                "UPDATE users SET balance_kopecks = balance_kopecks + ?2 WHERE id = ?1",
                params![inviter_id, REFERRAL_REWARD_KOPECKS],
            )?;
        }
        if let (Some(status), Some((inviter_id, inviter_ip))) = (referral_status, inviter.as_ref())
        {
            tx.execute(
                "INSERT INTO referrals(id, inviter_id, invitee_id, inviter_kopecks,
                                       invitee_kopecks, status, ip, inviter_ip, created_at)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    inviter_id,
                    &user_id,
                    if attributed { REFERRAL_REWARD_KOPECKS } else { 0 },
                    if attributed { REFERRAL_DISCOUNT_KOPECKS } else { 0 },
                    status,
                    &signup_ip,
                    inviter_ip,
                    timestamp
                ],
            )?;
        }

        insert_access_key(
            &tx,
            &secret,
            &NewAccessKey {
                server_id: &server_id,
                label: "Пробный доступ",
                email: None,
                note: None,
                duration_hours: TRIAL_HOURS,
                max_devices: 1,
                user_id: Some(&user_id),
                created_by: "registration",
                starts_at: timestamp,
                expires_at: timestamp + TRIAL_HOURS * 3600,
            },
        )?;
        tx.commit()?;
    }

    state.db.audit(
        &login,
        "user.register",
        "user",
        &user_id,
        Some(json!({
            "server_id": server_id,
            "trial_hours": TRIAL_HOURS,
            "ref": requested_ref,
            "referral_status": referral_status,
        })),
    )?;

    let token = auth::issue_user_token(&state, &user_id, &login, 0)?;
    Ok(json_with_cookie(
        json!({ "ok": true, "login": login }),
        auth::user_session_cookie(&state, &token),
    ))
}

pub async fn login(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(body): Json<Credentials>,
) -> ApiResult<Response> {
    guard_origin(&state, &headers)?;
    if !state.user_login_limiter.check(&client_ip(&headers)) {
        return Err(ApiError::TooManyRequests);
    }

    let login = body.login.trim().to_ascii_lowercase();
    let row: Option<(String, String, i64, i64)> = {
        let conn = state.db.conn();
        conn.query_row(
            "SELECT id, password_hash, active, session_version FROM users WHERE login = ?1",
            [&login],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()?
    };

    let Some((user_id, password_hash, active, version)) = row else {
        crypto::verify_dummy(&body.password);
        return Err(ApiError::Unauthorized);
    };
    if !crypto::verify_password(&password_hash, &body.password)? {
        return Err(ApiError::Unauthorized);
    }
    if active != 1 {
        return Err(ApiError::Forbidden("Аккаунт заблокирован"));
    }

    state.db.conn().execute(
        "UPDATE users SET last_login_at = ?2 WHERE id = ?1",
        params![&user_id, now()],
    )?;
    state.db.audit(&login, "user.login", "user", &user_id, None)?;

    let token = auth::issue_user_token(&state, &user_id, &login, version)?;
    Ok(json_with_cookie(
        json!({ "ok": true, "login": login }),
        auth::user_session_cookie(&state, &token),
    ))
}

pub async fn logout(State(state): State<SharedState>) -> ApiResult<Response> {
    Ok(json_with_cookie(
        json!({ "ok": true }),
        auth::clear_user_cookie(&state),
    ))
}

pub async fn me(State(state): State<SharedState>, user: AuthUser) -> ApiResult<Response> {
    let (created_at, balance, discount, code): (i64, i64, i64, Option<String>) = state
        .db
        .conn()
        .query_row(
            "SELECT created_at, balance_kopecks, discount_kopecks, referral_code
             FROM users WHERE id = ?1",
            [&user.id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )?;
    let (invited, earned): (i64, i64) = state.db.conn().query_row(
        "SELECT COUNT(*), COALESCE(SUM(inviter_kopecks), 0)
         FROM referrals WHERE inviter_id = ?1 AND status = 'credited'",
        [&user.id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let code = code.unwrap_or_default();
    let url = format!(
        "{}/account/?ref={}",
        state.config.public_base_url.trim_end_matches('/'),
        code
    );
    Ok(json_nostore(json!({
        "login": user.login,
        "created_at": created_at,
        "must_change_password": user.must_change_password,
        "balance_kopecks": balance,
        "discount_kopecks": discount,
        "referral": {
            "code": code,
            "url": url,
            "invited": invited,
            "earned_kopecks": earned,
        },
    })))
}

pub async fn subscription(State(state): State<SharedState>, user: AuthUser) -> ApiResult<Response> {
    let timestamp = now();
    let secret = subscription_secret(&state)?;
    let conn = state.db.conn();

    let key: Option<(String, i64, i64, i64)> = conn
        .query_row(
            "SELECT id, starts_at, expires_at, max_devices
             FROM access_keys
             WHERE user_id = ?1 AND revoked_at IS NULL
             ORDER BY created_at DESC LIMIT 1",
            [&user.id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()?;

    let Some((key_id, starts_at, expires_at, max_devices)) = key else {
        return Ok(empty_subscription());
    };
    if timestamp < starts_at || timestamp >= expires_at {
        return Ok(empty_subscription());
    }

    let devices = query_devices(&conn, &key_id, timestamp)?;
    let device_count = devices.len() as i64;
    let url = format!(
        "{}/s/{}",
        state.config.subscription_base_url,
        crypto::subscription_token(&secret, &key_id)
    );

    Ok(json_nostore(json!({
        "subscription": {
            "id": key_id,
            "status": "active",
            "starts_at": starts_at,
            "expires_at": expires_at,
            "days_left": days_left(expires_at, timestamp),
            "max_devices": max_devices,
            "device_count": device_count,
            "url": url,
            "qr_data_uri": qr_data_uri(&url)?,
        },
        "devices": devices,
    })))
}

fn empty_subscription() -> Response {
    json_nostore(json!({ "subscription": null, "devices": [] }))
}

fn query_devices(conn: &Connection, key_id: &str, timestamp: i64) -> ApiResult<Vec<Value>> {
    let mut statement = conn.prepare(
        "SELECT MIN(id), MAX(name), MAX(address), MIN(created_at), MAX(last_handshake),
                SUM(rx_total), SUM(tx_total), SUM(rx_rate), SUM(tx_rate), MAX(last_seen_at)
         FROM devices
         WHERE access_key_id = ?1 AND revoked_at IS NULL
         GROUP BY COALESCE(hwid_hash, id)
         ORDER BY MIN(created_at) ASC",
    )?;
    let rows = statement
        .query_map([key_id], |row| {
            let last_handshake: Option<i64> = row.get(4)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "address": row.get::<_, String>(2)?,
                "created_at": row.get::<_, i64>(3)?,
                "last_handshake": last_handshake,
                "online": last_handshake.map(|ts| timestamp - ts < 180).unwrap_or(false),
                "rx_total": row.get::<_, i64>(5)?,
                "tx_total": row.get::<_, i64>(6)?,
                "rx_rate": row.get::<_, f64>(7)?,
                "tx_rate": row.get::<_, f64>(8)?,
                "last_seen_at": row.get::<_, Option<i64>>(9)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn qr_data_uri(url: &str) -> ApiResult<String> {
    let code = qrcode::QrCode::new(url.as_bytes())
        .map_err(|error| ApiError::Internal(anyhow::anyhow!("cannot build qr code: {error}")))?;
    let svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(220, 220)
        .quiet_zone(true)
        .build();
    Ok(format!(
        "data:image/svg+xml;base64,{}",
        STANDARD.encode(svg)
    ))
}

#[derive(Deserialize)]
pub struct PasswordChange {
    current_password: String,
    new_password: String,
}

pub async fn change_password(
    State(state): State<SharedState>,
    user: AuthUser,
    headers: HeaderMap,
    Json(body): Json<PasswordChange>,
) -> ApiResult<Response> {
    guard_origin(&state, &headers)?;
    if !state.password_limiter.check(&user.id) {
        return Err(ApiError::TooManyRequests);
    }

    let current_hash: String = state.db.conn().query_row(
        "SELECT password_hash FROM users WHERE id = ?1",
        [&user.id],
        |row| row.get(0),
    )?;
    if !crypto::verify_password(&current_hash, &body.current_password)? {
        return Err(ApiError::BadRequest("Текущий пароль неверен".into()));
    }
    validate_password(&body.new_password)?;
    if body.new_password == body.current_password {
        return Err(ApiError::BadRequest(
            "Новый пароль совпадает с текущим".into(),
        ));
    }

    let hash = crypto::hash_password(&body.new_password)?;
    let version: i64 = {
        let conn = state.db.conn();
        conn.execute(
            "UPDATE users SET password_hash = ?2, must_change_password = 0,
                              session_version = session_version + 1
             WHERE id = ?1",
            params![&user.id, hash],
        )?;
        conn.query_row(
            "SELECT session_version FROM users WHERE id = ?1",
            [&user.id],
            |row| row.get(0),
        )?
    };

    state
        .db
        .audit(&user.login, "user.password", "user", &user.id, None)?;

    let token = auth::issue_user_token(&state, &user.id, &user.login, version)?;
    Ok(json_with_cookie(
        json!({ "ok": true }),
        auth::user_session_cookie(&state, &token),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_rules() {
        assert_eq!(normalize_login("  Ivan_01 ").unwrap(), "ivan_01");
        assert!(normalize_login("ab").is_err());
        assert!(normalize_login("_ivan").is_err());
        assert!(normalize_login("-ivan").is_err());
        assert!(normalize_login("иван").is_err());
        assert!(normalize_login("a b").is_err());
        assert!(normalize_login(&"a".repeat(33)).is_err());
    }

    #[test]
    fn password_length_rules() {
        assert!(validate_password("short").is_err());
        assert!(validate_password("12345678").is_ok());
        assert!(validate_password(&"x".repeat(129)).is_err());
    }

    #[test]
    fn qr_is_svg_data_uri() {
        let uri = qr_data_uri("https://example.com/s/token").unwrap();
        assert!(uri.starts_with("data:image/svg+xml;base64,"));
    }
}
