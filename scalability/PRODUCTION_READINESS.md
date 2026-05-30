# Production Readiness Checklist for 100K Users

## Critical Path Dependencies (Must Complete Before Production)

### Phase 1: Deployment & Integration (3-4 weeks)
- [ ] Build & deploy Rust backend to EKS
- [ ] Connect WebSocket server to API gateway
- [ ] Connect message queue (Kafka) to backend
- [ ] Wire up distributed cache invalidation
- [ ] Test all 4 database shards are reachable

### Phase 2: Load Testing (1-2 weeks)
- [ ] Run k6 load test to 10K users on staging
- [ ] Measure p50, p95, p99 latencies
- [ ] Identify first bottleneck
- [ ] Fix bottleneck, re-test
- [ ] Validate throughput meets capacity goals

### Phase 3: Chaos & Resilience (2-3 weeks)
- [ ] Run LitmusChaos experiments daily
- [ ] Test Redis pod failure → app continues
- [ ] Test primary DB failure → failover to replica
- [ ] Test network partition → graceful degradation
- [ ] Test 5 backend pods crash → HPA scales up
- [ ] Document recovery time for each scenario

### Phase 4: Operational Readiness (1-2 weeks)
- [ ] Write runbooks for common incidents
- [ ] Train team on monitoring dashboards
- [ ] Define SLOs and alert thresholds
- [ ] Test incident response process
- [ ] Document disaster recovery procedure

---

## Performance Baselines (Must Measure)

### API Latency
```
Target (p50): < 100ms
Target (p95): < 300ms
Target (p99): < 1000ms

Baseline: [TO BE MEASURED]
Current: [TO BE MEASURED]
```

### Database Performance
```
Target: 10,000 writes/sec across 4 shards
Target: 50,000 reads/sec with caching
Target: < 20ms median query time

Baseline: [TO BE MEASURED]
Current: [TO BE MEASURED]
```

### WebSocket Connections
```
Target: 100K concurrent connections
Target: < 100ms message delivery
Target: < 1% connection loss

Baseline: [TO BE MEASURED]
Current: [TO BE MEASURED]
```

### Cache Hit Rate
```
Target: > 90% for user profile queries
Target: > 85% for deal data
Target: > 80% for message history

Baseline: [TO BE MEASURED]
Current: [TO BE MEASURED]
```

---

## Failure Modes & Recovery

### Scenario 1: Redis Cluster Fails
**Impact:** Session loss, cache loss, real-time features unavailable  
**Recovery Time:** 5-10 minutes (failover to replica)  
**Mitigation:** Circuit breaker returns stale cache on timeout  
**Test:** Run daily with LitmusChaos  

### Scenario 2: Primary Database Fails
**Impact:** Write operations blocked for 30-60s  
**Recovery Time:** Auto-failover to replica (30-60s)  
**Mitigation:** Queue writes to Kafka, replay on recovery  
**Test:** Run weekly  

### Scenario 3: Message Queue (Kafka) Fails
**Impact:** Chat/notifications delayed, not lost  
**Recovery Time:** 1-5 minutes (broker restart)  
**Mitigation:** EventStore (Redis) holds last 30 days  
**Test:** Run weekly  

### Scenario 4: Network Partition (Pod → Database)
**Impact:** Requests timeout, circuit breaker opens  
**Recovery Time:** 60-90s (timeout + reconnect)  
**Mitigation:** Graceful degradation, return cached data  
**Test:** Run daily with network latency injection  

### Scenario 5: 5 Backend Pods Crash
**Impact:** Traffic redistributed, latency spikes 2-3x  
**Recovery Time:** 30-60s (HPA detects, spins up new pods)  
**Mitigation:** Min 10 pods at start, max 100  
**Test:** Run weekly  

### Scenario 6: Database Connection Pool Exhausted
**Impact:** All requests return 503  
**Recovery Time:** 5-10s (connections timeout, freed)  
**Mitigation:** PgBouncer limits per-service, circuit breaker  
**Test:** Implement synthetic connection exhaustion test  

---

## Observability Requirements

### Metrics to Export (Prometheus)
```
API Server:
  - http_request_duration_seconds (histogram)
  - http_requests_total (counter by endpoint, status)
  - http_request_size_bytes (histogram)
  - database_query_duration_seconds (histogram by shard)
  - database_connection_pool_usage (gauge)
  - redis_command_duration_seconds (histogram)
  - cache_hit_rate (gauge)

WebSocket:
  - websocket_connections_total (gauge)
  - websocket_messages_sent_total (counter)
  - websocket_messages_received_total (counter)
  - websocket_connection_duration_seconds (histogram)

Message Queue:
  - kafka_producer_latency_ms (histogram)
  - kafka_consumer_lag_messages (gauge)
  - kafka_message_loss_total (counter)
  - message_delivery_latency_ms (histogram)

Business:
  - users_online_total (gauge)
  - deals_active_total (gauge)
  - messages_per_second (gauge)
  - creators_connected (gauge)
  - brands_connected (gauge)
```

