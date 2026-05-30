# NGINX + Edge Deployment for ValueSkins at Meta Scale
**For: 500M DAU, billions of requests/day**

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────┐
│  BILLIONS OF USERS WORLDWIDE                        │
└──────────────┬──────────────────────────────────────┘
               │
               ├─ 30% → Cloudflare / Akamai (CDN)
               ├─ 40% → Closest AWS Region
               └─ 30% → Fallback Region
               │
       ┌───────┴──────────┐
       │ Meta AWS/GCP Load Balancer (Layer 4: TCP/UDP)
       │ - Distributes across 5+ regions
       │ - DDoS protection (AWS Shield / GCP Cloud Armor)
       │ - SSL termination option
       └───────┬──────────┘
               │
     ┌─────────┴──────────┐
     │   KUBERNETES CLUSTER (3 per region)
     │   ┌────────────────────────────┐
     │   │ NGINX Ingress (3-20 pods)  │
     │   │ - 500K req/sec per server  │
     │   │ - Rate limiting            │
     │   │ - WAF (ModSecurity)        │
     │   │ - SSL/TLS termination      │
     │   │ - Static file serving      │
     │   └───────┬────────────────────┘
     │           │
     │   ┌───────┴─────────────────────────┐
     │   │ SERVICE MESH (Istio)            │
     │   │ - mTLS between services         │
     │   │ - Circuit breaker               │
     │   │ - Canary deployments            │
     │   │ - Request routing               │
     │   └───────┬───────────────────────┐ │
     │           │                       │ │
     │   ┌───────▼────────┐  ┌───────────▼──┐
     │   │ Matching       │  │ Marketplace  │
     │   │ Service        │  │ Service      │
     │   │ (Rust pods)    │  │ (Rust pods)  │
     │   │ 8-100 pods     │  │ 4-50 pods    │
     │   └────────────────┘  └──────────────┘
     │           │
     │   ┌───────▼──────────────────┐
     │   │ PostgreSQL Cluster       │
     │   │ - 8+ read replicas       │
     │   │ - 3+ write replicas      │
     │   │ - Sharding (8 shards)    │
     │   │ - Backups every 15 min   │
     │   └──────────────────────────┘
     └─────────────────────────────┘
```

---

## DEPLOYMENT CHECKLIST

### Phase 1: Pre-Production Setup (Week 1-2)

- [ ] **Obtain SSL certificates** from Let's Encrypt or Meta's PKI
  - Wildcard cert for `*.instagram.com`
  - Cert rotation automated via cert-manager

- [ ] **Configure cloud load balancer** (AWS NLB or GCP NEL)
  - [ ] Set up 3+ regions for HA
  - [ ] Health check path: `/health/ready`
  - [ ] Enable DDoS protection tier

- [ ] **Create Kubernetes clusters** (3 per region minimum)
  - [ ] VPC peering between regions
  - [ ] Cross-region cluster connectivity

- [ ] **Deploy NGINX Ingress Controller**
  ```bash
  kubectl apply -f kubernetes/ingress-controller.yaml
  ```

- [ ] **Create TLS secrets**
  ```bash
  kubectl create secret tls valueskins-tls-cert \
    --cert=path/to/cert.crt \
    --key=path/to/cert.key \
    -n valueskins
  ```

- [ ] **Deploy Istio service mesh**
  ```bash
  istioctl install --set profile=production -y
  ```

### Phase 2: Application Deployment (Week 2-3)

- [ ] **Deploy ValueSkins ingress**
  ```bash
  kubectl apply -f kubernetes/valueskins-ingress.yaml
  ```

- [ ] **Deploy frontend static servers**
  ```bash
  kubectl apply -f kubernetes/frontend-static-serving.yaml
  ```

- [ ] **Deploy API pods** (matching + marketplace)
  ```bash
  kubectl apply -f kubernetes/deployment.yaml
  ```

- [ ] **Set up PostgreSQL cluster** (external, or via operator)
  - [ ] Master-slave replication
  - [ ] Read replicas in 3+ regions
  - [ ] Automated backups to S3 every 15 min

- [ ] **Configure monitoring**
  ```bash
  kubectl apply -f kubernetes/prometheus-config.yaml
  kubectl apply -f kubernetes/grafana-dashboards.yaml
  ```

### Phase 3: Traffic Testing (Week 3)

- [ ] **Canary deployment**: 1% of traffic
- [ ] **Monitor**: latency p99 < 100ms, error rate < 0.1%
- [ ] **Scale to 10%**: if metrics pass
- [ ] **Scale to 50%**: if metrics pass
- [ ] **Scale to 100%**: if metrics pass

### Phase 4: Production Hardening (Week 4+)

- [ ] **Enable WAF rules** (ModSecurity)
- [ ] **Activate rate limiting** at all tiers
- [ ] **Test incident responses**
- [ ] **Run chaos engineering** tests

---

## NGINX INGRESS DEPLOYMENT

### What NGINX Provides

| Capability | What It Does | Why It Matters |
|---|---|---|
| **Load Balancing** | Distributes traffic across API pods | Prevents any single pod from overloading |
| **SSL/TLS Termination** | Decrypts HTTPS, talks HTTP internally | Reduces CPU load on API servers |
| **Static File Serving** | Serves React assets directly | Doesn't waste API resources on static content |
| **Rate Limiting** | Caps requests per IP/user/endpoint | Prevents brute force, DDoS, abuse |
| **WAF (ModSecurity)** | Detects and blocks SQL injection, XSS | Protects against common attacks |
| **Compression** | Gzip/Brotli compresses responses | Reduces bandwidth by 80% for text |
| **Caching** | HTTP caching headers for browser/CDN | Reduces backend load by 60-80% |
| **Health Checks** | Tests if pods are alive before routing | Prevents routing to crashed pods |
| **Request Logging** | Structured JSON logs per request | Debugging, analytics, compliance |

### Configuration Summary

```yaml
# From ingress-controller.yaml
NGINX workers:           auto (matches CPU cores)
Connections per worker: 131,072 (handles 1M concurrent at 8 cores)
Request buffer:         128 MB (for large payloads)
Timeouts:               client 30s, upstream 60s (reasonable defaults)
Compression:            Gzip level 5 (CPU-friendly)
```

### Scaling Behavior

```
100K DAU   → 1-2 NGINX pods (100 req/sec per pod)
1M DAU     → 3-5 NGINX pods (500 req/sec per pod)
10M DAU    → 5-10 NGINX pods (up to 500K req/sec total)
100M DAU   → 10-20 NGINX pods (1M+ req/sec capacity)
500M DAU   → 20-40 NGINX pods (2M+ req/sec capacity)
```

---

## STATIC FILE SERVING

### How Frontend Assets Are Served

```
Browser requests: GET /static/js/main.a1b2c3d.js
                         │
                         ↓
         NGINX (caches for 30 days)
                         │
                         ↓
      If not in cache: fetch from ConfigMap / S3
                         │
                         ↓
      Compress (Gzip/Brotli) + cache
                         │
                         ↓
      Send with Cache-Control headers
