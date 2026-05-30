# PostgreSQL is managed via AWS RDS - these are the connection configs
# For local dev, we use the docker-compose postgres

# RDS Connection Configuration for Kubernetes
# The actual RDS instance is provisioned via Terraform (infrastructure/terraform/)
# This file documents the expected configuration

# Connection settings (injected via Secret)
# DATABASE_URL=postgres://user:password@valueskins.<id>.<region>.rds.amazonaws.com:5432/valueskins

# RDS Specifications for 100K concurrent users:
# - Instance: db.r6g.2xlarge (multi-AZ)
# - Storage: 500GB gp3 (3000 IOPS)
# - Connections: 500 max (via PgBouncer: 50 x 10 pods = 500)

# Read Replica (for read-heavy workloads)
# - Instance: db.r6g.xlarge
# - Same region, different AZ
# - Streaming replication lag < 1 second

# Backup & Recovery
# - Automated daily backups (retention: 30 days)
# - Point-in-time recovery enabled
# - Cross-region backup: 7 days