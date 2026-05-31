# ValueSkins - Production Ready

A professional-grade marketplace platform built with Next.js, PostgreSQL, and enterprise security standards.

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Vercel account (for deployment)

### Setup

```bash
# 1. Clone and install
cd marketplace
npm install

# 2. Create environment file
cp .env.example .env.local
# Edit .env.local with your values:
# - DATABASE_URL (from Render)
# - NEXT_PUBLIC_GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET

# 3. Start development server
npm run dev

# Open http://localhost:3000
```

## Architecture

This codebase implements **enterprise-grade architecture** across:

- **Security**: HTTPS, CSP, CORS, rate limiting, input validation
- **Scalability**: Connection pooling, caching, async operations
- **Reliability**: Error boundaries, health checks, graceful degradation
- **Observability**: Structured logging, request tracing, monitoring

See [PRODUCTION_ARCHITECTURE.md](PRODUCTION_ARCHITECTURE.md) for detailed design.

## Key Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 | React-based UI framework |
| Backend | Next.js API Routes | Serverless API |
| Database | PostgreSQL | Primary data store |
| Auth | Google OAuth 2.0 | User authentication |
| Hosting | Vercel | Frontend deployment |
| Database Host | Render | Managed PostgreSQL |

## Project Structure

```
marketplace/
├── src/
│   ├── pages/
│   │   ├── api/              # API endpoints (production)
│   │   ├── account/          # Settings & profile
│   │   ├── marketplace/      # Main marketplace UI
│   │   └── [other routes]    # Other pages
│   ├── components/           # React components
│   ├── lib/                  # Core utilities
│   │   ├── db-pool.ts        # Database connection pooling
│   │   ├── validation.ts     # Input validation (Zod)
│   │   ├── rate-limit.ts     # Rate limiting
│   │   ├── logger.ts         # Structured logging
│   │   ├── cache.ts          # Caching layer
│   │   ├── api-handler.ts    # Unified API handler
│   │   └── [other utils]     # Other utilities
│   ├── config/
│   │   └── constants.ts      # Configuration constants
│   ├── middleware.ts         # Security middleware
│   └── styles/
├── public/                   # Static assets
├── docs/
│   ├── PRODUCTION_ARCHITECTURE.md
│   ├── DATABASE_SETUP.md
│   ├── DEPLOYMENT_CHECKLIST.md
│   └── README_PRODUCTION.md (this file)
└── package.json
```

## Core Features

### Authentication
- Google OAuth 2.0 login
- Session management with HttpOnly cookies
- 30-minute session timeout
- Automatic session refresh

### Security
- Input validation (Zod schemas)
- SQL injection prevention (parameterized queries)
- XSS protection (CSP headers)
- CSRF protection (CORS + SameSite cookies)
- Rate limiting (100 req/min per user)

### Performance
- Database connection pooling
- Response caching (5-15 min TTL)
- Slow query detection (>1000ms)
- Gzip compression

### Compliance
- GDPR/CCPA compliance framework
- Data retention policies (30 day deletion)
- Audit logging
- Privacy policy & terms of service

## Development Guide

### Adding a New API Endpoint

```typescript
// src/pages/api/my-feature/action.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { validateInput, MySchema } from '@/lib/validation';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  
  // 1. Validate input
  const validation = validateInput(MySchema, req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });
  
  // 2. Check auth (if needed)
  const token = req.cookies.valueskins_session;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  // 3. Execute logic
  // ... your code ...
  
  // 4. Return response
  return res.status(200).json({ success: true });
}

export default withApiHandler(handler, {
  allowedMethods: ['POST'],
  rateLimit: { maxRequests: 100, windowMs: 60000 },
});
```

### Adding Input Validation

```typescript
// src/lib/validation.ts
export const MySchema = z.object({
  email: EmailSchema,
  name: z.string().min(1).max(255),
  age: z.number().int().min(0).max(150),
});

// Use in endpoint:
const validation = validateInput(MySchema, req.body);
if (validation.error) return res.status(400).json({ error: validation.error });
const { email, name, age } = validation.data!; // Type-safe!
```

### Querying the Database

```typescript
import { query, queryOne, transaction } from '@/lib/db-pool';

// Single query
const user = await queryOne(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Multiple queries with transaction
await transaction(async (client) => {
  await client.query('UPDATE users SET balance = balance - $1', [amount]);
  await client.query('INSERT INTO audit_logs ...', [userId, 'withdrawal']);
});
```

