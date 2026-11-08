use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

struct Window {
    started: Instant,
    hits: u32,
}

pub struct RateLimiter {
    windows: Mutex<HashMap<String, Window>>,
    limit: u32,
    window: Duration,
}

impl RateLimiter {
    pub fn new(limit: u32, window: Duration) -> Self {
        Self {
            windows: Mutex::new(HashMap::new()),
            limit,
            window,
        }
    }

    pub fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let mut windows = self.windows.lock().expect("rate limiter poisoned");

        windows.retain(|_, window| now.duration_since(window.started) < self.window);

        let entry = windows.entry(key.to_string()).or_insert(Window {
            started: now,
            hits: 0,
        });
        if now.duration_since(entry.started) >= self.window {
            entry.started = now;
            entry.hits = 0;
        }
        entry.hits += 1;
        entry.hits <= self.limit
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_after_limit() {
        let limiter = RateLimiter::new(2, Duration::from_secs(60));
        assert!(limiter.check("ip"));
        assert!(limiter.check("ip"));
        assert!(!limiter.check("ip"));
        assert!(limiter.check("other"));
    }
}
