use std::fs;
use std::process::Command;

use anyhow::{Context, Result};
use vipn_shared::{HostMetrics, PeerReport};

#[derive(Default)]
pub struct Collector {
    previous_cpu: Option<(u64, u64)>,
}

impl Collector {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn collect(&mut self, peers: Vec<PeerReport>) -> Result<HostMetrics> {
        let (cpu_percent, previous) = read_cpu(self.previous_cpu);
        self.previous_cpu = Some(previous);

        let mem_total_kb = meminfo("MemTotal");
        let mem_available_kb = meminfo("MemAvailable");
        let load1 = fs::read_to_string("/proc/loadavg")
            .ok()
            .and_then(|text| text.split_whitespace().next().and_then(|v| v.parse::<f64>().ok()))
            .unwrap_or(0.0);

        let uptime_secs = fs::read_to_string("/proc/uptime")
            .ok()
            .and_then(|text| text.split_whitespace().next().and_then(|v| v.parse::<f64>().ok()))
            .map(|secs| secs as u64)
            .unwrap_or(0);

        let (disk_total_kb, disk_available_kb) = disk_usage()?;
        let (net_rx_bytes, net_tx_bytes) = net_counters()?;

        Ok(HostMetrics {
            cpu_percent,
            load1,
            mem_total_kb,
            mem_available_kb,
            disk_total_kb,
            disk_available_kb,
            uptime_secs,
            net_rx_bytes,
            net_tx_bytes,
            peers,
        })
    }
}

fn read_cpu(previous: Option<(u64, u64)>) -> (f64, (u64, u64)) {
    let Ok(text) = fs::read_to_string("/proc/stat") else {
        return (0.0, previous.unwrap_or((0, 0)));
    };
    let Some(line) = text.lines().next() else {
        return (0.0, previous.unwrap_or((0, 0)));
    };

    let values: Vec<u64> = line
        .split_whitespace()
        .skip(1)
        .filter_map(|value| value.parse::<u64>().ok())
        .collect();
    if values.len() < 5 {
        return (0.0, previous.unwrap_or((0, 0)));
    }

    let idle = values[3] + values[4];
    let total: u64 = values.iter().take(8).sum();
    let previous = previous.unwrap_or((total, idle));
    let delta_total = total.saturating_sub(previous.0);
    let delta_idle = idle.saturating_sub(previous.1);

    let percent = if delta_total == 0 {
        0.0
    } else {
        (delta_total.saturating_sub(delta_idle)) as f64 * 100.0 / delta_total as f64
    };

    (percent, (total, idle))
}

fn meminfo(key: &str) -> u64 {
    let Ok(text) = fs::read_to_string("/proc/meminfo") else {
        return 0;
    };
    text.lines()
        .find(|line| line.starts_with(key))
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0)
}

fn disk_usage() -> Result<(u64, u64)> {
    let output = Command::new("df")
        .args(["-kP", "/"])
        .output()
        .context("cannot run df")?;
    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().nth(1).context("unexpected df output")?;
    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.len() < 4 {
        anyhow::bail!("unexpected df output");
    }
    Ok((fields[1].parse()?, fields[3].parse()?))
}

fn net_counters() -> Result<(u64, u64)> {
    let text = fs::read_to_string("/proc/net/dev").context("cannot read /proc/net/dev")?;
    let mut rx = 0u64;
    let mut tx = 0u64;
    for line in text.lines().skip(2) {
        let Some((name, rest)) = line.split_once(':') else {
            continue;
        };
        if name.trim() == "lo" {
            continue;
        }
        let fields: Vec<&str> = rest.split_whitespace().collect();
        if fields.len() < 16 {
            continue;
        }
        rx += fields[0].parse::<u64>().unwrap_or(0);
        tx += fields[8].parse::<u64>().unwrap_or(0);
    }
    Ok((rx, tx))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disk_usage_is_positive() {
        let (total, available) = disk_usage().expect("df");
        assert!(total > 0);
        assert!(available <= total);
    }

    #[test]
    fn net_counters_are_readable() {
        let (rx, tx) = net_counters().expect("net");
        assert!(rx > 0 || tx > 0);
    }
}
