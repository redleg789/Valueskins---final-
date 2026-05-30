# Stress Test Dashboard
# Real-time visualization and tracking

This is a real-time dashboard that shows:

1. **Active Users** - How many users currently connected
2. **Request Rate** - Requests per second
3. **Latency** - p50, p95, p99 response times
4. **Error Rate** - Percentage of failed requests
5. **Breaking Point** - When the system starts failing

## How to Run

### 1. Start the Backend (required)
```bash
# Using docker-compose from scalability folder
docker-compose -f scalability/docker-compose.yml up -d

# Or start the full stack
docker-compose up -d
```

### 2. Run the Stress Test
```bash
# Install k6 if not already
brew install k6

# Run stress test (recommended phases)
k6 run scalability/load-tests/stress-test.js \
  --out csv=results.csv \
  --Summary-export=summary.json
```

### 3. InfluxDB + Grafana (recommended for real-time)
```bash
# Start InfluxDB
docker run -d \
  --name influxdb \
  -p 8086:8086 \
  -e INFLUXDB_DB=k6 \
  influxdb:latest

# Start Grafana
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  grafana/grafana:latest
```

### 4. Run with InfluxDB output
```bash
k6 run scalability/load-tests/stress-test.js \
  --out influxdb=http://localhost:8086/k6 \
  -v BASE_URL=http://localhost:8080
```

## Phases

### Phase 1: Baseline (1K users)
- Target: 1,000 concurrent users
- Duration: 30 seconds ramp, 10 minutes hold
- Purpose: Establish baseline performance
- Expected: <100ms latency, <1% errors

### Phase 2: Ramp (10K users)
- Target: 10,000 concurrent users  
- Duration: 3 minutes ramp, 10 minutes hold
- Purpose: Find scaling issues
- Expected: <500ms latency, <2% errors

### Phase 3: Stress (50K users)
- Target: 50,000 concurrent users
- Duration: 2 minutes ramp, 5 minutes hold
- Purpose: Find breaking point
- Expected: <1s latency, <5% errors

### Phase 4: Spike (30K users)
- Target: 30,000 users sudden spike
- Duration: 1 minute spike, 2 minutes hold
- Purpose: Test auto-scaling
- Expected: Auto-scale kicks in, <2s latency

### Phase 5: Soak (10K for 1 hour)
- Target: 10,000 continuous users
- Duration: 1 hour
- Purpose: Find memory leaks
- Expected: Stable memory, no leaks

## Breaking Point Indicators

Watch for these signs the system is failing:

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Latency p95 | <500ms | 500ms-2s | >2s |
| Error Rate | <1% | 1-5% | >5% |
| CPU | <70% | 70-90% | >90% |
| Memory | <80% | 80-90% | >90% |
| DB Connections | <50% | 50-80% | >80% |

## Interpretation

### If p95 latency starts climbing at 10K users:
- Database is bottleneck
- Check: connection pool, slow queries
- Fix: Add read replicas, optimize queries

### If error rate jumps:
- System is overloaded
- Check: logs, which endpoint fails first
- Fix: Add caching, scale pods

### If CPU maxes out:
- Compute is bottleneck
- Check: increase HPA limits
- Fix: More pods, bigger instances

### If memory keeps growing:
- Memory leak
- Check: heap snapshots
- Fix: Fix leak in code

## Results Format

After running, you'll get:

```
=== STRESS TEST COMPLETE ===
Total Requests: 1,234,567
Total Errors: 12,345
Error Rate: 1.00%
p95 Latency: 523ms

Breaking Point Found: ~75,000 users
Max Throughput: 8,500 RPS
```

## Next Steps

1. Find breaking point
2. Note the number
3. Scale infrastructure to handle 2x
4. Re-test
5. Repeat until satisfied