### Caching Data

```typescript
import { sessionCache, userCache } from '@/lib/cache';

// Check cache first
const cached = userCache.get(`user:${id}`);
if (cached) return cached;

// Load from DB
const user = await queryOne('SELECT * FROM users WHERE id = $1', [id]);

// Cache for 10 minutes
userCache.set(`user:${id}`, user, 10 * 60 * 1000);
return user;
```

### Logging

```typescript
import { logger } from '@/lib/logger';

logger.debug('Starting payment', { userId, amount });
logger.info('Payment completed', { userId, amount, transactionId });
logger.warn('Slow database query', { query: '...', duration: 2000 });
logger.error('Payment failed', error, { userId, amount, code: 'DECLINED' });
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run load-test
```

## Deployment

### To Production

```bash
# 1. Verify checklist
# See DEPLOYMENT_CHECKLIST.md

# 2. Push to main branch
git push origin main

# 3. Vercel deploys automatically

# 4. Monitor health check
curl https://valueskins-final.vercel.app/api/health
```

### Environment Variables

Required on Vercel:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console

See `.env.production.example` for all variables.

## Monitoring

### Health Check

```bash
curl https://valueskins-final.vercel.app/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-31T10:30:00Z",
  "checks": {
    "database": "healthy",
    "api": "healthy"
  },
  "uptime": 3600000
}
```

### Logs

View real-time logs:
```bash
# Vercel logs
vercel logs

# Or on Vercel dashboard > Deployments > Logs
```

### Metrics

Monitor on Vercel dashboard:
- Request count
- Response time (avg, p50, p95)
- Error rate
- CPU & memory usage

## Troubleshooting

### Database Connection Failed

```
Error: ECONNREFUSED localhost:5432
```

**Solution**: Check DATABASE_URL is correct
```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Slow Response Times

**Check**:
1. Database queries - View slow query logs
2. External APIs - Check API response times
3. Rate limiting - Verify not hitting limits

**Fix**:
- Add indexes: `CREATE INDEX idx_deals_user_id ON deals(user_id)`
- Cache data: `sessionCache.set(key, data, ttl)`
- Batch queries: Use JOINs instead of N+1

### High Error Rate

**Check**:
1. Error logs - `logger.error` entries
2. Database - Connection pool exhaustion
3. Rate limiting - Too many requests

**Fix**:
- Review error logs for root cause
- Increase connection pool size
- Reduce rate limit if too strict

## Performance Optimization

### Database
- Use indexes on frequently queried columns
- Batch related queries with JOINs
- Set proper pagination limits

### Caching
- Cache session data (5 min TTL)
- Cache user profiles (10 min TTL)
- Cache deal data (15 min TTL)

### API Response
- Minimize response size (<10KB)
- Use pagination (default 20, max 100)
- Enable gzip compression

### Frontend
- Lazy load images
- Code split large bundles
- Cache static assets (1 year)

## Security Best Practices

1. **Never** log passwords or tokens
2. **Always** validate user input with Zod
3. **Always** use parameterized SQL queries
4. **Always** check authentication/authorization
5. **Always** set rate limits
6. **Always** return generic error messages
7. **Never** expose database schema in errors
8. **Always** use HTTPS in production
9. **Always** encrypt sensitive data at rest
10. **Always** review security logs

## Compliance

- ✅ GDPR-compliant data handling
- ✅ CCPA right to deletion
- ✅ 30-day data retention policy
- ✅ Audit logging for all changes
- ✅ Privacy policy linked from footer
- ✅ Cookie consent banner

See [CLAUDE.md](../CLAUDE.md) for complete security standards.

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Test locally: `npm run dev`
4. Commit with descriptive message
5. Push and create pull request
6. Wait for code review
7. Merge to main

## Support

### Documentation
- [PRODUCTION_ARCHITECTURE.md](PRODUCTION_ARCHITECTURE.md) - System design
- [DATABASE_SETUP.md](DATABASE_SETUP.md) - Database guide
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Deployment guide
- [CLAUDE.md](../CLAUDE.md) - Security standards

### Team
- **Engineering**: On-call rotation
- **Support**: support@valueskins.com

## License

Proprietary - ValueSkins Inc.

---

**Status**: Production Ready ✅  
**Last Updated**: 2026-05-31  
**Version**: 1.0.0  