```

### Cache Behavior

```
Immutable assets (content-hashed filename):
  /static/js/main.a1b2c3d.js  → cache 1 year (max-age=31536000)
  /static/css/style.f4e5d6.css → cache 1 year
  /images/logo.v2.png          → cache 1 year

Why: If filename changes, it's a new file. Old URLs never hit cache.

Mutable assets:
  /index.html     → no cache (check every time)
  /manifest.json  → cache 1 hour

Why: HTML/manifest may change between deploys.
```

### React Build Optimization

```
Build process adds content hash:
  BEFORE: /static/js/main.js
  AFTER:  /static/js/main.a1b2c3d.js
          /static/css/style.f4e5d6.css

Result:
  New deploys don't bust old users' caches
  Old versions remain available indefinitely
  Zero impact on users until they reload
```

---

## RATE LIMITING

### Tiered Strategy

```
Tier 1: Global (per NGINX pod)
  Limit: 1000 req/sec
  Scope: All traffic
  Action: Reject with 429 Too Many Requests

Tier 2: Per IP
  Limit: 100 req/sec per IP
  Scope: Unauthenticated requests
  Action: Reject, retry later

Tier 3: Per User
  Limit: 500 req/sec per user (higher than IP)
  Scope: Authenticated requests
  Action: Reject, user in good standing gets more

