# Complete ValueSkins Edge-to-Database Architecture
**For Meta at 500M DAU (billions of requests/day)**

---

## SYSTEM TOPOLOGY

```
                    INTERNET (5B+ requests/day)
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ↓                   ↓                   ↓
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │ US Region│        │EU Region │        │AP Region │
    │ (Primary)│        │(Secondary)│       │(Tertiary)│
    └────┬─────┘        └────┬─────┘        └────┬─────┘
         │                   │                   │
    ┌────▼──────────────────────────────────────────┐
    │ CLOUD LOAD BALANCER (Layer 4: TCP/UDP)       │
    │ - DDoS protection (AWS Shield/GCP Armor)     │
    │ - Geo-routing (route to closest region)      │
    │ - Health checks (/health/ready every 5s)     │
    │ - SSL termination option (offload HTTPS)     │
    │ - Connection limit: 10M concurrent           │
    └────┬──────────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────────────┐
    │ CDN (Cloudflare / Akamai / AWS CloudFront)   │
    │ - Caches static assets globally              │
    │ - HTTP compression (Brotli)                  │
    │ - DDoS mitigation at edge                    │
    │ - Serves 80% of traffic (static assets)      │
    └────┬──────────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────────────┐
    │ REGIONAL K8S CLUSTER (3+ per region)         │
    │                                              │
    │  ┌────────────────────────────────────────┐ │
    │  │ INGRESS LAYER (NGINX)                  │ │
    │  │ ┌──────────────┐  ┌─────────────────┐ │ │
    │  │ │ Ingress Pod  │  │ Ingress Pod     │ │ │
    │  │ │ (3-20 replicas) │ (rotate w/ k8s) │ │ │
    │  │ ├──────────────┤  ├─────────────────┤ │ │
    │  │ │ Port 80/443  │  │ 500K req/sec    │ │ │
    │  │ │ SSL/TLS      │  │ Rate limiting   │ │ │
    │  │ │ Compression  │  │ WAF (ModSec)    │ │ │
    │  │ │ Static serve │  │ Logging         │ │ │
    │  │ │ Health check │  │ Metrics         │ │ │
    │  │ └──────────────┘  └─────────────────┘ │ │
    │  └──────────────────────────────────────┘ │
    │                   │                       │
    │  ┌────────────────▼────────────────────┐ │
    │  │ SERVICE MESH (Istio)                │ │
    │  │ ┌────────────────────────────────┐ │ │
    │  │ │ Virtual Service (routing)      │ │ │
    │  │ │ Destination Rule (LB, circuit) │ │ │
    │  │ │ PeerAuth (mTLS)                │ │ │
    │  │ │ Network Policy (isolation)     │ │ │
    │  │ └────────────────────────────────┘ │ │
    │  └──────────────┬───────────────────┘ │
    │               │                       │
    │  ┌────────────┴───────────────────┐ │
    │  │ API PODS (Rust + Actix-Web)   │ │
    │  ├─────────────┬─────────────────┤ │
    │  │ Matching    │ Marketplace     │ │
    │  │ Service     │ Service         │ │
    │  │ 8-100 pods  │ 4-50 pods       │ │
    │  │ 500K req/s  │ 100K req/s      │ │
    │  │ total       │ total           │ │
    │  └─────────────┴─────────────────┘ │
    │                │                    │
    │  ┌─────────────▼──────────────────┐ │
    │  │ CACHE LAYER (Redis)            │ │
    │  │ - Creator profiles (hot)       │ │
    │  │ - Reputation scores (hot)      │ │
    │  │ - Session data (auth tokens)   │ │
    │  │ - 99% hit rate target          │ │
    │  └─────────────┬──────────────────┘ │
    │               │                      │
    │  ┌────────────▼──────────────────┐  │
    │  │ DATABASE (PostgreSQL)         │  │
    │  │ - 3 write replicas            │  │
    │  │ - 8+ read replicas (regional) │  │
    │  │ - Sharding: 8 shards          │  │
    │  │ - Backups: every 15 min       │  │
    │  │ - 1M+ TPS capacity            │  │
    │  │ - Append-only schema          │  │
    │  │ - Audit trail (immutable)     │  │
    │  └───────────────────────────────┘  │
    │                                      │
    │ OBSERVABILITY STACK                 │
    │ ┌────────────────────────────────┐ │
    │ │ Prometheus (metrics)           │ │
    │ │ Grafana (dashboards)           │ │
    │ │ ELK (logs)                     │ │
    │ │ Jaeger (tracing)               │ │
    │ │ PagerDuty (alerts)             │ │
    │ └────────────────────────────────┘ │
    └─────────────────────────────────────┘
         │
         │ Cross-region replication (RPO: 15 min)
         │
    ┌────▼──────────────────────────────────────────┐
    │ BACKUP & DISASTER RECOVERY                    │
    │ - S3 (object storage)                         │
    │ - Point-in-time recovery (PITR) 30 days       │
    │ - Cross-region backup (automatic)             │
    │ - Recovery time objective (RTO): 1 hour       │
    └───────────────────────────────────────────────┘
```

