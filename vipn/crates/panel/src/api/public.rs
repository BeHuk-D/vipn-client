use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use base64::engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD};
use base64::Engine;
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::api::{client_ip, limit};
use crate::conf::{self, ConfInput};
use crate::crypto;
use crate::db::{allocate_address, now};
use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

const DEVICE_LIMIT_MESSAGE: &str = "К этой подписке привязано максимальное количество устройств";

struct DeviceRow {
    device_id: String,
    address: String,
    starts_at: i64,
    expires_at: i64,
    host: String,
    endpoint_port: i64,
    server_public_key: String,
    dns: String,
    country: String,
    mtu: i64,
    awg_params_json: String,
}

struct KeyRow {
    key_id: String,
    server_id: String,
    network_cidr: String,
    max_devices: i64,
    starts_at: i64,
    expires_at: i64,
    host: String,
    endpoint_port: i64,
    server_public_key: String,
    dns: String,
    country: String,
    mtu: i64,
    awg_params_json: String,
}

struct ServerTarget {
    id: String,
    network_cidr: String,
    host: String,
    endpoint_port: i64,
    server_public_key: String,
    dns: String,
    country: String,
    mtu: i64,
    awg_params_json: String,
}

#[derive(Deserialize)]
pub struct SubscriptionQuery {
    all: Option<String>,
}

fn validate_access(
    key_revoked: bool,
    server_enabled: bool,
    starts_at: i64,
    expires_at: i64,
    timestamp: i64,
) -> ApiResult<()> {
    if key_revoked {
        return Err(ApiError::Forbidden("доступ отозван"));
    }
    if !server_enabled {
        return Err(ApiError::Forbidden("сервер выключен"));
    }
    if timestamp < starts_at {
        return Err(ApiError::Forbidden("доступ ещё не активирован"));
    }
    if timestamp >= expires_at {
        return Err(ApiError::Forbidden("срок действия истёк"));
    }
    Ok(())
}

fn render_conf(source: &DeviceRow, token: &str, subscription_url: &str) -> ApiResult<String> {
    let (client_private_key, _) = crypto::derive_keypair(token, &source.device_id);
    let expires_at = chrono::DateTime::from_timestamp(source.expires_at, 0)
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("invalid expires_at")))?;
    let awg_params: Value = serde_json::from_str(&source.awg_params_json)?;
    let endpoint = format!("{}:{}", source.host, source.endpoint_port);

    Ok(conf::render(&ConfInput {
        subscription_url,
        client_private_key: &client_private_key,
        client_address: &source.address,
        dns: &source.dns,
        country: &source.country,
        mtu: source.mtu,
        awg_params: &awg_params,
        server_public_key: &source.server_public_key,
        endpoint: &endpoint,
        expires_at,
    }))
}