Tier 4: Per Endpoint
  /auth/**         → 10 req/min per IP (brute force protection)
  /marketplace/** → 50 req/sec per IP (high throughput)
  /matching/**    → 500 req/sec per IP (even higher)
```

### Why This Works

- **Global limit** catches DDoS and massive traffic spikes
- **Per-IP limit** prevents single attacker from consuming all quota
- **Per-user limit** rewards legitimate, authenticated users
- **Per-endpoint limits** let hot endpoints handle more traffic

### Example: Auth Endpoint

```
Attacker tries: 1000 login attempts / minute
  Hits Tier 4 limit: 10 req/min
  Gets rejected after 10 attempts
  Forced 1-minute backoff

Result: Can't brute force, no way to scale attack
```

---

## WAF (WEB APPLICATION FIREWALL)

### ModSecurity Rules

Configured in `valueskins-waf-rules` ConfigMap:

```
Rule 1000: SQL Injection
  Matches: UNION, SELECT, INSERT, UPDATE, DROP, etc.
  Action: Deny, return 403

Rule 1001: XSS
  Matches: <script>, javascript:, onerror=, etc.
  Action: Deny, return 403

Rule 1002: Path Traversal
  Matches: ../, ..\, %2f, %5c
  Action: Deny, return 403

Rule 1003: Large Bodies
  Matches: Request > 10 MB
  Action: Deny, return 413 Payload Too Large
```

### Why We Need WAF

```
Without WAF:
  Attacker: GET /api/users?id=1 OR 1=1
  Database: Returns all users (SQL injection successful)

With WAF:
  Attacker: GET /api/users?id=1 OR 1=1
  NGINX: Detects "OR 1=1" pattern
  Request: Blocked, returns 403
  Log: Incident recorded for review
```

---

## HTTPS/TLS CONFIGURATION

### Certificate Management

```
Solution: cert-manager (Kubernetes operator)

Lifecycle:
  1. cert-manager creates Certificate resource
  2. Let's Encrypt receives validation request
  3. cert-manager proves domain ownership (DNS-01)
  4. Certificate issued
  5. Stored as Kubernetes Secret (encrypted in etcd)
  6. NGINX loads cert, serves HTTPS
  7. cert-manager auto-renews 30 days before expiry
  8. Zero downtime (cert-manager handles rotation)
```

### TLS Version & Ciphers

```
Minimum: TLS 1.2 (TLS 1.3 preferred)
Ciphers: Only modern, secure ciphers:
  TLS_AES_256_GCM_SHA384
  TLS_CHACHA20_POLY1305_SHA256
  ECDHE-RSA-AES256-GCM-SHA384
  ECDHE-RSA-CHACHA20-POLY1305

Result: A+ SSL rating from Qualys SSL Labs
```

---

## MONITORING & ALERTING

### Metrics Exposed by NGINX

```
NGINX Ingress (Prometheus):
  nginx_ingress_controller_requests              (total requests)
  nginx_ingress_controller_request_duration_sec  (latency histogram)
  nginx_ingress_controller_request_size          (request size)
  nginx_ingress_controller_response_size         (response size)
  nginx_ingress_controller_ssl_verify_result     (cert validation)

Per-host metrics:
  nginx_ingress_controller_bytes_sent (host="api.instagram.com")
  nginx_ingress_controller_bytes_received
  nginx_ingress_controller_upstream_latency_sec
```

### Alert Rules

```
if nginx_ingress_request_duration_sec{quantile="0.99"} > 0.5:
  Severity: Warning
  Message: "NGINX p99 latency > 500ms"

if rate(nginx_ingress_requests_total{status="5xx"}[5m]) > 0.01:
  Severity: Critical
  Message: "Error rate > 1%"

if nginx_ingress_controller_requests_total > 1000000:
  Severity: Info
  Message: "1M+ requests served"

if nginx_ingress_ssl_verify_result{result="failed"} > 0:
  Severity: Critical
  Message: "SSL cert validation failing"
```

---

## DDoS PROTECTION

### Layer 1: Cloud Load Balancer (AWS Shield / GCP Cloud Armor)

```
Enabled by default:
  ✓ Large-scale DDoS protection (Tbps-level)
  ✓ Geo-blocking (if needed)
  ✓ Rate limiting at network level
  ✓ Bot detection (AWS WAF)
  ✓ IP reputation checking
```

### Layer 2: NGINX Rate Limiting

```
Per-IP limits (already configured):
  Max 100 req/sec per IP
  Max 1000 req/sec per NGINX pod

If attacker has 100 IPs:
  Each IP: 100 req/sec
  Total: 10K req/sec (easily absorbed)
```

### Layer 3: Istio Circuit Breaker

```
If backend slows down:
  NGINX keeps accepting requests (200 req/sec quota available)
  Istio circuit breaker trips
  Requests queued locally, not forwarded
  Prevents backend cascade failure
```

### Example: 1M req/sec DDoS Attack

```
Attacker floods from 100K IPs:
  Each IP: 100 req/sec (NGINX limit)
  Total: 10M potential req/sec (attacker's flood)

NGINX blocks:
  Each IP limited to 100 req/sec
  Total accepted: 100K IPs × 100 = 10M req/sec
  But we only have 500K req/sec capacity

Result: NGINX absorbs 100K × 100 = 10M, accepts 500K
        Extra load dropped at network LB
        Service remains healthy
```

---

## PERFORMANCE TUNING FOR BILLIONS OF USERS

### Kernel Tuning (on NGINX nodes)

```bash
# Max file descriptors per process
ulimit -n 1048576

# Max socket backlog
sysctl -w net.core.somaxconn=32768

# Max pending connections
sysctl -w net.ipv4.tcp_max_syn_backlog=65536

# TCP keepalive (detect dead connections)
sysctl -w net.ipv4.tcp_keepalives_intvl=30

# TIME_WAIT reuse (allow rapid reconnections)
sysctl -w net.ipv4.tcp_tw_reuse=1
```

### NGINX Buffer Tuning

```
For 500M DAU with avg request 64KB:
  Minimum send buffer: 64KB × 100 concurrent = 6.4MB
  Configured: 128MB (2x margin)

For response buffering:
  Proxy buffer: 128KB × 4 = 512KB per connection
  Configured: 128MB total per pod
```

### Memory Efficiency

```
Per NGINX pod (current config):
  Base: 20 MB
  Connections (100K active): 100KB per conn = 10 GB
  Buffers: 128 MB
  Total: ~10.2 GB per pod

Limited to: 1 GB (resource limit)
Why: K8s will OOM-kill if exceeds

Solution: Scale horizontally
  Instead of 1 pod with 1M connections
  Use 10 pods with 100K connections each
  Total: 10 GB across 10 pods
```

---

## DEPLOYMENT COMMANDS

### Deploy Everything

```bash
# 1. Create namespaces
kubectl create namespace ingress-nginx
kubectl create namespace valueskins

# 2. Deploy NGINX Ingress Controller
kubectl apply -f kubernetes/ingress-controller.yaml

# 3. Wait for NGINX to be ready
kubectl wait --for=condition=ready pod \
  -l app=nginx-ingress -n ingress-nginx \
  --timeout=300s

# 4. Get external IP (from cloud LB)
kubectl get svc -n ingress-nginx nginx-ingress-service
# Output: EXTERNAL-IP = 203.0.113.1 (public IP)

# 5. Deploy ValueSkins Ingress rules
kubectl apply -f kubernetes/valueskins-ingress.yaml

# 6. Deploy frontend static servers
kubectl apply -f kubernetes/frontend-static-serving.yaml

# 7. Deploy API pods (matching, marketplace)
kubectl apply -f kubernetes/deployment.yaml

# 8. Verify health
kubectl get pods -n valueskins
kubectl get svc -n valueskins
kubectl get ingress -n valueskins
```

### Monitor Deployment

```bash
# Watch NGINX logs
kubectl logs -f -n ingress-nginx deployment/nginx-ingress-controller

# Watch API pods
kubectl logs -f -n valueskins deployment/valueskins-matching

# Check metrics (if Prometheus installed)
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Then visit http://localhost:9090
```

### Rollback (if issues)

```bash
# Disable feature flag (instant, no redeploy)
kubectl patch configmap feature-flags -n valueskins \
  -p '{"data":{"valueskins_enabled":"false"}}'

# Or delete ingress (traffic stops in 5 seconds)
kubectl delete ingress valueskins-ingress -n valueskins

# Pods keep running, manual traffic reroute if needed
```

---

## COST BREAKDOWN (500M DAU, 1M req/sec sustained)

```
Cloud Load Balancer:        $2,500/month (AWS NLB)
NGINX Pods (20 x $0.05/hr): $7,200/month
API Pods (60 x $0.05/hr):   $21,600/month
Frontend Pods (20 x $0.05/hr): $7,200/month
PostgreSQL (multi-region):  $50,000+/month
Bandwidth egress:           $20,000/month
Total:                      ~$110K/month

Per DAU: $110K / 500M = $0.00022 per user
```

---

## SUMMARY: DO WE NEED NGINX?

### YES, because:

1. **It's proven at scale**: Alibaba, Netflix, Meta's own infrastructure use NGINX
2. **SSL/TLS termination**: Reduces API server CPU by 20-30%
3. **Rate limiting**: Protects against DDoS and abuse
4. **Static file serving**: Doesn't waste API resources
5. **Caching headers**: Reduces backend load by 60%
6. **WAF protection**: Catches SQL injection, XSS before API
7. **Logging/monitoring**: Structured logs for compliance + debugging
8. **Zero downtime**: Can update ingress without redeploying API

### NO, if:

- You only have 1K DAU (Istio alone is enough)
- You don't care about DDoS protection
- You're OK with SSL overhead on API servers
- You don't care about static asset performance

**For Meta at billions of users? YES, 100% required.**

---

## NEXT STEPS

1. Deploy NGINX Ingress Controller (`ingress-controller.yaml`)
2. Deploy Ingress rules (`valueskins-ingress.yaml`)
3. Deploy frontend servers (`frontend-static-serving.yaml`)
4. Configure DNS to point *.instagram.com → NGINX load balancer IP
5. Run canary traffic (1% → 10% → 100%)
6. Monitor: p99 latency, error rate, CPU, memory
7. Adjust resource limits based on real traffic
