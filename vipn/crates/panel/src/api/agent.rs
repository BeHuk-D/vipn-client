use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use rusqlite::{params, OptionalExtension};
use vipn_shared::{AgentPeer, AgentReport, AgentState};

use crate::crypto::token_hash;
use crate::db::now;
use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

fn server_for_token(state: &SharedState, headers: &HeaderMap) -> ApiResult<(String, String)> {
    let token = headers
        .get("x-agent-token")
        .and_then(|value| value.to_str().ok())
        .ok_or(ApiError::Unauthorized)?;

    let hash = token_hash(token);
    let conn = state.db.conn();

    conn.query_row(
        "SELECT id, interface FROM servers WHERE agent_token_hash = ?1 AND enabled = 1",
        [&hash],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()?
    .ok_or(ApiError::Unauthorized)
}

pub async fn state(State(state): State<SharedState>, headers: HeaderMap) -> ApiResult<Json<AgentState>> {
    let (server_id, interface) = server_for_token(&state, &headers)?;
    let conn = state.db.conn();

    let timestamp = now();
    let mut statement = conn.prepare(
        "SELECT d.public_key, d.address,
                COALESCE(d.speed_limit_mbit, s.default_speed_limit_mbit,
                         (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'default_speed_limit_mbit'),
                         20)
         FROM devices d
         JOIN access_keys k ON k.id = d.access_key_id
         JOIN servers s ON s.id = d.server_id
         WHERE d.server_id = ?1
           AND d.revoked_at IS NULL
           AND k.revoked_at IS NULL
           AND k.starts_at <= ?2
           AND k.expires_at > ?2
           AND (k.user_id IS NULL OR EXISTS(
                 SELECT 1 FROM users u WHERE u.id = k.user_id AND u.active = 1
               ))",
    )?;

    let peers = statement
        .query_map(params![server_id, timestamp], |row| {
            let limit: i64 = row.get(2)?;
            Ok(AgentPeer {
                public_key: row.get(0)?,
                allowed_ips: row.get(1)?,
                limit_mbit: if limit > 0 { Some(limit as u32) } else { None },
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(AgentState { interface, peers }))
}

pub async fn report(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(report): Json<AgentReport>,
) -> ApiResult<Json<serde_json::Value>> {
    let (server_id, _interface) = server_for_token(&state, &headers)?;
    let metrics = report.metrics;
    let timestamp = now();

    let conn = state.db.conn();
    let previous: Option<(i64, i64, i64)> = conn
        .query_row(
            "SELECT ts, net_rx, net_tx FROM metrics WHERE server_id = ?1 ORDER BY ts DESC LIMIT 1",
            [&server_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;

    let (rx_rate, tx_rate) = match previous {
        Some((ts, net_rx, net_tx)) if timestamp > ts => {
            let dt = (timestamp - ts) as f64;
            let rx = metrics.net_rx_bytes.saturating_sub(net_rx as u64) as f64 / dt;
            let tx = metrics.net_tx_bytes.saturating_sub(net_tx as u64) as f64 / dt;
            (rx, tx)
        }
        _ => (0.0, 0.0),
    };

    let mem_used = metrics.mem_total_kb.saturating_sub(metrics.mem_available_kb);
    let disk_used = metrics.disk_total_kb.saturating_sub(metrics.disk_available_kb);

    conn.execute(
        "INSERT OR REPLACE INTO metrics
            (server_id, ts, cpu, load1, mem_total, mem_used, disk_total, disk_used, net_rx, net_tx, rx_rate, tx_rate)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            &server_id,
            timestamp,
            metrics.cpu_percent,
            metrics.load1,
            metrics.mem_total_kb as i64,
            mem_used as i64,
            metrics.disk_total_kb as i64,
            disk_used as i64,
            metrics.net_rx_bytes as i64,
            metrics.net_tx_bytes as i64,
            rx_rate,
            tx_rate,
        ],
    )?;

    for peer in &metrics.peers {
        let device: Option<(String, Option<i64>, Option<i64>, Option<i64>)> = conn
            .query_row(
                "SELECT id, last_rx, last_tx, last_stats_ts
                 FROM devices WHERE server_id = ?1 AND public_key = ?2",
                params![&server_id, &peer.public_key],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()?;

        let Some((device_id, last_rx, last_tx, last_stats_ts)) = device else {
            continue;
        };

        let dt = last_stats_ts.map(|ts| (timestamp - ts).max(1) as f64).unwrap_or(1.0);

        let rx_delta = match last_rx {
            Some(previous) if peer.rx_bytes as i64 >= previous => peer.rx_bytes as i64 - previous,
            Some(_) => peer.rx_bytes as i64,
            None => peer.rx_bytes as i64,
        };
        let tx_delta = match last_tx {
            Some(previous) if peer.tx_bytes as i64 >= previous => peer.tx_bytes as i64 - previous,
            Some(_) => peer.tx_bytes as i64,
            None => peer.tx_bytes as i64,
        };

        conn.execute(
            "UPDATE devices SET
                rx_total = rx_total + ?2,
                tx_total = tx_total + ?3,
                last_rx = ?4,
                last_tx = ?5,
                rx_rate = ?6,
                tx_rate = ?7,
                last_stats_ts = ?8,
                last_handshake = ?9
             WHERE id = ?1",
            params![
                &device_id,
                rx_delta,
                tx_delta,
                peer.rx_bytes as i64,
                peer.tx_bytes as i64,
                rx_delta as f64 / dt,
                tx_delta as f64 / dt,
                timestamp,
                peer.latest_handshake,
            ],
        )?;
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
