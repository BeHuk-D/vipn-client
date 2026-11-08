use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::api::{
    client_ip, guard_origin, insert_access_key, json_with_cookie, subscription_secret, NewAccessKey,
};
use crate::auth::{self, AuthAdmin};
use crate::crypto;
use crate::db::{allocate_address, now};
use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

#[derive(Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
pub struct MeResponse {
    email: String,
    role: String,
}

pub async fn login(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(body): Json<LoginRequest>,
) -> ApiResult<Response> {
    guard_origin(&state, &headers)?;
    if !state.login_limiter.check(&client_ip(&headers)) {
        return Err(ApiError::TooManyRequests);
    }

    let row: Option<(String, String, i64)> = {
        let conn = state.db.conn();
        conn.query_row(
            "SELECT id, password_hash, active FROM admins WHERE email = ?1",
            [&body.email],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?
    };

    let Some((admin_id, password_hash, active)) = row else {
        crypto::verify_dummy(&body.password);
        return Err(ApiError::Unauthorized);
    };
    if active != 1 || !crypto::verify_password(&password_hash, &body.password)? {
        return Err(ApiError::Unauthorized);
    }

    let token = auth::issue_token(&state, &admin_id, &body.email)?;
    state.db.audit(&body.email, "auth.login", "admin", &admin_id, None)?;

    Ok(json_with_cookie(
        json!({ "ok": true }),
        auth::session_cookie(&state, &token),
    ))
}

pub async fn logout(State(state): State<SharedState>) -> ApiResult<Response> {
    Ok(json_with_cookie(json!({ "ok": true }), auth::clear_cookie(&state)))
}

pub async fn me(State(state): State<SharedState>, admin: AuthAdmin) -> ApiResult<Json<MeResponse>> {
    let role: String = state.db.conn().query_row(
        "SELECT role FROM admins WHERE id = ?1",
        [&admin.id],
        |row| row.get(0),
    )?;
    Ok(Json(MeResponse {
        email: admin.email,
        role,
    }))
}

#[derive(Serialize)]
pub(crate) struct KeyRow {
    id: String,
    label: String,
    email: Option<String>,
    note: Option<String>,
    server_id: String,
    server_name: String,
    starts_at: i64,
    expires_at: i64,
    revoked_at: Option<i64>,
    max_devices: i64,
    device_count: i64,
    created_at: i64,
    subscription_url: String,
}

pub(crate) fn query_keys(
    conn: &Connection,
    only_id: Option<&str>,
    user_id: Option<&str>,
    base_url: &str,
    secret: &str,
) -> rusqlite::Result<Vec<KeyRow>> {
    let mut statement = conn.prepare(
        "SELECT k.id, k.label, k.email, k.note, k.server_id, s.name,
                k.starts_at, k.expires_at, k.revoked_at, k.max_devices,
                (SELECT COUNT(DISTINCT COALESCE(d.hwid_hash, d.id)) FROM devices d
                  WHERE d.access_key_id = k.id AND d.revoked_at IS NULL),
                k.created_at
         FROM access_keys k
         JOIN servers s ON s.id = k.server_id
         WHERE (?1 IS NULL OR k.id = ?1)
           AND (?2 IS NULL OR k.user_id = ?2)
         ORDER BY k.created_at DESC",
    )?;

    let rows = statement
        .query_map([only_id, user_id], |row| {
            let id: String = row.get(0)?;
            let subscription_url =
                format!("{base_url}/s/{}", crypto::subscription_token(secret, &id));
            Ok(KeyRow {
                id,
                label: row.get(1)?,
                email: row.get(2)?,
                note: row.get(3)?,
                server_id: row.get(4)?,
                server_name: row.get(5)?,
                starts_at: row.get(6)?,
                expires_at: row.get(7)?,
                revoked_at: row.get(8)?,
                max_devices: row.get(9)?,
                device_count: row.get(10)?,
                created_at: row.get(11)?,
                subscription_url,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

pub async fn list_keys(State(state): State<SharedState>, _admin: AuthAdmin) -> ApiResult<Json<Vec<KeyRow>>> {
    let secret = subscription_secret(&state)?;
    let rows = query_keys(
        &state.db.conn(),
        None,
        None,
        &state.config.subscription_base_url,
        &secret,
    )?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct CreateKey {
    pub server_id: String,
    pub label: String,
    pub email: Option<String>,
    pub note: Option<String>,
    pub duration_hours: i64,
    pub max_devices: Option<i64>,
}

pub async fn create_key(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Json(body): Json<CreateKey>,
) -> ApiResult<Json<KeyRow>> {
    guard_origin(&state, &headers)?;

    if !(1..=87_600).contains(&body.duration_hours) {
        return Err(ApiError::BadRequest("срок должен быть от 1 часа до 10 лет".into()));
    }
    let max_devices = body.max_devices.unwrap_or(1).clamp(1, 10);

    let timestamp = now();
    let expires_at = timestamp + body.duration_hours * 3600;
    let secret = subscription_secret(&state)?;

    let id = {
        let conn = state.db.conn();
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM servers WHERE id = ?1",
            [&body.server_id],
            |row| row.get(0),
        )?;
        if exists == 0 {
            return Err(ApiError::NotFound);
        }
        insert_access_key(
            &conn,
            &secret,
            &NewAccessKey {
                server_id: &body.server_id,
                label: body.label.trim(),
                email: body.email.as_deref(),
                note: body.note.as_deref(),
                duration_hours: body.duration_hours,
                max_devices,
                user_id: None,
                created_by: admin.actor(),
                starts_at: timestamp,
                expires_at,
            },
        )?
    };
    state
        .db
        .audit(admin.actor(), "key.create", "access_key", &id, Some(json!({ "label": body.label })))?;

    let key = query_keys(
        &state.db.conn(),
        Some(&id),
        None,
        &state.config.subscription_base_url,
        &secret,
    )?
    .into_iter()
    .next()
    .ok_or(ApiError::NotFound)?;
    Ok(Json(key))
}

pub async fn get_key(
    State(state): State<SharedState>,
    _admin: AuthAdmin,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    let secret = subscription_secret(&state)?;
    let conn = state.db.conn();
    let key = query_keys(&conn, Some(&id), None, &state.config.subscription_base_url, &secret)?
        .into_iter()
        .next()
        .ok_or(ApiError::NotFound)?;

    let mut statement = conn.prepare(
        "SELECT d.id, d.name, d.address, d.created_at, d.revoked_at,
                COALESCE(d.speed_limit_mbit, s.default_speed_limit_mbit,
                         (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'default_speed_limit_mbit'),
                         20),
                d.rx_total, d.tx_total, d.rx_rate, d.tx_rate, d.last_stats_ts, d.last_handshake,
                d.hwid_hash, d.device_info_json, d.bound_via, d.last_seen_at
         FROM devices d
         JOIN servers s ON s.id = d.server_id
         WHERE d.access_key_id = ?1 ORDER BY d.created_at ASC",
    )?;
    let timestamp = now();
    let devices = statement
        .query_map([&id], |row| {
            let last_handshake: Option<i64> = row.get(11)?;
            let hwid_hash: Option<String> = row.get(12)?;
            let device_info_json: String = row.get(13)?;
            let device_info: Value = serde_json::from_str(&device_info_json).unwrap_or_else(|_| json!({}));
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "address": row.get::<_, String>(2)?,
                "created_at": row.get::<_, i64>(3)?,
                "revoked_at": row.get::<_, Option<i64>>(4)?,
                "speed_limit_mbit": row.get::<_, i64>(5)?,
                "rx_total": row.get::<_, i64>(6)?,
                "tx_total": row.get::<_, i64>(7)?,
                "rx_rate": row.get::<_, f64>(8)?,
                "tx_rate": row.get::<_, f64>(9)?,
                "last_stats_ts": row.get::<_, Option<i64>>(10)?,
                "last_handshake": last_handshake,
                "online": last_handshake.map(|ts| timestamp - ts < 180).unwrap_or(false),
                "has_hwid": hwid_hash.is_some(),
                "hwid": hwid_hash.map(|value| value.chars().take(12).collect::<String>()),
                "device_info": device_info,
                "bound_via": row.get::<_, String>(14)?,
                "last_seen_at": row.get::<_, Option<i64>>(15)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(json!({ "key": key, "devices": devices })))
}

#[derive(Deserialize)]
pub struct PatchKey {
    pub extend_hours: Option<i64>,
    pub expires_at: Option<i64>,
    pub revoke: Option<bool>,
    pub max_devices: Option<i64>,
}

pub async fn patch_key(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<PatchKey>,
) -> ApiResult<Json<KeyRow>> {
    guard_origin(&state, &headers)?;
    {
        let conn = state.db.conn();
        let current: i64 = conn
            .query_row("SELECT expires_at FROM access_keys WHERE id = ?1", [&id], |row| row.get(0))
            .optional()?
            .ok_or(ApiError::NotFound)?;

        if let Some(hours) = body.extend_hours {
            if hours <= 0 {
                return Err(ApiError::BadRequest("продление должно быть положительным".into()));
            }
            let base = current.max(now());
            conn.execute(
                "UPDATE access_keys SET expires_at = ?2 WHERE id = ?1",
                params![&id, base + hours * 3600],
            )?;
        }
        if let Some(expires_at) = body.expires_at {
            conn.execute(
                "UPDATE access_keys SET expires_at = ?2 WHERE id = ?1",
                params![&id, expires_at],
            )?;
        }
        if body.revoke == Some(true) {
            conn.execute(
                "UPDATE access_keys SET revoked_at = ?2 WHERE id = ?1",
                params![&id, now()],
            )?;
        }
        if let Some(max_devices) = body.max_devices {
            conn.execute(
                "UPDATE access_keys SET max_devices = ?2 WHERE id = ?1",
                params![&id, max_devices.clamp(1, 10)],
            )?;
        }
    }
    state.db.audit(admin.actor(), "key.update", "access_key", &id, None)?;

    let secret = subscription_secret(&state)?;
    let key = query_keys(
        &state.db.conn(),
        Some(&id),
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
pub struct CreateDevice {
    pub name: String,
}

pub async fn create_device(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(key_id): Path<String>,
    Json(body): Json<CreateDevice>,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;

    let device_id = uuid::Uuid::new_v4().to_string();
    let token = crypto::new_token();
    let token_hash = crypto::token_hash(&token);

    let (server_id, network_cidr, max_devices, key_revoked): (String, String, i64, Option<i64>) = {
        let conn = state.db.conn();
        let row = conn
            .query_row(
                "SELECT k.server_id, s.network_cidr, k.max_devices, k.revoked_at
                 FROM access_keys k JOIN servers s ON s.id = k.server_id
                 WHERE k.id = ?1",
                [&key_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()?
            .ok_or(ApiError::NotFound)?;
        row
    };

    if key_revoked.is_some() {
        return Err(ApiError::Forbidden("ключ отозван"));
    }

    let (public_key, address) = {
        let conn = state.db.conn();
        let tx = conn.unchecked_transaction()?;

        let active: i64 = tx.query_row(
            "SELECT COUNT(DISTINCT COALESCE(hwid_hash, id)) FROM devices
             WHERE access_key_id = ?1 AND revoked_at IS NULL",
            [&key_id],
            |row| row.get(0),
        )?;
        if active >= max_devices {
            return Err(ApiError::Conflict("достигнут лимит устройств".into()));
        }

        let address = allocate_address(&tx, &server_id, &network_cidr)?;
        let (_, public_key) = crypto::derive_keypair(&token, &device_id);

        tx.execute(
            "INSERT INTO devices(id, access_key_id, server_id, name, token_hash, public_key, address, created_at)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &device_id,
                &key_id,
                &server_id,
                body.name.trim(),
                &token_hash,
                &public_key,
                &address,
                now()
            ],
        )?;
        tx.commit()?;
        (public_key, address)
    };

    state
        .db
        .audit(admin.actor(), "device.create", "device", &device_id, Some(json!({ "name": body.name })))?;

    Ok(Json(json!({
        "id": device_id,
        "name": body.name,
        "address": address,
        "public_key": public_key,
        "subscription_url": subscription_url(&state, &token),
    })))
}

fn subscription_url(state: &SharedState, token: &str) -> String {
    format!("{}/s/{}", state.config.subscription_base_url, token)
}

pub async fn rotate_device(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;

    let token = crypto::new_token();
    let token_hash = crypto::token_hash(&token);
    let (_, public_key) = crypto::derive_keypair(&token, &id);

    {
        let conn = state.db.conn();
        let updated = conn.execute(
            "UPDATE devices SET token_hash = ?2, public_key = ?3 WHERE id = ?1 AND revoked_at IS NULL",
            params![&id, &token_hash, &public_key],
        )?;
        if updated == 0 {
            return Err(ApiError::NotFound);
        }
    }
    state.db.audit(admin.actor(), "device.rotate", "device", &id, None)?;

    Ok(Json(json!({
        "id": id,
        "public_key": public_key,
        "subscription_url": subscription_url(&state, &token),
    })))
}

pub async fn revoke_device(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;
    let updated = state.db.conn().execute(
        "UPDATE devices SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL",
        params![&id, now()],
    )?;
    if updated == 0 {
        return Err(ApiError::NotFound);
    }
    state.db.audit(admin.actor(), "device.revoke", "device", &id, None)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn unbind_device(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;
    let updated = state.db.conn().execute(
        "UPDATE devices SET revoked_at = COALESCE(revoked_at, ?2), hwid_hash = NULL
         WHERE id = ?1",
        params![&id, now()],
    )?;
    if updated == 0 {
        return Err(ApiError::NotFound);
    }
    state.db.audit(admin.actor(), "device.unbind", "device", &id, None)?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Serialize)]
pub struct ServerRow {
    id: String,
    name: String,
    host: String,
    endpoint_port: i64,
    interface: String,
    listen_port: i64,
    server_public_key: String,
    network_cidr: String,
    dns: String,
    country: String,
    mtu: i64,
    awg_params: Value,
    enabled: bool,
    peers: i64,
    created_at: i64,
    default_speed_limit_mbit: Option<i64>,
}

pub async fn list_servers(State(state): State<SharedState>, _admin: AuthAdmin) -> ApiResult<Json<Vec<ServerRow>>> {
    let conn = state.db.conn();
    let mut statement = conn.prepare(
        "SELECT id, name, host, endpoint_port, interface, listen_port, server_public_key,
                network_cidr, dns, country, mtu, awg_params_json, enabled, created_at,
                (SELECT COUNT(*) FROM devices d WHERE d.server_id = servers.id AND d.revoked_at IS NULL),
                default_speed_limit_mbit
         FROM servers ORDER BY created_at ASC",
    )?;

    let rows = statement
        .query_map([], |row| {
            let params_raw: String = row.get(11)?;
            Ok(ServerRow {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                endpoint_port: row.get(3)?,
                interface: row.get(4)?,
                listen_port: row.get(5)?,
                server_public_key: row.get(6)?,
                network_cidr: row.get(7)?,
                dns: row.get(8)?,
                country: row.get(9)?,
                mtu: row.get(10)?,
                awg_params: serde_json::from_str(&params_raw).unwrap_or_else(|_| json!({})),
                enabled: row.get::<_, i64>(12)? == 1,
                peers: row.get(14)?,
                created_at: row.get(13)?,
                default_speed_limit_mbit: row.get(15)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct CreateServer {
    pub name: String,
    pub host: String,
    pub endpoint_port: i64,
    pub interface: String,
    pub listen_port: i64,
    pub server_public_key: String,
    pub network_cidr: String,
    pub dns: String,
    #[serde(default)]
    pub country: Option<String>,
    pub mtu: Option<i64>,
    pub awg_params: Option<Value>,
    #[serde(default)]
    pub default_speed_limit_mbit: Option<i64>,
}

pub async fn create_server(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Json(body): Json<CreateServer>,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;

    if let Some(limit) = body.default_speed_limit_mbit {
        if !(1..=10_000).contains(&limit) {
            return Err(ApiError::BadRequest("лимит должен быть от 1 до 10000 Мбит".into()));
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let agent_token = crypto::new_token();
    let agent_token_hash = crypto::token_hash(&agent_token);
    let awg_params = body.awg_params.unwrap_or_else(|| json!({}));

    state.db.conn().execute(
        "INSERT INTO servers(id, name, host, endpoint_port, interface, listen_port, server_public_key,
                             network_cidr, dns, country, mtu, awg_params_json, agent_token_hash, enabled, created_at,
                             default_speed_limit_mbit)
         VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 1, ?14, ?15)",
        params![
            &id,
            body.name,
            body.host,
            body.endpoint_port,
            body.interface,
            body.listen_port,
            body.server_public_key,
            body.network_cidr,
            body.dns,
            body.country.unwrap_or_default().to_uppercase(),
            body.mtu.unwrap_or(1280),
            awg_params.to_string(),
            agent_token_hash,
            now(),
            body.default_speed_limit_mbit
        ],
    )?;
    state
        .db
        .audit(admin.actor(), "server.create", "server", &id, Some(json!({ "host": body.host })))?;

    Ok(Json(json!({ "id": id, "agent_token": agent_token })))
}

#[derive(Deserialize)]
pub struct PatchServer {
    pub enabled: Option<bool>,
    pub name: Option<String>,
    pub country: Option<String>,
    #[serde(default, deserialize_with = "deserialize_some")]
    pub default_speed_limit_mbit: Option<Option<i64>>,
}

fn deserialize_some<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

pub async fn patch_server(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<PatchServer>,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;
    {
        let conn = state.db.conn();
        if let Some(enabled) = body.enabled {
            conn.execute(
                "UPDATE servers SET enabled = ?2 WHERE id = ?1",
                params![&id, i64::from(enabled)],
            )?;
        }
        if let Some(name) = body.name {
            conn.execute("UPDATE servers SET name = ?2 WHERE id = ?1", params![&id, name])?;
        }
        if let Some(country) = body.country {
            conn.execute(
                "UPDATE servers SET country = ?2 WHERE id = ?1",
                params![&id, country.to_uppercase()],
            )?;
        }
        if let Some(limit) = body.default_speed_limit_mbit {
            if let Some(value) = limit {
                if !(1..=10_000).contains(&value) {
                    return Err(ApiError::BadRequest("лимит должен быть от 1 до 10000 Мбит".into()));
                }
            }
            conn.execute(
                "UPDATE servers SET default_speed_limit_mbit = ?2 WHERE id = ?1",
                params![&id, limit],
            )?;
        }
    }
    state.db.audit(admin.actor(), "server.update", "server", &id, None)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn rotate_agent_token(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;
    let token = crypto::new_token();
    let hash = crypto::token_hash(&token);
    let updated = state.db.conn().execute(
        "UPDATE servers SET agent_token_hash = ?2 WHERE id = ?1",
        params![&id, hash],
    )?;
    if updated == 0 {
        return Err(ApiError::NotFound);
    }
    state.db.audit(admin.actor(), "server.rotate_agent_token", "server", &id, None)?;
    Ok(Json(json!({ "id": id, "agent_token": token })))
}

pub async fn stats(State(state): State<SharedState>, _admin: AuthAdmin) -> ApiResult<Json<Value>> {
    let conn = state.db.conn();
    let timestamp = now();
    let total_keys: i64 = conn.query_row("SELECT COUNT(*) FROM access_keys", [], |row| row.get(0))?;
    let active_keys: i64 = conn.query_row(
        "SELECT COUNT(*) FROM access_keys WHERE revoked_at IS NULL AND starts_at <= ?1 AND expires_at > ?1",
        [timestamp],
        |row| row.get(0),
    )?;
    let devices: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT COALESCE(hwid_hash, id)) FROM devices WHERE revoked_at IS NULL",
        [],
        |row| row.get(0),
    )?;
    let servers: i64 = conn.query_row("SELECT COUNT(*) FROM servers WHERE enabled = 1", [], |row| row.get(0))?;

    Ok(Json(json!({
        "total_keys": total_keys,
        "active_keys": active_keys,
        "devices": devices,
        "servers": servers,
    })))
}

pub async fn list_audit(State(state): State<SharedState>, _admin: AuthAdmin) -> ApiResult<Json<Vec<Value>>> {
    let conn = state.db.conn();
    let mut statement = conn.prepare(
        "SELECT ts, actor, action, target_type, target_id FROM audit_log ORDER BY ts DESC LIMIT 200",
    )?;
    let rows = statement
        .query_map([], |row| {
            Ok(json!({
                "ts": row.get::<_, i64>(0)?,
                "actor": row.get::<_, String>(1)?,
                "action": row.get::<_, String>(2)?,
                "target_type": row.get::<_, String>(3)?,
                "target_id": row.get::<_, String>(4)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct MetricsQuery {
    limit: Option<i64>,
    server_id: Option<String>,
}

pub async fn metrics(
    State(state): State<SharedState>,
    _admin: AuthAdmin,
    axum::extract::Query(query): axum::extract::Query<MetricsQuery>,
) -> ApiResult<Json<Value>> {
    let limit = query.limit.unwrap_or(180).clamp(1, 1440);
    let conn = state.db.conn();
    let server_id: Option<String> = match query.server_id.filter(|id| !id.is_empty()) {
        Some(id) => Some(id),
        None => conn
            .query_row(
                "SELECT id FROM servers WHERE enabled = 1 ORDER BY created_at ASC, id ASC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .optional()?
            .or_else(|| {
                conn.query_row(
                    "SELECT id FROM servers ORDER BY created_at ASC, id ASC LIMIT 1",
                    [],
                    |row| row.get(0),
                )
                .optional()
                .ok()
                .flatten()
            }),
    };
    let Some(server_id) = server_id else {
        return Ok(Json(json!([])));
    };
    let mut statement = conn.prepare(
        "SELECT ts, cpu, load1, mem_total, mem_used, disk_total, disk_used, net_rx, net_tx, rx_rate, tx_rate
         FROM metrics WHERE server_id = ?1 ORDER BY ts DESC LIMIT ?2",
    )?;

    let mut rows = statement
        .query_map(params![&server_id, limit], |row| {
            Ok(json!({
                "ts": row.get::<_, i64>(0)?,
                "cpu": row.get::<_, f64>(1)?,
                "load1": row.get::<_, f64>(2)?,
                "mem_total": row.get::<_, i64>(3)?,
                "mem_used": row.get::<_, i64>(4)?,
                "disk_total": row.get::<_, i64>(5)?,
                "disk_used": row.get::<_, i64>(6)?,
                "net_rx": row.get::<_, i64>(7)?,
                "net_tx": row.get::<_, i64>(8)?,
                "rx_rate": row.get::<_, f64>(9)?,
                "tx_rate": row.get::<_, f64>(10)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    rows.reverse();

    Ok(Json(json!(rows)))
}

pub async fn list_devices(State(state): State<SharedState>, _admin: AuthAdmin) -> ApiResult<Json<Value>> {
    let conn = state.db.conn();
    let mut statement = conn.prepare(
        "SELECT d.id, d.name, d.address, d.created_at, d.revoked_at,
                k.label, k.id, k.expires_at, s.name, s.id,
                COALESCE(d.speed_limit_mbit, s.default_speed_limit_mbit,
                         (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'default_speed_limit_mbit'),
                         20),
                d.rx_total, d.tx_total, d.rx_rate, d.tx_rate, d.last_stats_ts, d.last_handshake
         FROM devices d
         JOIN access_keys k ON k.id = d.access_key_id
         JOIN servers s ON s.id = d.server_id
         ORDER BY d.created_at DESC",
    )?;

    let timestamp = now();
    let rows = statement
        .query_map([], |row| {
            let last_handshake: Option<i64> = row.get(16)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "address": row.get::<_, String>(2)?,
                "created_at": row.get::<_, i64>(3)?,
                "revoked_at": row.get::<_, Option<i64>>(4)?,
                "key_label": row.get::<_, String>(5)?,
                "access_key_id": row.get::<_, String>(6)?,
                "key_expires_at": row.get::<_, i64>(7)?,
                "server_name": row.get::<_, String>(8)?,
                "server_id": row.get::<_, String>(9)?,
                "speed_limit_mbit": row.get::<_, i64>(10)?,
                "rx_total": row.get::<_, i64>(11)?,
                "tx_total": row.get::<_, i64>(12)?,
                "rx_rate": row.get::<_, f64>(13)?,
                "tx_rate": row.get::<_, f64>(14)?,
                "last_stats_ts": row.get::<_, Option<i64>>(15)?,
                "last_handshake": last_handshake,
                "online": last_handshake.map(|ts| timestamp - ts < 180).unwrap_or(false),
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(json!(rows)))
}

#[derive(Deserialize)]
pub struct PatchDevice {
    pub speed_limit_mbit: Option<i64>,
}

pub async fn patch_device(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<PatchDevice>,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;

    if let Some(limit) = body.speed_limit_mbit {
        if !(1..=10_000).contains(&limit) {
            return Err(ApiError::BadRequest("лимит должен быть от 1 до 10000 Мбит".into()));
        }
    }

    let updated = state.db.conn().execute(
        "UPDATE devices SET speed_limit_mbit = ?2 WHERE id = ?1",
        params![&id, body.speed_limit_mbit],
    )?;
    if updated == 0 {
        return Err(ApiError::NotFound);
    }

    state
        .db
        .audit(admin.actor(), "device.speed_limit", "device", &id, Some(json!({ "limit": body.speed_limit_mbit })))?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn speedtest(
    State(state): State<SharedState>,
    admin: AuthAdmin,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    guard_origin(&state, &headers)?;
    crate::api::limit(&state, "speedtest", &client_ip(&headers))?;

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::process::Command::new("curl")
            .args([
                "-s",
                "-o",
                "/dev/null",
                "-w",
                "%{speed_download}",
                "--max-time",
                "25",
                "https://speed.cloudflare.com/__down?bytes=50000000",
            ])
            .output(),
    )
    .await
    .map_err(|_| ApiError::Internal(anyhow::anyhow!("speedtest timeout")))?
    .map_err(|error| ApiError::Internal(anyhow::anyhow!("cannot run curl: {error}")))?;

    if !output.status.success() {
        return Err(ApiError::Internal(anyhow::anyhow!("speedtest failed")));
    }

    let bytes_per_second: f64 = String::from_utf8_lossy(&output.stdout).trim().parse().unwrap_or(0.0);
    let mbit = bytes_per_second * 8.0 / 1_000_000.0;

    state
        .db
        .audit(admin.actor(), "server.speedtest", "server", "speedtest", Some(json!({ "mbit": mbit })))?;

    Ok(Json(json!({ "mbit": (mbit * 10.0).round() / 10.0 })))
}
