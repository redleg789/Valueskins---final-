# Incident Runbooks for 100K Scale

## Runbook 1: High Error Rate (> 1%)

### Detection
- PagerDuty alert: HTTP error rate > 1%
- Dashboard: API Errors tab showing 5xx spike
- Alert fires when: 10+ errors in 1 minute

### Immediate Actions (0-5 min)
1. **Declare incident** → Slack #incidents
2. **Check status page** → Is it degraded?
3. **Run: `kubectl get pods -n valueskins`** → Any pods not Ready?
4. **Check logs:**
   ```bash
   kubectl logs -f -n valueskins -l app=backend --tail=100
   ```
5. **Check error patterns:**
   ```
   - 500? → Backend crash
   - 503? → Rate limit or connection pool
   - 502? → Load balancer → backend timeout
   - Timeout? → Database slow
   ```

### Investigation (5-15 min)

#### If 500s increasing:
```bash
# Check backend pod logs for panic/crash
kubectl logs -f deployment/api-gateway -n valueskins --tail=200

# Check restart count
kubectl get pods -n valueskins -l app=backend -o wide
# If restarts > 1, pod is crashing

# Check resource limits
kubectl top pods -n valueskins -l app=backend
# If CPU/memory near limits, scale up
```

#### If 503s increasing:
```bash
# Check connection pool
kubectl exec -it postgres-0 -n valueskins -- psql -c "SELECT count(*) FROM pg_stat_activity;"
# If > 400, we're at limit

# Check Redis
kubectl exec -it redis-0 -n valueskins -- redis-cli info stats | grep connected_clients

# Check rate limiter in Redis
kubectl exec -it redis-0 -n valueskins -- redis-cli KEYS "ratelimit:*" | wc -l
```

#### If 502s increasing:
```bash
# Check load balancer logs
AWS Console → Load Balancers → Target Health
# Are targets "Healthy"? If not, why?

# Check backend latency
kubectl logs -f deployment/api-gateway -n valueskins | grep duration
```

### Recovery Actions

**If 500 (pod crash):**
```bash
# Option 1: Restart pod
kubectl rollout restart deployment/api-gateway -n valueskins

# Option 2: Check for bad deployment
kubectl describe deployment api-gateway -n valueskins
# Look for ImagePullBackOff or similar

# Option 3: Rollback if recent deploy
kubectl rollout history deployment/api-gateway -n valueskins
kubectl rollout undo deployment/api-gateway -n valueskins
```

**If 503 (resource exhausted):**
```bash
# Scale up pods
kubectl scale deployment api-gateway --replicas=20 -n valueskins

# Scale up database connections
kubectl patch statefulset pgbouncer -n valueskins -p '{"spec":{"template":{"spec":{"containers":[{"name":"pgbouncer","env":[{"name":"MAX_CLIENT_CONN","value":"500"}]}]}}}}'

# Check if specific endpoint is slow
# Use: Prometheus query "rate(http_requests_total{status=~'5..'}[1m])"
```

**If 502 (timeout):**
```bash
# Increase backend timeout
kubectl set env deployment/api-gateway REQUEST_TIMEOUT=30s -n valueskins

# Check database replication lag
# AWS RDS Console → Databases → Replication lag
# If > 10s, promote replica or restart replication

# Bounce backend pods
kubectl rollout restart deployment/api-gateway -n valueskins
```

### Communication (During Incident)
- **5 min:** Post to #incidents: "High error rate detected, investigating"
- **15 min:** Post update: "Root cause identified: [X]. Remediation in progress"
- **30 min:** Resolved or escalation to manager

### Post-Incident (After Resolved)
1. Check if issue is systemic or one-off
2. If systemic: create ticket to fix root cause
3. If one-off: document why it happened
4. Update runbook based on learnings

---

## Runbook 2: High Latency (p95 > 500ms)

### Detection
- Alert: p95 latency > 500ms for 5 minutes
- Dashboard: API Performance tab showing spike
- User reports slow responses

### Immediate Actions (0-5 min)

```bash
# 1. Check database query times
kubectl exec -it postgres-0 -n valueskins -- psql -c "
  SELECT query, calls, mean_exec_time 
  FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC LIMIT 10;"

# 2. Check cache hit rate
kubectl exec -it redis-0 -n valueskins -- redis-cli INFO stats | grep hits

# 3. Check slow endpoints (Prometheus)
# Query: histogram_quantile(0.95, http_request_duration_seconds)
# Which endpoint has highest latency?

# 4. Check if specific shard is slow
# Look at logs: "shard_X latency: XXXms"

# 5. Check network latency between pods
# kubectl get nodes, check if they're in same AZ
kubectl get nodes -o wide
```

### Investigation

