# Render Deployment Guide - ValueSkins Backend

**Status**: Ready to deploy with WebSocket real-time support

## Step 1: Render Dashboard Setup (5 min)

1. Go to https://dashboard.render.com
2. Create new **PostgreSQL** database:
   - Name: `valueskins-db`
   - Plan: **Standard** (minimum $15/mo for production)
   - Region: Singapore (or closest to your users)
   - Copy the `DATABASE_URL` (looks like `postgresql://user:pass@host:port/db`)

3. Create new **Web Service**:
   - Connect your GitHub repo
   - Build Command: `cd backend && cargo build --release -p api_gateway`
   - Start Command: `./target/release/api_gateway`
   - Plan: **Standard** ($12/mo)

## Step 2: Set Environment Variables in Render Dashboard

In the Web Service settings, add these environment variables:

```
DATABASE_URL=postgresql://user:pass@host:port/db    # From Step 1
JWT_SECRET=<generate-random-64-char-string>          # Use: openssl rand -base64 48
RUST_LOG=info
API_KEY_HMAC_SALT=<generate-random-64-char-string>
VERIFICATION_HMAC_SECRET=<generate-random-64-char-string>
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
PLATFORM_SIGNING_KEY_ED25519=<generate-ed25519-key>
SMTP_HOST=<your-smtp-host>                          # Optional: SendGrid, AWS SES, etc
SMTP_USER=<your-smtp-user>
SMTP_PASS=<your-smtp-password>
SMTP_FROM=noreply@your-domain.com
REDIS_URL=redis://localhost:6379                    # Optional: for caching
```

**Generate JWT_SECRET:**
```bash
openssl rand -base64 48
```

**Generate ED25519 key (if not using optional SMTP):**
```bash
openssl genpkey -algorithm ed25519 -outform PEM | base64 | tr -d '\n'
```

## Step 3: Run Database Migrations

Once database is created, run migrations:

```bash
# Connect to Render PostgreSQL
psql postgresql://user:pass@host:port/db

# Run migrations in backend/marketplace_service/migrations/
# (The render.yaml will handle this automatically on deploy)
```

## Step 4: Deploy

1. Push your code to GitHub:
```bash
git push origin main
```

2. Render will auto-deploy based on `render.yaml`
3. Wait for build to complete (5-10 minutes first time, 2-3 min subsequent)
4. Check logs for errors
5. Test health endpoint: `https://your-service.onrender.com/health`

## Step 5: Update Frontend

Once backend is deployed, update frontend to use Render backend:

In `/marketplace/.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=https://your-service.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-service.onrender.com/ws
```

## Expected Output

When deployed successfully:

```
GET /health → { "status": "ready", "service": "Valueskins API", "database": "connected" }
GET /health/ready → { "status": "ready", ... }
WS /ws → WebSocket connection established for real-time sync
```

## Troubleshooting

**"Database connection error"**
- Verify `DATABASE_URL` is set correctly
- Check if PostgreSQL is accessible from Render IP
- Run migrations manually

**"Cargo build failed"**
- Check Rust version (Render uses latest stable)
- Verify all dependencies are in Cargo.toml
- Check backend/Cargo.lock is committed

**"WebSocket connection refused"**
- Verify `/ws` endpoint is registered in main.rs
- Check ALLOWED_ORIGINS includes your frontend URL
- Check firewall/security groups allow WebSocket upgrade

## Estimated Costs

- PostgreSQL Database: $15/mo
- Web Service: $12/mo (Standard)
- **Total: ~$27/mo** for production-grade real-time backend

## Next: Frontend Configuration

Once deployed, see `FRONTEND_BACKEND_INTEGRATION.md` for wiring up the frontend.