### Dashboards Required
1. **System Health** — CPU, memory, disk per pod/node
2. **API Performance** — Latency, throughput, errors per endpoint
3. **Database** — Query latency, connection pool, replication lag
4. **Cache** — Hit rate, evictions, memory usage
5. **WebSocket** — Connection count, message latency, errors
6. **Business** — Active users, deals, messages, presence

### Alerts (PagerDuty/Slack)
```
CRITICAL (page immediately):
  - HTTP error rate > 1%
  - API p99 latency > 1000ms
  - Database replication lag > 5 seconds
  - WebSocket connections dropped > 100/min
  - Kafka consumer lag > 10K messages

HIGH (alert within 15 min):
  - API p95 latency > 500ms
  - Cache hit rate < 80%
  - Connection pool > 80% utilized
  - Pod CPU > 80%
  - Pod memory > 85%

MEDIUM (alert within 1 hour):
  - Node disk > 70%
  - Unused database indexes > 10
  - Slow queries > 100ms (p99)
```

---

## SLOs & Compliance

### Service Level Objectives
```
Availability SLO: 99.9% (43.2 minutes downtime/month allowed)
  - Measure: Successful API responses / Total requests
  - Excluded: Planned maintenance, client errors (4xx)

Latency SLO: p95 < 300ms
  - Measure: 95th percentile request time
  - Excluded: Requests > 10s (assumed client disconnected)

Error Rate SLO: < 0.1%
  - Measure: 5xx errors / Total requests
  - Excluded: Rate-limited requests (429)
```

### Data Protection
- [ ] All data encrypted at rest (AES-256-GCM)
- [ ] All data encrypted in transit (TLS 1.3)
- [ ] Database backups encrypted + cross-region
- [ ] User data deleted within 30 days of account deletion
- [ ] PII not logged or monitored
- [ ] HIPAA (if health data) or GDPR (if EU users) compliance verified

### Incident Response
- [ ] Incident escalation process defined
- [ ] Runbooks for top 10 incidents written
- [ ] Post-mortem template created
- [ ] On-call rotation established
- [ ] Communication template for users (if outage)
- [ ] Legal/PR notified of breach protocol

---

## Security Hardening

### Network Security
- [ ] VPC configured, no 0.0.0.0 exposure
- [ ] Security groups restrict ingress to load balancer only
- [ ] Network policies block pod-to-pod unauthorized traffic
- [ ] WAF enabled on Cloudflare (rate limiting, bot detection)
- [ ] DDoS mitigation (AWS Shield Advanced)

### Secrets Management
- [ ] All secrets in AWS Secrets Manager (not code)
- [ ] Database password rotated every 90 days
- [ ] API keys scoped per service
- [ ] JWT secret key rotated every 180 days
- [ ] Pre-commit hook blocks secret commits

### Access Control
- [ ] RBAC enabled on Kubernetes
- [ ] Admin access requires 2FA
- [ ] Production DB access requires VPN
- [ ] Audit logs of all admin actions
- [ ] Service accounts follow least privilege

### Input Validation
- [ ] All endpoints validate input schema (Zod/OpenAPI)
- [ ] Rate limiting enforced at API gateway
- [ ] Rate limiting enforced at database (per shard)
- [ ] Rate limiting enforced at WebSocket (per connection)
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (output encoding)

---

## Code Quality Gates

### Before Merging to Main
- [ ] All tests pass (>80% coverage)
- [ ] Linting passes (clippy for Rust)
- [ ] Type checking passes (tsc for TS)
- [ ] Security scan passes (git-secrets, cargo audit)
- [ ] Performance regression test passes
- [ ] Code review approved by 2 engineers

### Before Deploying to Production
- [ ] Staging deployment validated
- [ ] Load test passes at 1x expected load
- [ ] Chaos test passes (Redis failure scenario)
- [ ] Rollback procedure verified
- [ ] Database migrations tested on staging
- [ ] Feature flags ready for gradual rollout

---

## Post-Launch Monitoring (First 30 Days)

### Week 1: 1K Active Users
- [ ] Monitor error rate < 0.5%
- [ ] Monitor latency < 200ms p95
- [ ] Monitor database query times
- [ ] Monitor cache hit rate
- [ ] Monitor WebSocket connection stability

### Week 2: 5K Active Users
- [ ] Identify first performance bottleneck
- [ ] Measure under sustained load (1 hour+)
- [ ] Run chaos test (one pod crash)
- [ ] Test failover scenario

### Week 3: 10K Active Users
- [ ] Measure connection pool utilization
- [ ] Measure message queue throughput
- [ ] Test multi-shard consistency
- [ ] Validate read replica lag < 5s

### Week 4: 20K Active Users
- [ ] Run full chaos suite (all scenarios)
- [ ] Measure p99 latency at peak
- [ ] Test sharding under concurrent writes
- [ ] Validate cache invalidation works

---

## Go-Live Checklist

Final sign-off before 100K:
- [ ] Architecture reviewed by external consultant
- [ ] Security audit passed
- [ ] Load test validated at 150K (exceeds target)
- [ ] All SLOs demonstrated on production
- [ ] Incident response team trained
- [ ] Monitoring dashboards live
- [ ] On-call rotation active
- [ ] CEO, CTO, VP Eng alignment