---

## TRAFFIC FLOW (1 HTTP Request)

```
1. Browser sends request
   GET https://api.instagram.com/v1/matching/discover
   Authorization: Bearer eyJhbGc...

2. Hits CDN first (Cloudflare)
   ✓ If asset request (*.js, *.css, *.png): served from cache
   ✓ If dynamic request: passed to origin (Cloud LB)

3. Cloud Load Balancer receives
   ✓ Checks source IP against DDoS rules
   ✓ Routes to healthy NGINX pod in closest K8s cluster
   ✓ Measures: latency, packet loss, etc.

4. NGINX Ingress pod processes
   ✓ Decrypts SSL/TLS (terminates HTTPS)
   ✓ Parses request: method, path, headers, body
   ✓ Checks rate limits: per IP (100 req/s), per user (500 req/s)
   ✓ Applies WAF rules: checks for SQL injection, XSS
   ✓ Adds headers: X-Correlation-ID, X-Forwarded-For
   ✓ Routes to API pod (via Istio)

   Logs JSON:
   {
     "timestamp": "2026-02-28T10:15:30Z",
     "client_ip": "203.0.113.42",
     "method": "GET",
     "uri": "/v1/matching/discover",
     "status": "200",
     "latency_ms": 45,
     "correlation_id": "a1b2c3d4-e5f6-47g8-h9i0"
   }

5. Istio mTLS (service mesh)
   ✓ Verifies NGINX pod identity
   ✓ Encrypts traffic: NGINX → API pod
   ✓ Applies circuit breaker: if pod slow, queue requests
   ✓ Routes: round-robin / least-conn across healthy API pods

6. API Pod (Rust + Actix-Web)
   ✓ Deserialize request
   ✓ Validate: auth token, signature, input
   ✓ Check Redis cache: creator profiles (hit rate ~95%)
   ✓ If miss: query PostgreSQL read replica
   ✓ Apply business logic: matching algorithm
   ✓ Serialize response to JSON
   ✓ Send back via Istio → NGINX → CDN → Browser

7. Response through CDN
   ✓ NGINX compresses: JSON 10KB → 2KB (with Gzip)
   ✓ CDN caches if Cache-Control: public (rarely)
   ✓ Browser displays data

Latency breakdown:
  ├─ TLS negotiation: 10ms (amortized, TCP reuse)
  ├─ Network (client → LB): 20ms (varies by region)
  ├─ NGINX (LB → mTLS → API): 10ms
  ├─ API processing: 20ms (Redis cache hit)
  ├─ Network (API → client): 20ms
  └─ Browser render: varies

Total: ~80ms (p95: 120ms, p99: 180ms)
```

---

## RESOURCE ALLOCATION BY LAYER

### NGINX Ingress Layer

| Metric | Value | Reason |
|--------|-------|--------|
| **Pods** | 3-20 | HA minimum 3; scale to 20 at peak |
| **CPU per pod** | 250m-2000m | Scales based on requests |
| **Memory per pod** | 512Mi-1Gi | Buffers for large responses |
| **Connections per pod** | 100K concurrent | Tuned for 1M users |
| **Throughput per pod** | 500K req/sec | Rust comparison baseline |
| **Latency (p99)** | <100ms | Target SLA |

### API Pods (Matching Service)

| Metric | Value | Reason |
|--------|-------|--------|
| **Pods** | 8-100 | Matching is hot path |
| **CPU per pod** | 500m-2000m | Higher than NGINX (business logic) |
| **Memory per pod** | 256Mi-1Gi | In-memory caches, parsing buffers |
| **Connections per pod** | 100 concurrent | HTTP Keep-Alive reduces this |
| **Throughput per pod** | 50K-100K req/sec | Actix-Web capability |
| **Total throughput** | 500K-10M req/sec | Scales linearly |

### Database Layer

| Metric | Value | Reason |
|--------|-------|--------|
| **Write replicas** | 3+ | HA, failover, cross-region |
| **Read replicas** | 8+ | Distribute read load |
| **Shards** | 8 | Horizontal scaling |
| **Connections per replica** | 500+ | Connection pooling |
| **Latency (p99)** | <20ms | In-memory indexes, fast disks |
| **Throughput (reads)** | 1M+ queries/sec | Parallelized across replicas |
| **Throughput (writes)** | 100K+ queries/sec | Limited by WAL (write-ahead log) |

---

## SCALING PROGRESSION

### 10K DAU (Testing Phase)

