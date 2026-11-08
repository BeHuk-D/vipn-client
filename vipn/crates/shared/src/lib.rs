use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPeer {
    pub public_key: String,
    pub allowed_ips: String,
    #[serde(default)]
    pub limit_mbit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentState {
    pub interface: String,
    pub peers: Vec<AgentPeer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerReport {
    pub public_key: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
    pub latest_handshake: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostMetrics {
    pub cpu_percent: f64,
    pub load1: f64,
    pub mem_total_kb: u64,
    pub mem_available_kb: u64,
    pub disk_total_kb: u64,
    pub disk_available_kb: u64,
    pub uptime_secs: u64,
    pub net_rx_bytes: u64,
    pub net_tx_bytes: u64,
    pub peers: Vec<PeerReport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentReport {
    pub metrics: HostMetrics,
}
