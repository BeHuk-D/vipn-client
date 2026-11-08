use std::collections::HashSet;
use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};

use crate::crypto;
use crate::error::{ApiError, ApiResult};

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &str) -> Result<Arc<Db>> {
        if let Some(parent) = Path::new(path).parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("cannot create {}", parent.display()))?;
        }
        let conn = Connection::open(path).with_context(|| format!("cannot open {path}"))?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        let db = Arc::new(Self { conn: Mutex::new(conn) });
        db.migrate()?;
        Ok(db)
    }

    pub fn conn(&self) -> MutexGuard<'_, Connection> {
        self.conn.lock().expect("database mutex poisoned")
    }

    fn migrate(&self) -> Result<()> {
        self.conn().execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admins (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'admin',
                active INTEGER NOT NULL DEFAULT 1,
                must_change_password INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                endpoint_port INTEGER NOT NULL,
                interface TEXT NOT NULL,
                listen_port INTEGER NOT NULL,
                server_public_key TEXT NOT NULL,
                network_cidr TEXT NOT NULL,
                dns TEXT NOT NULL,
                country TEXT NOT NULL DEFAULT '',
                mtu INTEGER NOT NULL DEFAULT 1280,
                awg_params_json TEXT NOT NULL DEFAULT '{}',
                agent_token_hash TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS access_keys (
                id TEXT PRIMARY KEY,
                server_id TEXT NOT NULL REFERENCES servers(id),
                label TEXT NOT NULL,
                email TEXT,
                note TEXT,
                starts_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                duration_hours INTEGER NOT NULL,
                revoked_at INTEGER,
                max_devices INTEGER NOT NULL DEFAULT 1,
                created_by TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                access_key_id TEXT NOT NULL REFERENCES access_keys(id),
                server_id TEXT NOT NULL REFERENCES servers(id),
                name TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                public_key TEXT NOT NULL,
                address TEXT NOT NULL,
                revoked_at INTEGER,
                created_at INTEGER NOT NULL,
                speed_limit_mbit INTEGER,
                rx_total INTEGER NOT NULL DEFAULT 0,
                tx_total INTEGER NOT NULL DEFAULT 0,
                last_rx INTEGER,
                last_tx INTEGER,
                rx_rate REAL NOT NULL DEFAULT 0,
                tx_rate REAL NOT NULL DEFAULT 0,
                last_stats_ts INTEGER,
                last_handshake INTEGER,
                UNIQUE(server_id, address)
            );

            CREATE TABLE IF NOT EXISTS metrics (
                server_id TEXT NOT NULL,
                ts INTEGER NOT NULL,
                cpu REAL NOT NULL,
                load1 REAL NOT NULL,
                mem_total INTEGER NOT NULL,
                mem_used INTEGER NOT NULL,
                disk_total INTEGER NOT NULL,
                disk_used INTEGER NOT NULL,
                net_rx INTEGER NOT NULL,
                net_tx INTEGER NOT NULL,
                rx_rate REAL NOT NULL,
                tx_rate REAL NOT NULL,
                PRIMARY KEY (server_id, ts)
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                ts INTEGER NOT NULL,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                ip TEXT,
                user_agent TEXT,
                detail_json TEXT
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                login TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                session_version INTEGER NOT NULL DEFAULT 0,
                must_change_password INTEGER NOT NULL DEFAULT 0,
                trial_used_at INTEGER,
                last_login_at INTEGER,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS users_created_idx ON users(created_at);

            CREATE INDEX IF NOT EXISTS access_keys_server_idx ON access_keys(server_id);
            CREATE INDEX IF NOT EXISTS devices_access_key_idx ON devices(access_key_id);
            CREATE INDEX IF NOT EXISTS devices_server_idx ON devices(server_id);
            CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON audit_log(ts);
            "#,
        )?;

        self.ensure_column("servers", "country", "TEXT NOT NULL DEFAULT ''")?;
        self.ensure_column("servers", "default_speed_limit_mbit", "INTEGER")?;

        self.ensure_column("devices", "speed_limit_mbit", "INTEGER")?;
        self.ensure_column("devices", "rx_total", "INTEGER NOT NULL DEFAULT 0")?;
        self.ensure_column("devices", "tx_total", "INTEGER NOT NULL DEFAULT 0")?;
        self.ensure_column("devices", "last_rx", "INTEGER")?;
        self.ensure_column("devices", "last_tx", "INTEGER")?;
        self.ensure_column("devices", "rx_rate", "REAL NOT NULL DEFAULT 0")?;
        self.ensure_column("devices", "tx_rate", "REAL NOT NULL DEFAULT 0")?;
        self.ensure_column("devices", "last_stats_ts", "INTEGER")?;
        self.ensure_column("devices", "last_handshake", "INTEGER")?;
        self.ensure_column("access_keys", "subscription_token_hash", "TEXT")?;
        self.ensure_column("devices", "hwid_hash", "TEXT")?;
        self.ensure_column("devices", "device_info_json", "TEXT NOT NULL DEFAULT '{}'")?;
        self.ensure_column("devices", "bound_via", "TEXT NOT NULL DEFAULT 'admin'")?;
        self.ensure_column("devices", "last_seen_at", "INTEGER")?;
        self.ensure_column("access_keys", "user_id", "TEXT REFERENCES users(id)")?;
        self.ensure_column("users", "referral_code", "TEXT")?;
        self.ensure_column("users", "referred_by", "TEXT REFERENCES users(id)")?;
        self.ensure_column("users", "balance_kopecks", "INTEGER NOT NULL DEFAULT 0")?;
        self.ensure_column("users", "discount_kopecks", "INTEGER NOT NULL DEFAULT 0")?;
        self.ensure_column("users", "signup_ip", "TEXT")?;

        {
            let mut conn = self.conn();
            let has_server_id: i64 = conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info('metrics') WHERE name = 'server_id'",
                [],
                |row| row.get(0),
            )?;
            if has_server_id == 0 {
                let fallback: Option<String> = conn
                    .query_row(
                        "SELECT id FROM servers ORDER BY created_at ASC, id ASC LIMIT 1",
                        [],
                        |row| row.get(0),
                    )
                    .optional()?;
                let tx = conn.transaction()?;
                tx.execute_batch(
                    "ALTER TABLE metrics RENAME TO metrics_legacy;
                     CREATE TABLE metrics (
                         server_id TEXT NOT NULL,
                         ts INTEGER NOT NULL,
                         cpu REAL NOT NULL,
                         load1 REAL NOT NULL,
                         mem_total INTEGER NOT NULL,
                         mem_used INTEGER NOT NULL,
                         disk_total INTEGER NOT NULL,
                         disk_used INTEGER NOT NULL,
                         net_rx INTEGER NOT NULL,
                         net_tx INTEGER NOT NULL,
                         rx_rate REAL NOT NULL,
                         tx_rate REAL NOT NULL,
                         PRIMARY KEY (server_id, ts)
                     );",
                )?;
                if let Some(server_id) = fallback {
                    tx.execute(
                        "INSERT INTO metrics(server_id, ts, cpu, load1, mem_total, mem_used,
                                             disk_total, disk_used, net_rx, net_tx, rx_rate, tx_rate)
                         SELECT ?1, ts, cpu, load1, mem_total, mem_used,
                                disk_total, disk_used, net_rx, net_tx, rx_rate, tx_rate
                         FROM metrics_legacy",
                        [&server_id],
                    )?;
                }
                tx.execute_batch("DROP TABLE metrics_legacy;")?;
                tx.commit()?;
            }
            conn.execute_batch(
                "CREATE INDEX IF NOT EXISTS metrics_server_ts_idx ON metrics(server_id, ts);",
            )?;
        }

        {
            let conn = self.conn();
            let index_exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'devices_key_hwid_idx'",
                [],
                |row| row.get(0),
            )?;
            let has_server_id: i64 = conn.query_row(
                "SELECT COUNT(*) FROM pragma_index_info('devices_key_hwid_idx') WHERE name = 'server_id'",
                [],
                |row| row.get(0),
            )?;
            if index_exists > 0 && has_server_id == 0 {
                conn.execute_batch("DROP INDEX devices_key_hwid_idx;")?;
            }
        }

        let conn = self.conn();
        conn.execute_batch(
            "CREATE UNIQUE INDEX IF NOT EXISTS access_keys_subscription_token_idx
                 ON access_keys(subscription_token_hash) WHERE subscription_token_hash IS NOT NULL;
             CREATE UNIQUE INDEX IF NOT EXISTS devices_key_hwid_idx
                 ON devices(access_key_id, server_id, hwid_hash) WHERE hwid_hash IS NOT NULL;
             CREATE INDEX IF NOT EXISTS access_keys_user_idx ON access_keys(user_id);
             CREATE UNIQUE INDEX IF NOT EXISTS access_keys_one_active_per_user
                 ON access_keys(user_id) WHERE user_id IS NOT NULL AND revoked_at IS NULL;
             CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx
                 ON users(referral_code) WHERE referral_code IS NOT NULL;
             CREATE TABLE IF NOT EXISTS referrals (
                 id TEXT PRIMARY KEY,
                 inviter_id TEXT NOT NULL REFERENCES users(id),
                 invitee_id TEXT NOT NULL UNIQUE REFERENCES users(id),
                 inviter_kopecks INTEGER NOT NULL,
                 invitee_kopecks INTEGER NOT NULL,
                 status TEXT NOT NULL,
                 ip TEXT,
                 inviter_ip TEXT,
                 created_at INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS referrals_inviter_idx ON referrals(inviter_id);",
        )?;

        let missing_codes: Vec<String> = {
            let mut statement =
                conn.prepare("SELECT id FROM users WHERE referral_code IS NULL")?;
            let rows = statement
                .query_map([], |row| row.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        };
        for user_id in missing_codes {
            let code = unique_referral_code(&conn)?;
            conn.execute(
                "UPDATE users SET referral_code = ?2 WHERE id = ?1",
                params![&user_id, code],
            )?;
        }

        let secret: String = match conn
            .query_row("SELECT value FROM meta WHERE key = 'subscription_secret'", [], |row| row.get(0))
            .optional()?
        {
            Some(value) => value,
            None => {
                let value = crypto::new_token();
                conn.execute(
                    "INSERT INTO meta(key, value) VALUES('subscription_secret', ?1)",
                    [&value],
                )?;
                value
            }
        };
        let pending: Vec<String> = {
            let mut statement = conn
                .prepare("SELECT id FROM access_keys WHERE subscription_token_hash IS NULL")?;
            let rows = statement
                .query_map([], |row| row.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        };
        for key_id in pending {
            let hash = crypto::token_hash(&crypto::subscription_token(&secret, &key_id));
            conn.execute(
                "UPDATE access_keys SET subscription_token_hash = ?2 WHERE id = ?1",
                params![&key_id, hash],
            )?;
        }

        conn.execute(
            "INSERT INTO meta(key, value) VALUES('default_speed_limit_mbit', '20')
             ON CONFLICT(key) DO NOTHING",
            [],
        )?;
        conn.execute("DELETE FROM metrics WHERE ts < ?1", [crate::db::now() - 86_400])?;

        Ok(())
    }

    fn ensure_column(&self, table: &str, column: &str, definition: &str) -> Result<()> {
        let exists: i64 = self.conn().query_row(
            "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2",
            params![table, column],
            |row| row.get(0),
        )?;
        if exists == 0 {
            self.conn().execute(
                &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
                [],
            )?;
        }
        Ok(())
    }

    pub fn meta_get(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .conn()
            .query_row("SELECT value FROM meta WHERE key = ?1", [key], |row| row.get(0))
            .optional()?)
    }

    pub fn meta_set(&self, key: &str, value: &str) -> Result<()> {
        self.conn().execute(
            "INSERT INTO meta(key, value) VALUES(?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_or_create_meta(&self, key: &str, generate: impl FnOnce() -> String) -> Result<String> {
        if let Some(value) = self.meta_get(key)? {
            return Ok(value);
        }
        let value = generate();
        self.meta_set(key, &value)?;
        Ok(value)
    }

    pub fn seed_admin(&self, email: Option<&str>, password: Option<&str>) -> Result<()> {
        let (Some(email), Some(password)) = (email, password) else {
            return Ok(());
        };
        let count: i64 = self
            .conn()
            .query_row("SELECT COUNT(*) FROM admins", [], |row| row.get(0))?;
        if count > 0 {
            return Ok(());
        }
        let hash = crypto::hash_password(password)?;
        self.conn().execute(
            "INSERT INTO admins(id, email, password_hash, role, active, created_at)
             VALUES(?1, ?2, ?3, 'admin', 1, ?4)",
            params![uuid::Uuid::new_v4().to_string(), email, hash, now()],
        )?;
        tracing::info!(%email, "seeded admin account");
        Ok(())
    }

    pub fn audit(
        &self,
        actor: &str,
        action: &str,
        target_type: &str,
        target_id: &str,
        detail: Option<serde_json::Value>,
    ) -> Result<()> {
        self.conn().execute(
            "INSERT INTO audit_log(id, ts, actor, action, target_type, target_id, detail_json)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                uuid::Uuid::new_v4().to_string(),
                now(),
                actor,
                action,
                target_type,
                target_id,
                detail.map(|value| value.to_string())
            ],
        )?;
        Ok(())
    }
}