pub async fn subscription(
    State(state): State<SharedState>,
    Path(token): Path<String>,
    Query(query): Query<SubscriptionQuery>,
    headers: HeaderMap,
) -> ApiResult<impl IntoResponse> {
    limit(&state, "sub", &client_ip(&headers))?;

    let token_hash = crypto::token_hash(&token);
    let timestamp = now();

    let legacy = {
        let conn = state.db.conn();
        conn.query_row(
            "SELECT d.id, d.address, k.starts_at, k.expires_at, k.revoked_at, s.enabled,
                    s.host, s.endpoint_port, s.server_public_key, s.dns, s.country, s.mtu,
                    s.awg_params_json, d.revoked_at
             FROM devices d
             JOIN access_keys k ON k.id = d.access_key_id
             JOIN servers s ON s.id = d.server_id
             WHERE d.token_hash = ?1
               AND (k.user_id IS NULL OR EXISTS(
                     SELECT 1 FROM users u WHERE u.id = k.user_id AND u.active = 1
                   ))",
            [&token_hash],
            |row| {
                Ok((
                    DeviceRow {
                        device_id: row.get(0)?,
                        address: row.get(1)?,
                        starts_at: row.get(2)?,
                        expires_at: row.get(3)?,
                        host: row.get(6)?,
                        endpoint_port: row.get(7)?,
                        server_public_key: row.get(8)?,
                        dns: row.get(9)?,
                        country: row.get(10)?,
                        mtu: row.get(11)?,
                        awg_params_json: row.get(12)?,
                    },
                    row.get::<_, Option<i64>>(4)?,
                    row.get::<_, i64>(5)? == 1,
                    row.get::<_, Option<i64>>(13)?,
                ))
            },
        )
        .optional()?
    };

    if let Some((source, key_revoked_at, server_enabled, device_revoked_at)) = legacy {
        if device_revoked_at.is_some() {
            return Err(ApiError::NotFound);
        }
        validate_access(key_revoked_at.is_some(), server_enabled, source.starts_at, source.expires_at, timestamp)?;

        let subscription_url = format!("{}/s/{}", state.config.subscription_base_url, token);
        let body = render_conf(&source, &token, &subscription_url)?;
        state.db.conn().execute(
            "UPDATE devices SET last_seen_at = ?2 WHERE id = ?1",
            params![&source.device_id, timestamp],
        )?;
        return Ok(conf_response(body));
    }

    let key = {
        let conn = state.db.conn();
        conn.query_row(
            "SELECT k.id, k.server_id, s.network_cidr, k.max_devices, k.starts_at, k.expires_at,
                    k.revoked_at, s.enabled, s.host, s.endpoint_port, s.server_public_key,
                    s.dns, s.country, s.mtu, s.awg_params_json
             FROM access_keys k
             JOIN servers s ON s.id = k.server_id
             WHERE k.subscription_token_hash = ?1
               AND (k.user_id IS NULL OR EXISTS(
                     SELECT 1 FROM users u WHERE u.id = k.user_id AND u.active = 1
                   ))",
            [&token_hash],
            |row| {
                Ok((
                    KeyRow {
                        key_id: row.get(0)?,
                        server_id: row.get(1)?,
                        network_cidr: row.get(2)?,
                        max_devices: row.get(3)?,
                        starts_at: row.get(4)?,
                        expires_at: row.get(5)?,
                        host: row.get(8)?,
                        endpoint_port: row.get(9)?,
                        server_public_key: row.get(10)?,
                        dns: row.get(11)?,
                        country: row.get(12)?,
                        mtu: row.get(13)?,
                        awg_params_json: row.get(14)?,
                    },
                    row.get::<_, Option<i64>>(6)?,
                    row.get::<_, i64>(7)? == 1,
                ))
            },
        )
        .optional()?
    };

    let Some((key, key_revoked_at, server_enabled)) = key else {
        return Err(ApiError::NotFound);
    };
    validate_access(key_revoked_at.is_some(), server_enabled, key.starts_at, key.expires_at, timestamp)?;

    let hwid = header_hwid(&headers)?;
    let device_info = header_device_info(&headers);

    let targets = if query.all.as_deref() == Some("1") {
        let conn = state.db.conn();
        let mut statement = conn.prepare(
            "SELECT id, network_cidr, host, endpoint_port, server_public_key, dns, country, mtu, awg_params_json
             FROM servers
             WHERE enabled = 1
             ORDER BY CASE WHEN id = ?1 THEN 0 ELSE 1 END, created_at ASC, id ASC",
        )?;
        let rows = statement
            .query_map([&key.server_id], |row| {
                Ok(ServerTarget {
                    id: row.get(0)?,
                    network_cidr: row.get(1)?,
                    host: row.get(2)?,
                    endpoint_port: row.get(3)?,
                    server_public_key: row.get(4)?,
                    dns: row.get(5)?,
                    country: row.get(6)?,
                    mtu: row.get(7)?,
                    awg_params_json: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    } else {
        vec![ServerTarget {
            id: key.server_id.clone(),
            network_cidr: key.network_cidr.clone(),
            host: key.host.clone(),
            endpoint_port: key.endpoint_port,
            server_public_key: key.server_public_key.clone(),
            dns: key.dns.clone(),
            country: key.country.clone(),
            mtu: key.mtu,
            awg_params_json: key.awg_params_json.clone(),
        }]
    };

    let mut body = String::new();
    for target in &targets {
        let (device_id, address, created, name) = bind_device(
            &state,
            &key.key_id,
            &target.id,
            &target.network_cidr,
            key.max_devices,
            &hwid,
            &device_info,
            &token,
            timestamp,
        )?;

        if created {
            state.db.audit(
                "subscription",
                "device.bind",
                "device",
                &device_id,
                Some(json!({ "name": name, "access_key": key.key_id, "server_id": target.id })),
            )?;
        }

        let source = DeviceRow {
            device_id,
            address,
            starts_at: key.starts_at,
            expires_at: key.expires_at,
            host: target.host.clone(),
            endpoint_port: target.endpoint_port,
            server_public_key: target.server_public_key.clone(),
            dns: target.dns.clone(),
            country: target.country.clone(),
            mtu: target.mtu,
            awg_params_json: target.awg_params_json.clone(),
        };
        if !body.is_empty() {
            body.push('\n');
        }
        let subscription_url = format!("{}/s/{}", state.config.subscription_base_url, token);
        body.push_str(&render_conf(&source, &token, &subscription_url)?);
    }

    Ok(conf_response(body))
}

fn conf_response(body: String) -> (StatusCode, [(&'static str, &'static str); 4], String) {
    (
        StatusCode::OK,
        [
            ("content-type", "text/plain; charset=utf-8"),
            ("cache-control", "no-store"),
            ("x-robots-tag", "noindex"),
            ("referrer-policy", "no-referrer"),
        ],
        body,
    )
}

fn header_hwid(headers: &HeaderMap) -> ApiResult<String> {
    let value = headers
        .get("x-vipn-hwid")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(ApiError::BadRequest(
            "клиент не передал идентификатор устройства".into(),
        ));
    }
    Ok(value)
}

fn sanitize_text(value: &str, limit: usize) -> String {
    value
        .chars()
        .filter(|ch| !ch.is_control())
        .take(limit)
        .collect::<String>()
        .trim()
        .to_string()
}

fn header_device_info(headers: &HeaderMap) -> Value {
    let raw = headers
        .get("x-vipn-device")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if raw.is_empty() || raw.len() > 2048 {
        return json!({});
    }
    let Ok(bytes) = URL_SAFE_NO_PAD.decode(raw).or_else(|_| URL_SAFE.decode(raw)) else {
        return json!({});
    };
    let Ok(parsed) = serde_json::from_slice::<Value>(&bytes) else {
        return json!({});
    };
    let mut info = serde_json::Map::new();
    for (field, limit) in [("platform", 32usize), ("os", 64), ("arch", 32), ("model", 64), ("name", 64)] {
        if let Some(value) = parsed.get(field).and_then(|value| value.as_str()) {
            let cleaned = sanitize_text(value, limit);
            if !cleaned.is_empty() {
                info.insert(field.to_string(), Value::String(cleaned));
            }
        }
    }
    Value::Object(info)
}

fn bind_device(
    state: &SharedState,
    key_id: &str,
    server_id: &str,
    network_cidr: &str,
    max_devices: i64,
    hwid: &str,
    device_info: &Value,
    token: &str,
    timestamp: i64,
) -> ApiResult<(String, String, bool, String)> {
    let mut conn = state.db.conn();
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;

    let existing: Option<(String, String, Option<i64>)> = tx
        .query_row(
            "SELECT id, address, revoked_at FROM devices
             WHERE access_key_id = ?1 AND server_id = ?2 AND hwid_hash = ?3",
            params![key_id, server_id, hwid],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;

    if let Some((device_id, address, revoked_at)) = existing {
        if revoked_at.is_some() {
            return Err(ApiError::Forbidden("устройство отозвано".into()));
        }
        if device_info.as_object().map(|info| !info.is_empty()).unwrap_or(false) {
            tx.execute(
                "UPDATE devices SET last_seen_at = ?2, device_info_json = ?3 WHERE id = ?1",
                params![&device_id, timestamp, device_info.to_string()],
            )?;
        } else {
            tx.execute(
                "UPDATE devices SET last_seen_at = ?2 WHERE id = ?1",
                params![&device_id, timestamp],
            )?;
        }
        tx.commit()?;
        return Ok((device_id, address, false, String::new()));
    }

    let active: i64 = tx.query_row(
        "SELECT COUNT(*) FROM devices
         WHERE access_key_id = ?1 AND server_id = ?2 AND revoked_at IS NULL",
        params![key_id, server_id],
        |row| row.get(0),
    )?;
    if active >= max_devices {
        return Err(ApiError::Conflict(DEVICE_LIMIT_MESSAGE.into()));
    }

    let address = allocate_address(&tx, server_id, network_cidr)?;
    let device_id = uuid::Uuid::new_v4().to_string();
    let name = ["name", "model", "os"]
        .iter()
        .find_map(|field| {
            device_info
                .get(*field)
                .and_then(|value| value.as_str())
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| format!("Устройство {}", active + 1));
    let (_, public_key) = crypto::derive_keypair(token, &device_id);
    let token_hash = crypto::token_hash(&crypto::new_token());

    let inserted = tx.execute(
        "INSERT INTO devices(id, access_key_id, server_id, name, token_hash, public_key, address,
                             created_at, hwid_hash, device_info_json, bound_via, last_seen_at)
         VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'subscription', ?8)",
        params![
            &device_id,
            key_id,
            server_id,
            &name,
            &token_hash,
            &public_key,
            &address,
            timestamp,
            hwid,
            device_info.to_string()
        ],
    );

    match inserted {
        Ok(_) => {
            tx.commit()?;
            Ok((device_id, address, true, name))
        }
        Err(rusqlite::Error::SqliteFailure(error, _))
            if error.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            drop(tx);
            let row = conn
                .query_row(
                    "SELECT id, address, revoked_at FROM devices
                     WHERE access_key_id = ?1 AND server_id = ?2 AND hwid_hash = ?3",
                    params![key_id, server_id, hwid],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<i64>>(2)?)),
                )
                .optional()?;
            match row {
                Some((device_id, address, None)) => Ok((device_id, address, false, String::new())),
                Some(_) => Err(ApiError::Forbidden("устройство отозвано".into())),
                None => Err(ApiError::Conflict(DEVICE_LIMIT_MESSAGE.into())),
            }
        }
        Err(error) => Err(error.into()),
    }
}
