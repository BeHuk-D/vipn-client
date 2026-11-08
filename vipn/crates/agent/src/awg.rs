use std::process::Output;

use anyhow::{bail, Context, Result};
use tokio::process::Command;
use vipn_shared::PeerReport;

async fn run(args: &[&str], dry_run: bool) -> Result<Option<Output>> {
    if dry_run {
        tracing::info!(dry_run = true, "awg {}", args.join(" "));
        return Ok(None);
    }
    let output = Command::new("awg")
        .args(args)
        .output()
        .await
        .context("cannot run awg")?;
    if !output.status.success() {
        bail!(
            "awg {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }
    Ok(Some(output))
}

pub async fn peers(interface: &str, dry_run: bool) -> Result<Vec<String>> {
    let Some(output) = run(&["show", interface, "peers"], dry_run).await? else {
        return Ok(Vec::new());
    };
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_owned)
        .collect())
}

pub async fn set_peer(interface: &str, public_key: &str, allowed_ips: &str, dry_run: bool) -> Result<()> {
    run(&["set", interface, "peer", public_key, "allowed-ips", allowed_ips], dry_run).await?;
    Ok(())
}

pub async fn remove_peer(interface: &str, public_key: &str, dry_run: bool) -> Result<()> {
    run(&["set", interface, "peer", public_key, "remove"], dry_run).await?;
    Ok(())
}

pub async fn peer_stats(interface: &str, dry_run: bool) -> Result<Vec<PeerReport>> {
    let Some(output) = run(&["show", interface, "dump"], dry_run).await? else {
        return Ok(Vec::new());
    };

    let text = String::from_utf8_lossy(&output.stdout);
    let mut stats = Vec::new();
    for line in text.lines().skip(1) {
        let fields: Vec<&str> = line.split('\t').collect();
        if fields.len() < 8 {
            continue;
        }
        let Ok(rx) = fields[5].parse::<u64>() else { continue };
        let Ok(tx) = fields[6].parse::<u64>() else { continue };
        stats.push(PeerReport {
            public_key: fields[0].to_string(),
            rx_bytes: rx,
            tx_bytes: tx,
            latest_handshake: fields[4].parse::<i64>().unwrap_or(0),
        });
    }
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_dump(dump: &str) -> Vec<PeerReport> {
        let mut stats = Vec::new();
        for line in dump.lines().skip(1) {
            let fields: Vec<&str> = line.split('\t').collect();
            if fields.len() < 8 {
                continue;
            }
            stats.push(PeerReport {
                public_key: fields[0].to_string(),
                rx_bytes: fields[5].parse().unwrap(),
                tx_bytes: fields[6].parse().unwrap(),
                latest_handshake: fields[4].parse().unwrap(),
            });
        }
        stats
    }

    #[test]
    fn parses_dump() {
        let dump = "privkey\tpubkey\t51820\toff\n\
                    peerkey\t(none)\t1.2.3.4:5678\t10.66.66.2/32\t1700000000\t123\t456\t25\n";
        let stats = parse_dump(dump);
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].public_key, "peerkey");
        assert_eq!(stats[0].rx_bytes, 123);
        assert_eq!(stats[0].tx_bytes, 456);
        assert_eq!(stats[0].latest_handshake, 1_700_000_000);
    }
}
