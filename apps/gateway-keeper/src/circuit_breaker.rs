use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

#[derive(Clone)]
pub struct CircuitBreaker {
    name: &'static str,
    threshold: u32,
    open_for: Duration,
    inner: Arc<CacheLine<CircuitState>>,
}

#[repr(align(64))]
struct CacheLine<T>(Mutex<T>);

struct CircuitState {
    failures: u32,
    open_until: Option<Instant>,
    probe_in_flight: bool,
}

impl CircuitBreaker {
    pub fn new(name: &'static str, threshold: u32, open_for: Duration) -> Self {
        Self {
            name,
            threshold: threshold.max(1),
            open_for,
            inner: Arc::new(CacheLine(Mutex::new(CircuitState {
                failures: 0,
                open_until: None,
                probe_in_flight: false,
            }))),
        }
    }

    pub fn name(&self) -> &'static str {
        self.name
    }

    pub fn allow_request(&self) -> bool {
        let mut state = self.lock_state();
        match state.open_until {
            None => true,
            Some(until) if Instant::now() < until => false,
            Some(_) if state.probe_in_flight => false,
            Some(_) => {
                state.probe_in_flight = true;
                true
            }
        }
    }

    pub fn record_success(&self) {
        let mut state = self.lock_state();
        state.failures = 0;
        state.open_until = None;
        state.probe_in_flight = false;
    }

    pub fn record_failure(&self) {
        let mut state = self.lock_state();
        state.failures = state.failures.saturating_add(1);
        if state.failures >= self.threshold || state.probe_in_flight {
            state.open_until = Some(Instant::now() + self.open_for);
        }
        state.probe_in_flight = false;
    }

    fn lock_state(&self) -> std::sync::MutexGuard<'_, CircuitState> {
        self.inner.0.lock().unwrap_or_else(|poisoned| {
            auction_observability::report_error(
                "gateway-keeper",
                "circuit_breaker_mutex_poisoned",
                "recovering poisoned circuit-breaker state",
                serde_json::json!({"downstream": self.name}),
            );
            poisoned.into_inner()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_at_threshold_and_success_resets() {
        let breaker = CircuitBreaker::new("test", 2, Duration::from_secs(60));
        breaker.record_failure();
        assert!(breaker.allow_request());
        breaker.record_failure();
        assert!(!breaker.allow_request());
        breaker.record_success();
        assert!(breaker.allow_request());
    }
}