```
┌─────────────────────────────────────────┐
│ 1 NGINX pod                             │
│ 2 API pods (matching)                   │
│ 1 PostgreSQL instance (3.9 compute)     │
│ 1 Redis instance (cache.r5.large)       │
│ 1 Kubernetes cluster (3 nodes)          │
├─────────────────────────────────────────┤
│ Cost: $3,000/month                      │
│ Throughput: 50K req/sec (plenty)        │
│ Latency p99: 20ms                       │
│ Error rate: < 0.01%                     │
└─────────────────────────────────────────┘
```

### 1M DAU (Product Launch)

```
┌─────────────────────────────────────────┐
│ 5 NGINX pods (LB: 500K req/sec)         │
│ 20 API pods (matching)                  │
│ 10 API pods (marketplace)               │
│ PostgreSQL: 3 write + 4 read replicas   │
│ Redis: 3 nodes (cluster mode)           │
│ 2 Kubernetes clusters (HA)              │
├─────────────────────────────────────────┤
│ Cost: $30,000/month                     │
│ Throughput: 2M req/sec                  │
│ Latency p99: 50ms                       │
│ Error rate: < 0.05%                     │
└─────────────────────────────────────────┘
```

### 100M DAU (Production at Scale)

```
┌─────────────────────────────────────────┐
│ 15 NGINX pods (LB: 1.5M req/sec)        │
│ 60 API pods (matching)                  │
│ 30 API pods (marketplace)               │
│ PostgreSQL: 3 write + 8 read + sharding │
│ Redis: 6 nodes (cluster mode)           │
│ 3 Kubernetes clusters (multi-region)    │
├─────────────────────────────────────────┤
│ Cost: $200,000/month                    │
│ Throughput: 5M req/sec                  │
│ Latency p99: 75ms                       │
│ Error rate: < 0.1%                      │
└─────────────────────────────────────────┘
```

### 500M DAU (Meta Scale)

```
┌─────────────────────────────────────────┐
│ 40 NGINX pods (LB: 4M req/sec)          │
│ 200 API pods (matching)                 │
│ 100 API pods (marketplace)              │
│ PostgreSQL: 3 write + 16 read + 8 shards│
│ Redis: 12 nodes (cluster mode, multi-AZ)│
│ 5 Kubernetes clusters (global)          │
├─────────────────────────────────────────┤
│ Cost: $500,000+/month                   │
│ Throughput: 10M+ req/sec                │
│ Latency p99: 100ms                      │
│ Error rate: < 0.1%                      │
│ Availability: 99.99% (52.6 min/year max)│
└─────────────────────────────────────────┘
```

---

## DEPENDENCIES & INTEGRATION POINTS

### External Dependencies (must be operational)

| Service | Criticality | Fallback | Notes |
|---------|------------|----------|-------|
| PostgreSQL | Critical | RTO 1hr | Primary bottleneck at scale |
| Redis | High | In-memory cache (slower) | Performance degrades 10x without cache |
| Kubernetes API | High | Manual pod restart | Rare issue, handled by operator |
| Cloud DNS | High | Route 53 failover | Required for domain resolution |
| Cloud LB | Critical | Manual reroute | Blocks all external traffic if down |

### Internal Dependencies (must be healthy)

| Component | Depends On | If Fails | Mitigation |
|-----------|-----------|---------|-----------|
| NGINX | Kubernetes | Manual pod creation | Auto-scaling handles this |
| API Pods | PostgreSQL | Return 503 | Circuit breaker + queue |
| API Pods | Redis | Slower (10x) | Queries database, still works |
| Istio | Kubernetes API | Manual routing | Fall back to Kubernetes Service |
| Load Balancer | Health checks | Removes pods | Replicas handle load |

---

## DEPLOYMENT CHECKLIST

- [ ] **Pre-deployment**
  - [ ] DNS zones configured
  - [ ] SSL certificates ready
  - [ ] Kubernetes clusters created (3+ regions)
  - [ ] Cloud LB provisioned
  - [ ] Database clusters created (3+ regions)
  - [ ] Redis clusters created (cache)

- [ ] **Day 1: Infrastructure**
  - [ ] kubectl apply ingress-controller.yaml
  - [ ] kubectl apply valueskins-ingress.yaml
  - [ ] kubectl apply frontend-static-serving.yaml
  - [ ] Verify: `kubectl get pods -n ingress-nginx`
  - [ ] Verify: `kubectl get svc -n ingress-nginx` (check EXTERNAL-IP)

- [ ] **Day 2: Application**
  - [ ] kubectl apply deployment.yaml (API pods)
  - [ ] Verify: `kubectl get pods -n valueskins`
  - [ ] Check logs: `kubectl logs -f deployment/valueskins-matching`
  - [ ] Health check: `curl https://api.instagram.com/health/ready`

