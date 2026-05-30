use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::time::timeout;

/// Circuit breaker states
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CircuitState {
    Closed,     // Normal operation
    Open,      // Failure, rejecting requests
    HalfOpen,  // Testing if service recovered
}

/// Circuit breaker configuration
#[derive(Debug, Clone)]
pub struct CircuitConfig {
    pub failure_threshold: u64,     // Failures before opening
    pub success_threshold: u64,     // Successes before closing
    pub timeout: Duration,          // How long to stay open
    pub half_open_requests: u64,    // Requests to allow in half-open
}

impl Default for CircuitConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            success_threshold: 2,
            timeout: Duration::from_secs(60),
            half_open_requests: 3,
        }
    }
}

/// Circuit breaker for external service calls
/// Prevents cascading failures from overwhelming recovering services
#[derive(Clone)]
pub struct CircuitBreaker {
    state: Arc<AtomicU64>,      // 0=Closed, 1=Open, 2=HalfOpen
    failures: Arc<AtomicU64>,
    successes: Arc<AtomicU64>,
    last_failure: Arc<RwLock<Option<Instant>>>,
    config: CircuitConfig,
    name: String,
}

impl CircuitBreaker {
    pub fn new(name: &str) -> Self {
        Self::with_config(name, CircuitConfig::default())
    }

    pub fn with_config(name: &str, config: CircuitConfig) -> Self {
        Self {
            state: Arc::new(AtomicU64::new(0)),
            failures: Arc::new(AtomicU64::new(0)),
            successes: Arc::new(AtomicU64::new(0)),
            last_failure: Arc::new(RwLock::new(None)),
            config,
            name: name.to_string(),
        }
    }

    /// Get current state
    pub fn state(&self) -> CircuitState {
        let state = self.state.load(Ordering::SeqCst);
        match state {
            0 => CircuitState::Closed,
            1 => CircuitState::Open,
            2 => CircuitState::HalfOpen,
            _ => CircuitState::Closed,
        }
    }

    /// Check if circuit allows request
    pub async fn can_execute(&self) -> bool {
        let state = self.state();
        
        match state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                // Check if timeout has passed
                let last_failure = *self.last_failure.read().await;
                if let Some(instant) = last_failure {
                    if instant.elapsed() > self.config.timeout {
                        // Transition to half-open
                        self.state.store(2, Ordering::SeqCst);
                        self.successes.store(0, Ordering::SeqCst);
                        return true;
                    }
                }
                false
            }
            CircuitState::HalfOpen => {
                let successes = self.successes.load(Ordering::SeqCst);
                successes < self.config.half_open_requests
            }
        }
    }

    /// Record a successful call
    pub async fn record_success(&self) {
        let state = self.state();
        
        if state == CircuitState::HalfOpen {
            let successes = self.successes.fetch_add(1, Ordering::SeqCst) + 1;
            if successes >= self.config.success_threshold {
                // Transition to closed
                self.state.store(0, Ordering::SeqCst);
                self.failures.store(0, Ordering::SeqCst);
                self.successes.store(0, Ordering::SeqCst);
            }
        } else if state == CircuitState::Closed {
            // Reset failures on success
            self.failures.store(0, Ordering::SeqCst);
        }
    }

    /// Record a failed call
    pub async fn record_failure(&self) {
        let failures = self.failures.fetch_add(1, Ordering::SeqCst) + 1;
        
        // Update last failure time
        *self.last_failure.write().await = Some(Instant::now());
        
        let state = self.state();
        
        if state == CircuitState::HalfOpen {
            // Any failure in half-open goes back to open
            self.state.store(1, Ordering::SeqCst);
        } else if failures >= self.config.failure_threshold {
            // Transition to open
            self.state.store(1, Ordering::SeqCst);
        }
    }

    /// Execute a function with circuit breaker protection
    pub async fn execute<F, T, E>(&self, f: F) -> Result<T, CircuitError>
    where
        F: std::future::Future<Output = Result<T, E>>,
        E: std::fmt::Debug,
    {
        if !self.can_execute().await {
            return Err(CircuitError::CircuitOpen {
                service: self.name.clone(),
            });
        }

        match f.await {
            Ok(result) => {
                self.record_success().await;
                Ok(result)
            }
            Err(e) => {
                self.record_failure().await;
                Err(CircuitError::ServiceError {
                    service: self.name.clone(),
                    error: format!("{:?}", e),
                })
            }
        }
    }

    /// Get metrics
    pub fn metrics(&self) -> CircuitMetrics {
        let state = self.state();
        CircuitMetrics {
            state,
            failures: self.failures.load(Ordering::SeqCst),
            successes: self.successes.load(Ordering::SeqCst),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CircuitMetrics {
    pub state: CircuitState,
    pub failures: u64,
    pub successes: u64,
}

#[derive(Debug)]
pub enum CircuitError {
    CircuitOpen { service: String },
    ServiceError { service: String, error: String },
    Timeout { service: String },
}

impl std::fmt::Display for CircuitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CircuitError::CircuitOpen { service } => {
                write!(f, "Circuit breaker OPEN for service: {}", service)
            }
            CircuitError::ServiceError { service, error } => {
                write!(f, "Service error for {}: {}", service, error)
            }
            CircuitError::Timeout { service } => {
                write!(f, "Timeout for service: {}", service)
            }
        }
    }
}

impl std::error::Error for CircuitError {}

/// Bulkhead pattern - isolate resources per service
pub struct Bulkhead {
    max_concurrent: usize,
    active: Arc<AtomicUsize>,
    waiting: Arc<AtomicUsize>,
}

impl Bulkhead {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            max_concurrent,
            active: Arc::new(AtomicUsize::new(0)),
            waiting: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Try to acquire a slot
    pub fn try_acquire(&self) -> BulkheadPermit {
        let active = self.active.load(Ordering::SeqCst);
        
        if active < self.max_concurrent {
            self.active.fetch_add(1, Ordering::SeqCst);
            BulkheadPermit {
                bulkhead: self.clone(),
            }
        } else {
            BulkheadPermit {
                bulkhead: self.clone(),
            }
        }
    }

    /// Get current active count
    pub fn active(&self) -> usize {
        self.active.load(Ordering::SeqCst)
    }

    /// Get number waiting
    pub fn waiting(&self) -> usize {
        self.waiting.load(Ordering::SeqCst)
    }
}

impl Clone for Bulkhead {
    fn clone(&self) -> Self {
        Self {
            max_concurrent: self.max_concurrent,
            active: self.active.clone(),
            waiting: self.waiting.clone(),
        }
    }
}

#[derive(Clone)]
pub struct BulkheadPermit {
    bulkhead: Bulkhead,
}

impl Drop for BulkheadPermit {
    fn drop(&mut self) {
        self.bulkhead.active.fetch_sub(1, Ordering::SeqCst);
    }
}

/// Retry with exponential backoff
pub async fn retry_with_backoff<F, T, E>(
    f: F,
    max_retries: u32,
    initial_delay: Duration,
    max_delay: Duration,
) -> Result<T, E>
where
    F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>>>>,
{
    let mut delay = initial_delay;
    let mut last_error: Option<E> = None;

    for attempt in 0..max_retries {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_error = Some(e);
                if attempt < max_retries - 1 {
                    tokio::time::sleep(delay).await;
                    delay = std::cmp::min(delay * 2, max_delay);
                }
            }
        }
    }
    
    Err(last_error.unwrap())
}