**If database slow:**
```bash
# Check if full table scan
# Query with EXPLAIN ANALYZE in slow log

# Check if missing index
# Run: SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;

# Check replication lag
# AWS RDS: Replication lag should be < 100ms

# Check connection pool
# PgBouncer stats: kubectl logs pgbouncer-0
```

**If cache miss rate high (< 80%):**
```bash
# Check cache evictions
kubectl exec -it redis-0 -n valueskins -- redis-cli INFO stats | grep evicted_keys

# Check cache size
kubectl exec -it redis-0 -n valueskins -- redis-cli INFO memory

# If near max, scale up Redis
kubectl patch statefulset redis -n valueskins -p '{"spec":{"template":{"spec":{"resources":{"requests":{"memory":"100Gi"}}}}}}'
```

**If network latency high:**
```bash
# Check pod placement (are they on same node?)
kubectl get pods -n valueskins -o wide | grep api-gateway

# Check node latency
# AWS Console: EC2 → Instances → Network → Latency

# If cross-AZ latency > 10ms, move pods to same AZ
```

### Recovery Actions

```bash
# Option 1: Add database index
# Identify slow query, create index
kubectl exec -it postgres-0 -- psql -c "CREATE INDEX idx_user_id ON users(user_id);"

# Option 2: Increase cache size
kubectl patch configmap redis-config -n valueskins -p '{"data":{"maxmemory":"100gb"}}'

# Option 3: Scale read replicas
# Add more replicas in us-west-2, eu-west-1
# AWS RDS: Create read replica (5 minutes)

# Option 4: Shard a table
# If single shard is bottleneck, split to 2 shards
# Requires data migration
```

### Communication
- **5 min:** "Latency elevated (p95 500ms), diagnosing"
- **15 min:** "Root cause: [slow query/missing index/cache miss]. Fixing"
- **30 min:** "Latency back to normal. Will add monitoring to prevent"

---

## Runbook 3: Database Replication Lag > 10s

### Detection
- Alert: `replication_lag_seconds > 10`
- Symptom: Users see stale data, eventual consistency issues

### Immediate Actions

```bash
# 1. Check replica status
# AWS RDS Console → Databases → check Replication lag

# 2. Check replica performance
# Are writes on primary > replica can catch up?
# Primary write throughput: Prometheus query
# Replica read throughput: same

# 3. Check network between regions
# If US-East → US-West, latency should be < 30ms
```

### Recovery

```bash
# Option 1: Slow down writes (if temporary spike)
# Rate limiter will kick in automatically

# Option 2: Restart replication
# AWS RDS: Stop and start replica (causes brief lag)

# Option 3: Promote replica
# If replica is too far behind (> 1 minute)
# Make it primary, wait for lag to clear

# Option 4: Scale replica
# Upgrade replica instance size (db.r6g.4xlarge → db.r6g.8xlarge)
```

### Prevention
- Monitor write throughput
- Alert if primary writes > 8000/sec (approaching shard limit)
- Plan sharding expansion before hitting limit

---

## Runbook 4: Redis Connection Error

### Detection
- Alert: redis_connection_errors > 5 per minute
- Symptom: Cache misses, session losses, real-time features fail

### Immediate Actions

```bash
# 1. Check Redis pod status
kubectl get pods -n valueskins -l app=redis

# 2. Check if pod is running
kubectl describe pod redis-0 -n valueskins

# 3. Check Redis connectivity
kubectl exec -it redis-0 -n valueskins -- redis-cli ping
# Should return: PONG

# 4. Check memory
kubectl exec -it redis-0 -n valueskins -- redis-cli INFO memory
# If used > max, Redis rejects connections
```

### Recovery

```bash
# Option 1: Restart Redis
kubectl rollout restart statefulset/redis -n valueskins
# (Causes 30-60s of cache loss, but recovers)

# Option 2: Increase max memory
kubectl exec -it redis-0 -n valueskins -- redis-cli CONFIG SET maxmemory 100gb

# Option 3: Scale Redis cluster
# Add more Redis nodes for distributed cache
kubectl scale statefulset redis --replicas=5 -n valueskins
```

### Communication
- Most users won't notice (graceful degradation via circuit breaker)
- Alert team: "Redis connection errors, investigating"
- Check if slowdown noticed → restart if necessary

---

## Runbook 5: Kafka Consumer Lag > 10K Messages

### Detection
- Alert: `kafka_consumer_lag_messages > 10000`
- Symptom: Chat messages delayed, notifications slow

### Immediate Actions

