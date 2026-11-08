use anyhow::Result;
use tokio::process::Command;
use vipn_shared::AgentPeer;

const ROOT_RATE_MBIT: u32 = 1000;

pub struct Shaper {
    signature: String,
}

impl Shaper {
    pub fn new() -> Self {
        Self { signature: String::new() }
    }

    pub async fn apply(&mut self, interface: &str, peers: &[AgentPeer], dry_run: bool) -> Result<bool> {
        let mut entries: Vec<(String, Option<u32>)> = peers
            .iter()
            .filter_map(|peer| {
                let ip = peer.allowed_ips.split('/').next()?.trim();
                if ip.is_empty() {
                    return None;
                }
                Some((ip.to_string(), peer.limit_mbit))
            })
            .collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));

        let signature = entries
            .iter()
            .map(|(ip, limit)| match limit {
                Some(limit) => format!("{ip}:{limit}"),
                None => format!("{ip}:-"),
            })
            .collect::<Vec<_>>()
            .join(",");

        if signature == self.signature {
            return Ok(false);
        }

        run(interface, &["qdisc", "del", "dev", interface, "root"], dry_run).await;
        run(interface, &["qdisc", "del", "dev", interface, "ingress"], dry_run).await;

        if !entries.is_empty() {
            let root = format!("{ROOT_RATE_MBIT}mbit");
            let add_root = run(
                interface,
                &["qdisc", "add", "dev", interface, "root", "handle", "1:", "htb", "default", "999"],
                dry_run,
            )
            .await;
            if add_root {
                run(
                    interface,
                    &[
                        "class", "add", "dev", interface, "parent", "1:", "classid", "1:1", "htb", "rate", &root,
                        "ceil", &root,
                    ],
                    dry_run,
                )
                .await;
                run(
                    interface,
                    &[
                        "class", "add", "dev", interface, "parent", "1:1", "classid", "1:999", "htb", "rate", &root,
                        "ceil", &root,
                    ],
                    dry_run,
                )
                .await;
                run(
                    interface,
                    &["qdisc", "add", "dev", interface, "handle", "ffff:", "ingress"],
                    dry_run,
                )
                .await;

                let mut class = 10u32;
                for (ip, limit) in &entries {
                    let Some(limit) = limit else { continue };
                    let rate = format!("{limit}mbit");
                    let classid = format!("1:{class}");

                    run(
                        interface,
                        &[
                            "class", "add", "dev", interface, "parent", "1:1", "classid", &classid, "htb", "rate",
                            &rate, "ceil", &rate, "burst", "32k", "cburst", "64k",
                        ],
                        dry_run,
                    )
                    .await;

                    run(
                        interface,
                        &[
                            "filter", "add", "dev", interface, "parent", "1:", "protocol", "ip", "prio", "1", "u32",
                            "match", "ip", "dst", &format!("{ip}/32"), "flowid", &classid,
                        ],
                        dry_run,
                    )
                    .await;

                    let burst = format!("{}k", (*limit as u64) * 8);
                    run(
                        interface,
                        &[
                            "filter", "add", "dev", interface, "parent", "ffff:", "protocol", "ip", "prio", "1", "u32",
                            "match", "ip", "src", &format!("{ip}/32"), "police", "rate", &rate, "burst", &burst, "drop",
                        ],
                        dry_run,
                    )
                    .await;

                    class += 1;
                }
            }
        }

        self.signature = signature;
        Ok(true)
    }
}

async fn run(interface: &str, args: &[&str], dry_run: bool) -> bool {
    if dry_run {
        tracing::info!(dry_run = true, "tc {}", args.join(" "));
        return true;
    }

    match Command::new("tc").args(args).output().await {
        Ok(output) if output.status.success() => true,
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::debug!(interface, command = args.join(" "), error = %stderr.trim(), "tc command failed");
            false
        }
        Err(error) => {
            tracing::warn!(%error, "cannot run tc");
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn peer(ip: &str, limit: Option<u32>) -> AgentPeer {
        AgentPeer {
            public_key: "key".into(),
            allowed_ips: format!("{ip}/32"),
            limit_mbit: limit,
        }
    }

    #[test]
    fn signature_changes_with_limits() {
        let peers = vec![peer("10.66.66.2", Some(20)), peer("10.66.66.3", None)];
        let mut entries: Vec<(String, Option<u32>)> = peers
            .iter()
            .map(|p| (p.allowed_ips.split('/').next().unwrap().to_string(), p.limit_mbit))
            .collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        let sig = entries
            .iter()
            .map(|(ip, limit)| match limit {
                Some(l) => format!("{ip}:{l}"),
                None => format!("{ip}:-"),
            })
            .collect::<Vec<_>>()
            .join(",");
        assert_eq!(sig, "10.66.66.2:20,10.66.66.3:-");
    }
}
