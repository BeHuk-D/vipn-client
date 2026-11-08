use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::api::admin::{query_keys, KeyRow};
use crate::api::{
    guard_origin, insert_access_key, json_nostore, subscription_secret, NewAccessKey,
};
use crate::auth::AuthAdmin;
use crate::crypto;
use crate::db::now;
use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

pub async fn list(State(state): State<SharedState>, _admin: AuthAdmin) -> ApiResult<Response> {
    let conn = state.db.conn();
    let timestamp = now();
    let mut statement = conn.prepare(
        "SELECT u.id, u.login, u.active, u.created_at, u.last_login_at, u.trial_used_at,
                k.id, k.starts_at, k.expires_at, k.max_devices,
                (SELECT COUNT(*) FROM devices d
                  WHERE d.access_key_id = k.id AND d.revoked_at IS NULL),
                u.balance_kopecks, u.discount_kopecks,
                (SELECT COUNT(*) FROM referrals r
                  WHERE r.inviter_id = u.id AND r.status = 'credited'),
                (SELECT COALESCE(SUM(r.inviter_kopecks), 0) FROM referrals r
                  WHERE r.inviter_id = u.id AND r.status = 'credited'),
                inviter.login
         FROM users u
         LEFT JOIN access_keys k ON k.user_id = u.id AND k.revoked_at IS NULL
         LEFT JOIN users inviter ON inviter.id = u.referred_by
         ORDER BY u.created_at DESC",
    )?;

    let rows = statement
        .query_map([], |row| {
            let key_id: Option<String> = row.get(6)?;
            let subscription = match key_id {
                None => Value::Null,
                Some(id) => {
                    let starts_at: i64 = row.get(7)?;
                    let expires_at: i64 = row.get(8)?;
                    let status = if timestamp < starts_at {
                        "pending"
                    } else if timestamp >= expires_at {
                        "expired"
                    } else {
                        "active"
                    };
                    json!({
                        "id": id,
                        "status": status,
                        "starts_at": starts_at,
                        "expires_at": expires_at,
                        "max_devices": row.get::<_, i64>(9)?,
                        "device_count": row.get::<_, i64>(10)?,
                    })
                }
            };
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "login": row.get::<_, String>(1)?,
                "active": row.get::<_, i64>(2)? == 1,
                "created_at": row.get::<_, i64>(3)?,
                "last_login_at": row.get::<_, Option<i64>>(4)?,
                "trial_used_at": row.get::<_, Option<i64>>(5)?,
                "subscription": subscription,
                "balance_kopecks": row.get::<_, i64>(11)?,
                "discount_kopecks": row.get::<_, i64>(12)?,
                "invited_count": row.get::<_, i64>(13)?,
                "earned_kopecks": row.get::<_, i64>(14)?,
                "referred_by_login": row.get::<_, Option<String>>(15)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(json_nostore(json!(rows)))
}

pub async fn detail(
    State(state): State<SharedState>,
    _admin: AuthAdmin,
    Path(id): Path<String>,
) -> ApiResult<Response> {
    let secret = subscription_secret(&state)?;
    let conn = state.db.conn();

    let user: Option<(
        String,
        i64,
        i64,
        Option<i64>,
        Option<i64>,
        Option<String>,
        Option<String>,
        Option<String>,
        i64,
        i64,
        Option<String>,
    )> = conn
        .query_row(
            "SELECT u.login, u.active, u.created_at, u.last_login_at, u.trial_used_at,
                    u.referral_code, u.referred_by, u.signup_ip,
                    u.balance_kopecks, u.discount_kopecks, inviter.login
             FROM users u
             LEFT JOIN users inviter ON inviter.id = u.referred_by
             WHERE u.id = ?1",
            [&id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                    row.get(10)?,
                ))
            },
        )
        .optional()?;
    let Some((
        login,
        active,
        created_at,
        last_login_at,
        trial_used_at,
        referral_code,
        referred_by,
        signup_ip,
        balance,
        discount,
        inviter_login,
    )) = user
    else {
        return Err(ApiError::NotFound);
    };

    let invitations: Vec<Value> = {
        let mut statement = conn.prepare(
            "SELECT r.invitee_id, u.login, r.status, r.inviter_kopecks,
                    r.invitee_kopecks, r.ip, r.created_at
             FROM referrals r
             JOIN users u ON u.id = r.invitee_id
             WHERE r.inviter_id = ?1
             ORDER BY r.created_at DESC",
        )?;
        let rows = statement
            .query_map([&id], |row| {
                Ok(json!({
                    "user_id": row.get::<_, String>(0)?,
                    "login": row.get::<_, String>(1)?,
                    "status": row.get::<_, String>(2)?,
                    "inviter_kopecks": row.get::<_, i64>(3)?,
                    "invitee_kopecks": row.get::<_, i64>(4)?,
                    "ip": row.get::<_, Option<String>>(5)?,
                    "created_at": row.get::<_, i64>(6)?,
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    let earned: i64 = conn.query_row(
        "SELECT COALESCE(SUM(inviter_kopecks), 0) FROM referrals
         WHERE inviter_id = ?1 AND status = 'credited'",
        [&id],
        |row| row.get(0),
    )?;
    let referral_url = referral_code.as_ref().map(|code| {
        format!(
            "{}/account/?ref={}",
            state.config.public_base_url.trim_end_matches('/'),
            code
        )
    });

    let keys: Vec<KeyRow> = query_keys(
        &conn,
        None,
        Some(&id),
        &state.config.subscription_base_url,
        &secret,
    )?;

    let timestamp = now();
    let mut statement = conn.prepare(
        "SELECT d.id, d.name, d.address, d.created_at, d.revoked_at, d.access_key_id,
                d.rx_total, d.tx_total, d.rx_rate, d.tx_rate, d.last_handshake
         FROM devices d
         JOIN access_keys k ON k.id = d.access_key_id
         WHERE k.user_id = ?1
         ORDER BY d.created_at ASC",
    )?;
    let devices = statement
        .query_map([&id], |row| {
            let last_handshake: Option<i64> = row.get(10)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "address": row.get::<_, String>(2)?,
                "created_at": row.get::<_, i64>(3)?,
                "revoked_at": row.get::<_, Option<i64>>(4)?,
                "access_key_id": row.get::<_, String>(5)?,
                "rx_total": row.get::<_, i64>(6)?,
                "tx_total": row.get::<_, i64>(7)?,
                "rx_rate": row.get::<_, f64>(8)?,
                "tx_rate": row.get::<_, f64>(9)?,
                "last_handshake": last_handshake,
                "online": last_handshake.map(|ts| timestamp - ts < 180).unwrap_or(false),
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(json_nostore(json!({
        "user": {
            "id": id,
            "login": login,
            "active": active == 1,
            "created_at": created_at,
            "last_login_at": last_login_at,
            "trial_used_at": trial_used_at,
            "balance_kopecks": balance,
            "discount_kopecks": discount,
            "referral": {
                "code": referral_code,
                "url": referral_url,
                "referred_by": referred_by.map(|inviter_id| json!({
                    "id": inviter_id,
                    "login": inviter_login,
                })),
                "signup_ip": signup_ip,
                "earned_kopecks": earned,
                "invited": invitations,
            },
        },
        "keys": keys,
        "devices": devices,
    })))
}

#[derive(Deserialize)]
pub struct PatchUser {
    active: bool,
}

pub async fn patch(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<PatchUser>,
) -> ApiResult<Response> {
    guard_origin(&state, &headers)?;

    let updated = state.db.conn().execute(
        "UPDATE users SET active = ?2, session_version = session_version + 1 WHERE id = ?1",
        params![&id, i64::from(body.active)],
    )?;
    if updated == 0 {
        return Err(ApiError::NotFound);
    }

    let action = if body.active { "user.unblock" } else { "user.block" };
    state.db.audit(admin.actor(), action, "user", &id, None)?;

    Ok(json_nostore(json!({ "ok": true, "active": body.active })))
}

pub async fn reset_password(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Response> {
    guard_origin(&state, &headers)?;

    let password = crypto::generate_password();
    let hash = crypto::hash_password(&password)?;
    let updated = state.db.conn().execute(
        "UPDATE users SET password_hash = ?2, must_change_password = 1,
                          session_version = session_version + 1
         WHERE id = ?1",
        params![&id, hash],
    )?;
    if updated == 0 {
        return Err(ApiError::NotFound);
    }

    state
        .db
        .audit(admin.actor(), "user.password_reset", "user", &id, None)?;

    Ok(json_nostore(json!({ "password": password })))
}

#[derive(Deserialize)]
pub struct GrantSubscription {
    duration_hours: i64,
    max_devices: Option<i64>,
    server_id: Option<String>,
}

pub async fn grant_subscription(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<GrantSubscription>,
) -> ApiResult<Json<KeyRow>> {
    guard_origin(&state, &headers)?;

    if !(1..=87_600).contains(&body.duration_hours) {
        return Err(ApiError::BadRequest(
            "срок должен быть от 1 часа до 10 лет".into(),
        ));
    }

    let exists: i64 = state.db.conn().query_row(
        "SELECT COUNT(*) FROM users WHERE id = ?1",
        [&id],
        |row| row.get(0),
    )?;
    if exists == 0 {
        return Err(ApiError::NotFound);
    }

    let max_devices = body.max_devices.unwrap_or(1).clamp(1, 10);
    let secret = subscription_secret(&state)?;
    let timestamp = now();

    let existing: Option<String> = {
        let conn = state.db.conn();
        conn.query_row(
            "SELECT id FROM access_keys
             WHERE user_id = ?1 AND revoked_at IS NULL
             ORDER BY created_at DESC LIMIT 1",
            [&id],
            |row| row.get(0),
        )
        .optional()?
    };

    let extended = existing.is_some();
    let key_id = match existing {
        Some(key_id) => {
            let conn = state.db.conn();
            let current: i64 = conn.query_row(
                "SELECT expires_at FROM access_keys WHERE id = ?1",
                [&key_id],
                |row| row.get(0),
            )?;
            let base = current.max(timestamp);
            conn.execute(
                "UPDATE access_keys SET expires_at = ?2, max_devices = ?3 WHERE id = ?1",
                params![&key_id, base + body.duration_hours * 3600, max_devices],
            )?;
            key_id
        }
        None => {
            let server_id = match body.server_id {
                Some(server_id) => {
                    let exists: i64 = state.db.conn().query_row(
                        "SELECT COUNT(*) FROM servers WHERE id = ?1",
                        [&server_id],
                        |row| row.get(0),
                    )?;
                    if exists == 0 {
                        return Err(ApiError::NotFound);
                    }
                    server_id
                }
                None => state
                    .db
                    .conn()
                    .query_row(
                        "SELECT id FROM servers WHERE enabled = 1 ORDER BY created_at ASC LIMIT 1",
                        [],
                        |row| row.get(0),
                    )
                    .optional()?
                    .ok_or_else(|| {
                        ApiError::Conflict("нет включённых серверов".into())
                    })?,
            };
            insert_access_key(
                &state.db.conn(),
                &secret,
                &NewAccessKey {
                    server_id: &server_id,
                    label: "Подписка",
                    email: None,
                    note: None,
                    duration_hours: body.duration_hours,
                    max_devices,
                    user_id: Some(&id),
                    created_by: admin.actor(),
                    starts_at: timestamp,
                    expires_at: timestamp + body.duration_hours * 3600,
                },
            )?
        }
    };

    state.db.audit(
        admin.actor(),
        "user.subscription",
        "user",
        &id,
        Some(json!({
            "key_id": key_id,
            "duration_hours": body.duration_hours,
            "extended": extended,
        })),
    )?;

    let key = query_keys(
        &state.db.conn(),
        Some(&key_id),
        None,
        &state.config.subscription_base_url,
        &secret,
    )?
    .into_iter()
    .next()
    .ok_or(ApiError::NotFound)?;
    Ok(Json(key))
}

#[derive(Deserialize)]
pub struct BalanceAdjust {
    delta_rub: i64,
    comment: Option<String>,
}

pub async fn adjust_balance(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<BalanceAdjust>,
) -> ApiResult<Response> {
    guard_origin(&state, &headers)?;

    if body.delta_rub == 0 || body.delta_rub.abs() > 100_000 {
        return Err(ApiError::BadRequest(
            "сумма должна быть от 1 до 100 000 рублей".into(),
        ));
    }
    let delta = body.delta_rub * 100;
    let comment = body
        .comment
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(|text| text.chars().take(200).collect::<String>());

    let balance: i64 = {
        let conn = state.db.conn();
        let updated = conn.execute(
            "UPDATE users SET balance_kopecks = balance_kopecks + ?2
             WHERE id = ?1 AND balance_kopecks + ?2 >= 0",
            params![&id, delta],
        )?;
        if updated == 0 {
            let exists: i64 =
                conn.query_row("SELECT COUNT(*) FROM users WHERE id = ?1", [&id], |row| {
                    row.get(0)
                })?;
            if exists == 0 {
                return Err(ApiError::NotFound);
            }
            return Err(ApiError::BadRequest(
                "недостаточно средств на балансе".into(),
            ));
        }
        conn.query_row(
            "SELECT balance_kopecks FROM users WHERE id = ?1",
            [&id],
            |row| row.get(0),
        )?
    };

    state.db.audit(
        admin.actor(),
        "user.balance",
        "user",
        &id,
        Some(json!({
            "delta_kopecks": delta,
            "balance_kopecks": balance,
            "comment": comment,
        })),
    )?;

    Ok(json_nostore(json!({ "balance_kopecks": balance })))
}
