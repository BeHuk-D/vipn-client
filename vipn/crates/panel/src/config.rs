use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub bind: String,
    pub db_path: String,
    pub public_base_url: String,
    pub subscription_base_url: String,
    pub cookie_secure: bool,
    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        let bind = env::var("VIPN_BIND").unwrap_or_else(|_| "127.0.0.1:8080".to_string());
        let db_path = env::var("VIPN_DB").unwrap_or_else(|_| "/var/lib/vipn/vipn.db".to_string());
        let public_base_url = env::var("VIPN_PUBLIC_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string())
            .trim_end_matches('/')
            .to_string();
        let subscription_base_url = env::var("VIPN_SUBSCRIPTION_URL")
            .unwrap_or_else(|_| public_base_url.clone())
            .trim_end_matches('/')
            .to_string();
        let cookie_secure = public_base_url.starts_with("https://");

        Self {
            bind,
            db_path,
            public_base_url,
            subscription_base_url,
            cookie_secure,
            admin_email: env::var("VIPN_ADMIN_EMAIL").ok(),
            admin_password: env::var("VIPN_ADMIN_PASSWORD").ok(),
        }
    }
}