```bash
# 1. Check consumer status
# Kafka Dashboard → Consumer Groups → check lag

# 2. Check if consumer is running
kubectl get pods -n valueskins -l app=message-consumer

# 3. Check Kafka broker health
# Kafka Dashboard → Brokers → all should be "In Sync"

# 4. Check what's behind
# If 10K messages behind, at current rate will catch up in:
# lag / messages_per_second = minutes

# If rate is 100 msg/sec, 10K / 100 = 100 seconds recovery
```

### Recovery

```bash
# Option 1: Scale consumer
kubectl scale deployment message-consumer --replicas=5 -n valueskins
# More replicas = faster processing

# Option 2: Restart consumer
# Forces re-fetch of offset, may catch up faster
kubectl rollout restart deployment/message-consumer -n valueskins

# Option 3: Skip old messages (only if acceptable)
# Kafka: reset offset to latest
# (Loses messages, only do if necessary)
```

### Communication
- Monitor: "Chat message delay detected"
- Check: Is user-facing delay > 5 seconds?
- If yes: page on-call
- If no: let it catch up naturally (5-10 minutes usually)

---

## Runbook 6: WebSocket Connection Drops > 5%

### Detection
- Alert: `websocket_connection_loss_rate > 0.05`
- Symptom: Users see "disconnected" message, must refresh

### Immediate Actions

```bash
# 1. Check WebSocket pod health
kubectl get pods -n valueskins -l app=websocket

# 2. Check if pods are crashing
kubectl describe pod websocket-0 -n valueskins

# 3. Check network
# Are pods being evicted? Restarting?
kubectl get events -n valueskins --sort-by=.metadata.creationTimestamp | tail -20

# 4. Check memory per pod
kubectl top pods -n valueskins -l app=websocket
```

### Recovery

```bash
# Option 1: Restart WebSocket pods
kubectl rollout restart deployment/websocket -n valueskins

# Option 2: Check for OOM (Out of Memory)
# If kubectl describe shows "OOMKilled"
# Increase memory request
kubectl set resources deployment/websocket --requests=memory=4Gi -n valueskins

# Option 3: Check for bugs in recent deploy
# If deployed in last hour, rollback
kubectl rollout undo deployment/websocket -n valueskins

# Option 4: Add circuit breaker logging
# Find: why are connections dropping?
# Check logs: kubectl logs -f deployment/websocket
```

### Communication
- Users will notice immediately (no chat/presence)
- Slack #incidents: "WebSocket connectivity issue, restarting service"
- Expect 1-2 minute recovery (pods restart ~30s + reconnection 30s)

---

## Emergency Procedures

### Database Corruption Detected

```bash
# 1. STOP all writes
# Kill all backend pods (users get 503)
kubectl scale deployment api-gateway --replicas=0 -n valueskins

# 2. Take backup
# AWS RDS → Create snapshot (takes 5-10 min)

# 3. Run REINDEX
# PostgreSQL: REINDEX DATABASE valueskins;

# 4. Verify data
# Run consistency checks

# 5. Restore writes
kubectl scale deployment api-gateway --replicas=10 -n valueskins
```

### Active DDoS Attack

```bash
# 1. Enable WAF
# Cloudflare → DDoS Protection → Aggressive

# 2. Rate limit globally
# Cloudflare → Rate Limiting → 10 requests/minute per IP

# 3. Block suspicious countries (if applicable)
# Cloudflare → Geo-blocking

# 4. Scale to handle load
kubectl autoscale deployment api-gateway --min=50 --max=200 -n valueskins

# 5. Monitor
# If attack sustained > 1 hour, escalate to Cloudflare support
```

### Complete Regional Failure

```bash
# 1. Failover to secondary region
# AWS: Update DNS to point to us-west-2 cluster

# 2. Promote read replica to primary
# AWS RDS → Promote read replica (1-5 minutes, causes brief downtime)

# 3. Re-sync WebSocket connections
# All users will disconnect and reconnect to us-west-2

# 4. Verify data integrity
# Check if replication lag caused data loss

# 5. Resume writes to new primary
```

### All Redis Down

```bash
# Circuit breaker should auto-activate
# Queries will be slower but still work

# If circuit breaker failing:
# 1. Check backend logs
# 2. Restart backend pods
kubectl rollout restart deployment/api-gateway -n valueskins

# 3. Restore Redis
# If full cluster lost, restore from backup (can take hours)
# In meantime, operate degraded (no cache, slower)
```

---

## Post-Incident Template

After any incident, fill this out:

```markdown
## Incident Summary
- **Start Time:** 
- **End Time:** 
- **Duration:** 
- **Impact:** (users affected, features down, data loss)

## Root Cause
- 

## Timeline
- HH:MM: Alert fired
- HH:MM: Root cause identified
- HH:MM: Remediation started
- HH:MM: Service recovered

## What We Learned
- 

## Action Items (to prevent recurrence)
1. 
2. 
3. 

## Owner
- 
```