- [ ] **Day 3: Monitoring**
  - [ ] kubectl apply prometheus-config.yaml
  - [ ] kubectl apply grafana-dashboards.yaml
  - [ ] Open Grafana: `kubectl port-forward svc/grafana 3000:3000`
  - [ ] Configure alerts: error rate, latency, CPU, memory

- [ ] **Day 4: Testing**
  - [ ] Load test: k6 with 100 → 1000 concurrent users
  - [ ] Check: p99 latency < 100ms, error rate < 0.1%
  - [ ] Security test: SQL injection, XSS attempts
  - [ ] Canary: 1% traffic for 4 hours

- [ ] **Day 5-7: Gradual Rollout**
  - [ ] 1% traffic: monitor for 4 hours
  - [ ] 10% traffic: monitor for 2 hours
  - [ ] 50% traffic: monitor for 1 hour
  - [ ] 100% traffic: monitor continuously

---

## INCIDENT RESPONSE

### Scenario: NGINX Latency Spike

```
Alert: nginx_ingress_request_duration_sec{quantile="0.99"} > 500ms

Diagnosis (5 min):
  1. Check NGINX CPU: kubectl top pods -n ingress-nginx
  2. Check NGINX memory: kubectl describe pod <nginx-pod>
  3. Check backlog: netstat -an | grep ESTABLISHED | wc -l
  4. Check database latency: SELECT ... EXPLAIN ANALYZE

Possible causes:
  • Database slow (queries taking 200ms instead of 5ms)
  • Backend pods slow (need more replicas)
  • Network issue (packet loss, latency to DB)
  • High traffic spike (expected, scale up)

Fix (2-5 min):
  • Increase API pod replicas: kubectl scale deployment/valueskins-matching --replicas=100
  • OR add read replica if database slow
  • OR enable feature flag caching if available

Rollback if needed:
  • kubectl scale deployment/valueskins-matching --replicas=60
  • Monitor for 10 minutes
```

### Scenario: Error Rate Spike (> 1%)

```
Alert: rate(nginx_ingress_requests_total{status="5xx"}[5m]) > 0.01

Diagnosis (5 min):
  1. Check logs: kubectl logs -f deployment/valueskins-matching | grep ERROR
  2. Check database: SELECT COUNT(*) FROM transactions WHERE status='ERROR'
  3. Check feature flags: is a recently deployed feature causing crashes?

Possible causes:
  • Database connection exhaustion (pool full)
  • Out of memory pod (OOM)
  • Uncaught exception in new code
  • Dependent service down (payment API, etc.)

Fix (2-5 min):
  • Disable feature flag: kubectl patch configmap feature-flags \
    -p '{"data":{"new_feature":"false"}}'
  • Restart pods: kubectl rollout restart deployment/valueskins-matching
  • OR scale up API pods if connection pool exhausted

Rollback if needed:
  • kubectl rollout undo deployment/valueskins-matching
  • Monitor for 10 minutes
```

### Scenario: Database Running Out of Disk

```
Alert: postgresql_disk_usage > 90%

Diagnosis (5 min):
  1. Check: SELECT pg_size_pretty(pg_database_size('valueskins_prod'));
  2. Check: SELECT table, size FROM table_sizes ORDER BY size DESC;
  3. Check: Are there old logs/events not cleaned up?

Possible causes:
  • WAL (write-ahead log) not being archived (retention policy misconfigured)
  • Large table growing faster than expected
  • Backups piling up without cleanup

Fix (15-30 min):
  1. Trigger manual VACUUM ANALYZE (reclaim space)
  2. Archive old data to S3 (cold storage)
  3. Add disk space (cloud provider, 1 hour)
  4. Update retention policy to prevent recurrence

Prevention:
  • Automated backup cleanup (keep 30 days only)
  • Monitor disk growth rate: alert if > 10% per week
  • Run VACUUM ANALYZE daily (off-peak)
```

---

## SUMMARY

✅ **NGINX handles all edge concerns:**
- SSL/TLS termination (HTTPS)
- Rate limiting (DDoS, brute force)
- WAF (SQL injection, XSS)
- Static file serving (React assets)
- Request logging (compliance, debugging)
- Health checks (pod liveness)
- Load balancing (500K req/sec per server)

✅ **Kubernetes + Istio handle internal networking:**
- Service discovery
- Load balancing (round-robin, least-conn)
- Circuit breaking (resilience)
- mTLS (encryption between services)
- Canary deployments (gradual rollout)

✅ **PostgreSQL handles data:**
- ACID transactions (consistency)
- Replication (availability)
- Sharding (scalability)
- Append-only logs (audit trail)
- Point-in-time recovery (disaster recovery)

✅ **Redis handles performance:**
- In-memory caching (99% hit rate target)
- Session storage (auth tokens)
- Rate limit counters (efficiency)
- Pub/sub (real-time updates)

---

**All pieces together = production-ready at billions of users.**
