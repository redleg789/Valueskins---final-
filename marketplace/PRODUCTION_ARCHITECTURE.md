# Production Architecture

This document outlines the production-grade infrastructure that makes ValueSkins scalable, secure, and maintainable.

## Core Principles

1. **Zero Trust Security**: Every request is validated, authenticated, and authorized
2. **Observability**: All operations are logged and traceable
3. **Resilience**: Failures are gracefully handled with proper fallbacks
4. **Performance**: Caching, pooling, and optimization are built-in
5. **Compliance**: GDPR/CCPA/legal requirements are enforced by design

## Architecture Overview

```
Request → Middleware (Security Headers) → Rate Limiter → API Handler → Validation
    ↓                                                           ↓
    └────────────────── Error Boundary ← Logger ← DB Pool ← Cache ← Response
```

## Key Components

### 1. Database Layer (`src/lib/db-pool.ts`)

- **Connection Pooling**: Max 20 concurrent connections, idle timeout 30s
- **Query Performance**: Logs slow queries (>1000ms)
- **Transaction Support**: Automatic rollback on errors
- **Error Handling**: Comprehensive error logging

**Usage**:
```typescript
import { query, queryOne, transaction } from '@/lib/db-pool';

const user = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);

await transaction(async (client) => {
  await client.query('UPDATE accounts SET balance = ...');
  await client.query('INSERT INTO audit_logs ...');
});
```

### 2. Validation Layer (`src/lib/validation.ts`)

- **Zod Schemas**: Type-safe input validation
- **Error Messages**: Clear validation feedback
- **Type Safety**: TypeScript integration

**Usage**:
```typescript
import { validateInput, CreateAccountSchema } from '@/lib/validation';

const validation = validateInput(CreateAccountSchema, req.body);
if (validation.error) {
  return res.status(400).json({ error: validation.error });
}
const { email, password } = validation.data!;
```

### 3. Rate Limiting (`src/lib/rate-limit.ts`)

- **Per-IP Limits**: Prevents abuse from single source
- **Per-User Limits**: Prevents authenticated abuse
- **Window-Based**: Configurable time windows
- **Memory Efficient**: Automatic cleanup of old entries

**Default Limits**:
- General API: 100 req/min per user
- Authentication: 5 attempts per 15 min
- File Upload: 10 per hour
- Data Export: 5 per day

### 4. Logging (`src/lib/logger.ts`)

- **Structured JSON**: Logs are queryable and machine-readable
- **Log Levels**: debug, info, warn, error
- **Context**: All logs include timestamps and context

**Usage**:
```typescript
logger.info('User created', { userId, email, timestamp: Date.now() });
logger.warn('Suspicious activity', { ip, attempts: 5 });
logger.error('Database error', error, { operation: 'CREATE_USER' });
```

### 5. Request Context (`src/lib/request-context.ts`)

- **Request IDs**: Unique UUID per request for tracing
- **Tracing**: Track requests across services
- **Performance**: Measure request duration
- **Cleanup**: Automatic cleanup of old contexts

**Usage**:
```typescript
const ctx = createRequestContext(path, method, ip, userId);
// ... handle request ...
logRequestEnd(ctx.requestId, statusCode, duration);
```

### 6. Caching (`src/lib/cache.ts`)

- **Session Cache**: User sessions (5 min TTL)
- **User Cache**: User data (10 min TTL)
- **Deal Cache**: Deal data (15 min TTL)
- **Automatic Expiry**: Old entries cleaned up every 10 minutes

**Usage**:
```typescript
const cached = sessionCache.get(`session:${token}`);
if (cached) return cached;

const data = await query('SELECT ...');
sessionCache.set(`session:${token}`, data, 5 * 60 * 1000);
```

### 7. API Handler Wrapper (`src/lib/api-handler.ts`)

- **Unified Pattern**: All endpoints use same handler
- **Built-in Security**: Headers, rate limiting, error handling
- **Request Context**: Automatic request tracking
- **Type Safety**: Generic response types

**Usage**:
```typescript
async function handler(req: NextApiRequest, res: NextApiResponse<MyResponse>) {
  // ... handler logic ...
}

export default withApiHandler(handler, {
  allowedMethods: ['GET', 'POST'],
  rateLimit: { maxRequests: 100, windowMs: 60000 },
});
```

### 8. CORS Configuration (`src/lib/cors.ts`)

- **Origin Whitelist**: Only allowed origins can access
- **Methods**: GET, POST, PUT, DELETE, PATCH allowed
- **Credentials**: HttpOnly cookies supported
- **Preflight**: Automatic OPTIONS handling

**Allowed Origins**:
- `http://localhost:3000` (dev)
- `http://localhost:3001` (dev)
- `https://valueskins-final.vercel.app` (prod)

