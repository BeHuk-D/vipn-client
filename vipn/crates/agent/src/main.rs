mod awg;
mod metrics;
mod shaping;
mod sync;

use std::time::Duration;

use anyhow::Result;
use clap::Parser;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;
use vipn_shared::AgentReport;

#[derive(Parser)]
#[command(name = "vipn-agent", about = "Applies panel peers to an AmneziaWG interface")]
struct Args {
    #[arg(long, env = "VIPN_PANEL_URL", default_value = "http://127.0.0.1:8080")]
    panel: String,

    #[arg(long, env = "VIPN_AGENT_TOKEN")]
    token: String,

    #[arg(long, env = "VIPN_INTERFACE")]
    interface: Option<String>,

    #[arg(long, default_value_t = 10)]
    interval: u64,

    #[arg(long)]
    dry_run: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let args = Args::parse();
    let base = args.panel.trim_end_matches('/');
    let state_url = format!("{base}/api/agent/state");
    let report_url = format!("{base}/api/agent/report");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;

    let mut collector = metrics::Collector::new();
    let mut shaper = shaping::Shaper::new();

    loop {
        match sync::sync_once(&client, &state_url, &args.token, args.interface.as_deref(), args.dry_run).await {
            Ok(outcome) => {
                info!(applied = outcome.applied, removed = outcome.removed, "state applied");

                match shaper.apply(&outcome.interface, &outcome.peers, args.dry_run).await {
                    Ok(true) => info!(peers = outcome.peers.len(), "traffic shaping updated"),
                    Ok(false) => {}
                    Err(error) => warn!(%error, "cannot apply traffic shaping"),
                }

                match awg::peer_stats(&outcome.interface, args.dry_run).await {
                    Ok(stats) => match collector.collect(stats) {
                        Ok(host) => {
                            let report = AgentReport { metrics: host };
                            match client
                                .post(&report_url)
                                .header("x-agent-token", &args.token)
                                .json(&report)
                                .send()
                                .await
                            {
                                Ok(response) if response.status().is_success() => {}
                                Ok(response) => warn!(status = %response.status(), "report rejected"),
                                Err(error) => warn!(%error, "cannot send report"),
                            }
                        }
                        Err(error) => warn!(%error, "cannot collect metrics"),
                    },
                    Err(error) => warn!(%error, "cannot read peer stats"),
                }
            }
            Err(error) => warn!(%error, "sync failed"),
        }

        tokio::time::sleep(Duration::from_secs(args.interval.max(2))).await;
    }
}