pub fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

pub fn normalize_referral_code(raw: &str) -> Option<String> {
    let code = raw.trim().to_ascii_lowercase();
    let valid = (4..=16).contains(&code.len())
        && code
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit());
    valid.then_some(code)
}

pub fn unique_referral_code(conn: &Connection) -> Result<String> {
    for _ in 0..8 {
        let code = crypto::generate_referral_code();
        let taken: i64 = conn.query_row(
            "SELECT COUNT(*) FROM users WHERE referral_code = ?1",
            [&code],
            |row| row.get(0),
        )?;
        if taken == 0 {
            return Ok(code);
        }
    }
    Err(anyhow::anyhow!("cannot generate unique referral code"))
}

pub fn allocate_address(conn: &Connection, server_id: &str, cidr: &str) -> ApiResult<String> {
    let (base, prefix) = cidr
        .split_once('/')
        .ok_or_else(|| ApiError::BadRequest("некорректная подсеть".into()))?;
    if prefix != "24" {
        return Err(ApiError::BadRequest("поддерживается только /24".into()));
    }
    let octets: Vec<u8> = base
        .split('.')
        .map(|part| part.parse::<u8>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| ApiError::BadRequest("некорректная подсеть".into()))?;
    if octets.len() != 4 {
        return Err(ApiError::BadRequest("некорректная подсеть".into()));
    }

    let mut used = HashSet::new();
    let mut statement = conn.prepare("SELECT address FROM devices WHERE server_id = ?1")?;
    for address in statement.query_map([server_id], |row| row.get::<_, String>(0))? {
        used.insert(address?);
    }

    for host in 2..=254u8 {
        let candidate = format!("{}.{}.{}.{}/32", octets[0], octets[1], octets[2], host);
        if !used.contains(&candidate) {
            return Ok(candidate);
        }
    }
    Err(ApiError::Conflict("нет свободных адресов".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_adds_user_schema_and_is_idempotent() {
        let path = std::env::temp_dir().join(format!("vipn-migrate-{}.db", uuid::Uuid::new_v4()));
        let path = path.to_string_lossy().to_string();

        let db = Db::open(&path).unwrap();
        {
            let conn = db.conn();
            let user_columns: i64 = conn
                .query_row("SELECT COUNT(*) FROM pragma_table_info('users')", [], |row| row.get(0))
                .unwrap();
            assert_eq!(user_columns, 14);

            let user_id: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('access_keys') WHERE name = 'user_id'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(user_id, 1);

            let indexes: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index'
                     AND name IN ('access_keys_user_idx', 'access_keys_one_active_per_user')",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(indexes, 2);

            let referrals: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'referrals'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(referrals, 1);

            let referral_indexes: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index'
                     AND name IN ('users_referral_code_idx', 'referrals_inviter_idx')",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(referral_indexes, 2);
        }
        drop(db);

        let db = Db::open(&path).unwrap();
        {
            let conn = db.conn();
            let users: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'users'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(users, 1);
        }
        drop(db);

        for suffix in ["", "-wal", "-shm"] {
            std::fs::remove_file(format!("{path}{suffix}")).ok();
        }
    }

    #[test]
    fn migration_moves_metrics_to_per_server() {
        let path = std::env::temp_dir().join(format!("vipn-metrics-{}.db", uuid::Uuid::new_v4()));
        let path = path.to_string_lossy().to_string();

        let report_ts = now();
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(
                "CREATE TABLE servers (
                     id TEXT PRIMARY KEY, name TEXT NOT NULL, host TEXT NOT NULL,
                     endpoint_port INTEGER NOT NULL, interface TEXT NOT NULL,
                     listen_port INTEGER NOT NULL, server_public_key TEXT NOT NULL,
                     network_cidr TEXT NOT NULL, dns TEXT NOT NULL,
                     country TEXT NOT NULL DEFAULT '', mtu INTEGER NOT NULL DEFAULT 1280,
                     awg_params_json TEXT NOT NULL DEFAULT '{}', agent_token_hash TEXT NOT NULL,
                     enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
                 );
                 INSERT INTO servers(id, name, host, endpoint_port, interface, listen_port,
                                     server_public_key, network_cidr, dns, agent_token_hash, created_at)
                 VALUES('s1', 'A', '1.2.3.4', 51820, 'awg1', 51820, 'pub', '10.66.66.0/24', '10.66.66.1', 'hash', 100);
                 CREATE TABLE metrics (
                     ts INTEGER PRIMARY KEY, cpu REAL NOT NULL, load1 REAL NOT NULL,
                     mem_total INTEGER NOT NULL, mem_used INTEGER NOT NULL,
                     disk_total INTEGER NOT NULL, disk_used INTEGER NOT NULL,
                     net_rx INTEGER NOT NULL, net_tx INTEGER NOT NULL,
                     rx_rate REAL NOT NULL, tx_rate REAL NOT NULL
                 );",
            )
            .unwrap();
            conn.execute("INSERT INTO metrics VALUES(?1, 1.0, 0.1, 1, 1, 1, 1, 10, 20, 0.0, 0.0)",
                [report_ts]).unwrap();
        }

        for _ in 0..2 {
            let db = Db::open(&path).unwrap();
            {
                let conn = db.conn();
                let has_server_id: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM pragma_table_info('metrics') WHERE name = 'server_id'",
                        [],
                        |row| row.get(0),
                    )
                    .unwrap();
                assert_eq!(has_server_id, 1);

                let (server_id, ts): (String, i64) = conn
                    .query_row("SELECT server_id, ts FROM metrics", [], |row| {
                        Ok((row.get(0)?, row.get(1)?))
                    })
                    .unwrap();
                assert_eq!(server_id, "s1");
                assert_eq!(ts, report_ts);

                let has_limit: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM pragma_table_info('servers') WHERE name = 'default_speed_limit_mbit'",
                        [],
                        |row| row.get(0),
                    )
                    .unwrap();
                assert_eq!(has_limit, 1);
            }
        }

        for suffix in ["", "-wal", "-shm"] {
            std::fs::remove_file(format!("{path}{suffix}")).ok();
        }
    }

    #[test]
    fn referral_codes_are_backfilled_and_normalized() {
        let path = std::env::temp_dir().join(format!("vipn-ref-{}.db", uuid::Uuid::new_v4()));
        let path = path.to_string_lossy().to_string();
        let db = Db::open(&path).unwrap();
        db.conn()
            .execute(
                "INSERT INTO users(id, login, password_hash, created_at) VALUES('u1', 'old', 'x', 1)",
                [],
            )
            .unwrap();
        db.migrate().unwrap();
        let code: String = db
            .conn()
            .query_row("SELECT referral_code FROM users WHERE id = 'u1'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(code.len(), 8);
        assert!(code.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()));
        drop(db);

        assert_eq!(normalize_referral_code("  AB12cd "), Some("ab12cd".to_string()));
        assert_eq!(normalize_referral_code("a"), None);
        assert_eq!(normalize_referral_code("ab cd"), None);
        assert_eq!(normalize_referral_code("ab12cd34ef56gh78i"), None);

        for suffix in ["", "-wal", "-shm"] {
            std::fs::remove_file(format!("{path}{suffix}")).ok();
        }
    }
}