### 9. Environment Validation (`src/lib/env.ts`)

- **Startup Checks**: Required env vars validated on app start
- **Type Safety**: Environment object is fully typed
- **Error Messages**: Clear feedback if vars are missing

**Required Variables**:
- DATABASE_URL
- NEXT_PUBLIC_GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET

### 10. Database Migrations (`src/lib/migrations.ts`)

- **Automatic Setup**: Tables created if missing
- **Idempotent**: Safe to run multiple times
- **Error Handling**: Detailed error messages

**Tables**:
- `users`: User accounts
- `auth_sessions`: Active sessions
- `data_requests`: GDPR/CCPA requests
- `accounts`: User profile data

### 11. Security Middleware (`src/middleware.ts`)

- **CSP**: Content Security Policy prevents XSS
- **HSTS**: Enforces HTTPS
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing

### 12. Error Boundaries (`src/components/ErrorBoundary.tsx`)

- **React Errors**: Caught at component level
- **Graceful Fallback**: Shows error UI instead of crashing
- **Logging**: Errors are logged with full context
- **Recovery**: User can retry without page reload

### 13. Configuration (`src/config/constants.ts`)

- **Session**: Timeouts, cookie settings
- **Rate Limits**: All rate limit thresholds
- **Validation**: Min/max lengths
- **Cache TTLs**: Expiry times
- **Pagination**: Default and max sizes

## API Endpoint Pattern

All endpoints should follow this pattern:

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { queryOne } from '@/lib/db-pool';
import { validateInput, MySchema } from '@/lib/validation';

interface MyResponse {
  data?: any;
  error?: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse<MyResponse>) {
  if (setupCors(req, res)) return;

  // 1. Check method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Validate input
  const validation = validateInput(MySchema, req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  // 3. Check auth
  const sessionToken = req.cookies.valueskins_session;
  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 4. Execute business logic
  const result = await queryOne('SELECT * FROM table WHERE id = $1', [id]);
  if (!result) {
    return res.status(404).json({ error: 'Not found' });
  }

  // 5. Return response
  return res.status(200).json({ data: result });
}

export default withApiHandler(handler, {
  allowedMethods: ['GET'],
  rateLimit: { maxRequests: 100, windowMs: 60000 },
});
```

## Performance Optimization Checklist

- [ ] Database queries use indexes (check EXPLAIN ANALYZE)
- [ ] N+1 queries are prevented (batch loads)
- [ ] Response sizes are minimized (<10KB)
- [ ] Caching is used for frequently accessed data
- [ ] Rate limiting prevents abuse
- [ ] Pagination is enforced (max 100 items per page)
- [ ] Images are compressed and cached
- [ ] Gzip compression is enabled

## Security Checklist

- [ ] All inputs are validated with Zod schemas
- [ ] All queries use parameterized statements
- [ ] Sessions have timeout (30 minutes)
- [ ] Passwords are bcrypt hashed
- [ ] Rate limiting is enforced
- [ ] CORS only allows trusted origins
- [ ] Security headers are set
- [ ] Error messages don't leak internals
- [ ] Sensitive data is not logged
- [ ] Database has RLS policies

## Scaling Strategy

### Phase 1: Single Server (current)
- Database on Render
- Frontend on Vercel
- In-memory caching

### Phase 2: Multiple Servers
- Database connection pooling (done)
- Redis for distributed caching
- Load balancer
- Separate API servers

### Phase 3: Microservices
- Auth service
- Payment service
- Messaging service
- Search service
- Analytics service

### Phase 4: Global Scale
- Multi-region databases
- CDN for static assets
- Read replicas
- Write replicas with eventual consistency

## Monitoring & Alerting

Currently implemented:
- [x] Request logging (all endpoints)
- [x] Health check endpoint (/api/health)
- [x] Error tracking (logger.error)
- [ ] Metrics (latency, error rate, throughput)
- [ ] Alerting (Slack, email)
- [ ] Dashboards (Grafana, DataDog)

## Deployment Checklist

Before deploying to production:

1. [ ] Environment variables are set on Vercel
2. [ ] Database migrations have run
3. [ ] All tests pass
4. [ ] Code review approved
5. [ ] Performance testing completed
6. [ ] Security audit passed
7. [ ] Logging is configured
8. [ ] Backup strategy is in place
9. [ ] Disaster recovery plan exists
10. [ ] Team is trained on operations

## Resources

- [CLAUDE.md](../../CLAUDE.md) - Security & compliance standards
- [src/lib/](src/lib) - Core utilities
- [src/config/](src/config) - Configuration
- [src/pages/api/](src/pages/api) - API endpoints
