use anyhow::{bail, Context, Result};
use vipn_shared::{AgentPeer, AgentState};

use crate::awg;

pub struct Outcome {
    pub applied: usize,
    pub removed: usize,
    pub interface: String,
    pub peers: Vec<AgentPeer>,
}

pub async fn sync_once(
    client: &reqwest::Client,
    state_url: &str,
    token: &str,
    interface_override: Option<&str>,
    dry_run: bool,
) -> Result<Outcome> {
    let response = client
        .get(state_url)
        .header("x-agent-token", token)
        .send()
        .await
        .context("cannot reach panel")?;

    if !response.status().is_success() {
        bail!("panel returned {}", response.status());
    }

    let state: AgentState = response.json().await.context("invalid panel response")?;
    let interface = interface_override.unwrap_or(&state.interface).to_string();
    let desired = state.peers;

    let current = awg::peers(&interface, dry_run).await?;
    let mut removed = 0;
    for public_key in &current {
        if !desired.iter().any(|peer| &peer.public_key == public_key) {
            awg::remove_peer(&interface, public_key, dry_run).await?;
            removed += 1;
        }
    }

    let mut applied = 0;
    for peer in &desired {
        awg::set_peer(&interface, &peer.public_key, &peer.allowed_ips, dry_run).await?;
        applied += 1;
    }

    Ok(Outcome {
        applied,
        removed,
        interface,
        peers: desired,
    })
}
