# Database Setup Guide

## Quick Start

### Prerequisites

- PostgreSQL 14+ database (we use Render.com)
- DATABASE_URL environment variable configured

### Automatic Setup

The database tables are created automatically on first API request. The system will:

1. Connect to PostgreSQL using DATABASE_URL
2. Create missing tables with proper schema
3. Create indexes for performance
4. Enable Row-Level Security (RLS) policies

### Manual Setup (if needed)

If automatic setup doesn't work, run migrations manually:

```bash
npm run migrate
```

## Database Schema

### users
User accounts and authentication

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  display_name VARCHAR(255),
  avatar_url TEXT,
  google_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN,
  deleted_at TIMESTAMPTZ
);
```

**Indexes**:
- `email` (fast lookups by email)
- `google_id` (OAuth integration)

### auth_sessions
Session management

```sql
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ
);
```

**Indexes**:
- `user_id` (find all sessions for user)
- `is_active` (find active sessions)

**Cleanup**: Expired sessions are deleted automatically

### accounts
User profile information

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id),
  bio TEXT,
  website VARCHAR(255),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### data_requests
GDPR/CCPA compliance requests

```sql
CREATE TABLE data_requests (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  request_type VARCHAR(50),
  token TEXT UNIQUE,
  status VARCHAR(50),
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
```

**Types**: access, export, delete
**Cleanup**: Expired requests are cleaned up after 24 hours

## Connection Management

### Connection Pooling

- **Max connections**: 20
- **Idle timeout**: 30 seconds
- **Connection timeout**: 5 seconds

Configure in `src/lib/db-pool.ts`:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

### Query Optimization

For slow queries (>1000ms), warnings are logged automatically:

```json
{
  "timestamp": "2026-05-31T10:30:00Z",
  "level": "warn",
  "message": "Slow query detected: 1245ms",
  "query": "SELECT * FROM deals WHERE..."
}
```

**Tips**:
- Use indexes for WHERE clauses
- Use EXPLAIN ANALYZE to optimize
- Limit result sets with LIMIT/OFFSET
- Use JOINs instead of N+1 queries

## Security & Compliance

### Row-Level Security (RLS)

Users can only see their own data:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON users
  FOR SELECT
  USING (auth.uid() = id);
```

### Audit Logging

Every data change is logged:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  table_name VARCHAR(255),
  operation VARCHAR(10),
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMPTZ,
  ip_address INET
);
```

### Data Retention

- User data: Deleted 30 days after account deletion
- Session data: Deleted after 7 days of inactivity
- Audit logs: Kept for 1 year
- Backups: Kept for 90 days

## Backup & Recovery

### Automated Backups (Render)

- Daily backups at 00:00 UTC
- Retained for 90 days
- Stored in same region

### Manual Backup

```bash
pg_dump postgresql://user:pass@host/db > backup.sql
```

### Restore from Backup

```bash
psql postgresql://user:pass@host/db < backup.sql
```

## Monitoring

### Health Check

```bash
curl https://yourdomain.com/api/health
```

Response:
```json
{
  "status": "ok",
  "checks": {
    "database": "healthy",
    "api": "healthy"
  },
  "uptime": 3600000
}
```

### Slow Queries

Monitor logs for:
```
"Slow query detected: {duration}ms"
```

### Connection Pool Status

Check pool stats in logs:
```
Pool size: 20, Idle: 5, Waiting: 0
```

## Troubleshooting

### Connection Failed

```
Error: connect ECONNREFUSED
```

**Solution**: Check DATABASE_URL is correct and database is running

```bash
echo $DATABASE_URL
psql $DATABASE_URL -c "SELECT 1"
```

### Table Not Found

```
relation "users" does not exist
```

**Solution**: Run migrations

```bash
npm run migrate
```

### Slow Queries

```
Slow query detected: 5000ms
```

**Solution**: Add indexes or optimize query

```sql
EXPLAIN ANALYZE SELECT * FROM deals WHERE user_id = '...';
-- Look for Seq Scan and add index
CREATE INDEX idx_deals_user_id ON deals(user_id);
```

### Connection Pool Exhausted

```
waiting for available client
```

**Solution**: Check for:
- Long-running queries
- Unclosed connections
- Query N+1 problems

## Development Workflow

1. Create feature branch
2. Make database schema changes in `src/lib/migrations.ts`
3. Test locally (migrations run on first API request)
4. Commit and push
5. On production, verify tables exist with `npm run migrate`

## Testing

To test database operations:

```typescript
import { queryOne, transaction } from '@/lib/db-pool';

// Test single query
const user = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
expect(user).toBeDefined();

// Test transaction
await transaction(async (client) => {
  await client.query('UPDATE users SET name = $1', [name]);
  await client.query('INSERT INTO audit_logs ...');
});
```

## Environment Variables

Required:
```
DATABASE_URL=postgresql://user:password@host:port/database
```

Optional:
```
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000
```
