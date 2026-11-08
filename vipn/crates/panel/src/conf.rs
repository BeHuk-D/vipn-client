use chrono::{DateTime, Utc};
use serde_json::Value;

pub struct ConfInput<'a> {
    pub subscription_url: &'a str,
    pub client_private_key: &'a str,
    pub client_address: &'a str,
    pub dns: &'a str,
    pub country: &'a str,
    pub mtu: i64,
    pub awg_params: &'a Value,
    pub server_public_key: &'a str,
    pub endpoint: &'a str,
    pub expires_at: DateTime<Utc>,
}

pub fn render(input: &ConfInput<'_>) -> String {
    let mut out = String::new();
    if !input.subscription_url.is_empty() {
        out.push_str(&format!("# ViPN-Subscription-Url: {}\n", input.subscription_url));
    }
    out.push_str(&format!(
        "# ViPN-Expires-At: {}\n",
        input.expires_at.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
    ));
    if !input.country.is_empty() {
        out.push_str(&format!("# ViPN-Country: {}\n", input.country.to_uppercase()));
    }
    out.push_str("[Interface]\n");
    out.push_str(&format!("PrivateKey = {}\n", input.client_private_key));
    out.push_str(&format!("Address = {}\n", input.client_address));
    out.push_str(&format!("DNS = {}\n", input.dns));
    out.push_str(&format!("MTU = {}\n", input.mtu));

    if let Some(params) = input.awg_params.as_object() {
        let mut keys: Vec<&String> = params.keys().collect();
        keys.sort();
        for key in keys {
            if let Some(value) = value_to_string(&params[key]) {
                out.push_str(&format!("{key} = {value}\n"));
            }
        }
    }

    out.push_str("\n[Peer]\n");
    out.push_str(&format!("PublicKey = {}\n", input.server_public_key));
    out.push_str("AllowedIPs = 0.0.0.0/0\n");
    out.push_str(&format!("Endpoint = {}\n", input.endpoint));
    out.push_str("PersistentKeepalive = 25\n");
    out
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(flag) => Some(flag.to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn renders_amneziawg_conf() {
        let params = json!({
            "Jc": 4,
            "Jmin": 40,
            "Jmax": 70,
            "S1": 30,
            "S2": 40,
            "S3": 50,
            "S4": 60,
            "H1": 1,
            "H2": 2,
            "H3": 3,
            "H4": 4
        });
        let expires = "2026-10-22T12:00:00Z".parse().unwrap();
        let conf = render(&ConfInput {
            subscription_url: "https://80.74.28.114/s/token",
            client_private_key: "PRIV",
            client_address: "10.66.66.2/32",
            dns: "1.1.1.1",
            country: "ru",
            mtu: 1280,
            awg_params: &params,
            server_public_key: "PUB",
            endpoint: "vpn.example:51820",
            expires_at: expires,
        });

        assert!(conf.starts_with("# ViPN-Subscription-Url: https://80.74.28.114/s/token\n"));
        assert!(conf.contains("# ViPN-Expires-At: 2026-10-22T12:00:00Z\n"));
        assert!(conf.contains("# ViPN-Country: RU\n"));
        assert!(conf.contains("[Interface]\nPrivateKey = PRIV\n"));
        assert!(conf.contains("Jc = 4\n"));
        assert!(conf.contains("H4 = 4\n"));
        assert!(conf.contains("[Peer]\nPublicKey = PUB\n"));
        assert!(conf.contains("Endpoint = vpn.example:51820\n"));
    }
}
