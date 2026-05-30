# Environment Setup Guide for ValueSkins

This guide prevents OAuth configuration errors across local, staging, and production environments.

## Quick Start (5 minutes)

### Step 1: Get Google OAuth Credentials
1. Go to https://console.cloud.google.com/
2. Select your project (or create one)
3. Go to **APIs & Services → Credentials**
4. Click **+ Create Credentials → OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add authorized redirect URIs (see below)
7. Copy **Client ID** and **Client Secret**

### Step 2: Add Redirect URIs (CRITICAL)
In Google Cloud Console, add one or more of these to your OAuth app:

**Local Development:**
```
http://localhost:3000/api/auth/callback/google
```

**Render (or your staging server):**
```
https://your-app-staging.onrender.com/api/auth/callback/google
```

**Production:**
```
https://your-domain.com/api/auth/callback/google
```

### Step 3: Create `.env.local`
In the **root directory** of the project (not `marketplace/`), create `.env.local`:

```bash
# Google OAuth (get from Google Cloud Console)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
NEXTAUTH_SECRET=generate-random-32-char-string
NEXTAUTH_URL=http://localhost:3000

# Supabase (already configured, don't change)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
NEXT_PUBLIC_SUPABASE_URL=your-url
```

### Step 4: Start Dev Server
```bash
cd marketplace
npm install
npm run dev
```

Go to `http://localhost:3000` and login with Google.

---

## Environment Variables by Environment

### Local Development
**File:** `.env.local` (in root directory)
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-local-client-id
GOOGLE_CLIENT_SECRET=your-local-client-secret
NEXTAUTH_SECRET=dev-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

**OAuth Redirect URI in Google Console:**
```
http://localhost:3000/api/auth/callback/google
```

### Render (Staging/Production)
**Setup in Render Dashboard:**
1. Go to your Render project
2. Go to **Environment → Environment Variables**
3. Add:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-render-client-id
GOOGLE_CLIENT_SECRET=your-render-client-secret
NEXTAUTH_SECRET=generate-new-random-string
NEXTAUTH_URL=https://your-app.onrender.com
```

**OAuth Redirect URI in Google Console:**
```
https://your-app.onrender.com/api/auth/callback/google
```

---

## Troubleshooting

### Error: "Missing required parameter: client_id"
**Cause:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` not set in `.env.local`

**Fix:**
1. Check `.env.local` exists in **root directory** (not `marketplace/`)
2. Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
3. Restart dev server: `npm run dev`
4. Clear browser cache: Cmd+Shift+R

### Error: "Redirect URI mismatch"
**Cause:** Redirect URI in code doesn't match Google Console

**Fix:**
1. Get your redirect URI: `http://localhost:3000/api/auth/callback/google`
2. Add it to Google Console → OAuth app → Authorized redirect URIs
3. Wait 5 minutes (Google takes time to sync)
4. Try again

### Error: "Invalid client secret"
**Cause:** Wrong secret or expired credentials

**Fix:**
1. Go to Google Console
2. Regenerate OAuth credentials
3. Update `.env.local`
4. Restart dev server

---

## For Team Members

If you're a new developer on this project:

1. Ask the project lead for Google OAuth credentials
2. Follow "Quick Start" (steps 1-4 above)
3. Don't commit `.env.local` to git (it's in `.gitignore`)
4. If you have questions, check this guide first

---

## For Deployment

### Production Checklist
- [ ] Create separate Google OAuth app for production domain
- [ ] Add `https://your-domain.com/api/auth/callback/google` to Google Console
- [ ] Generate new `NEXTAUTH_SECRET` (use `openssl rand -base64 32`)
- [ ] Set environment variables in your hosting dashboard (Render, Vercel, etc.)
- [ ] Test login on production domain
- [ ] Never commit `.env.local` or secrets to git

### Environment Variable Rotation (Quarterly)
- [ ] Regenerate `NEXTAUTH_SECRET`
- [ ] Rotate Google OAuth credentials
- [ ] Update all environments (local, staging, production)

---

## FAQ

**Q: Can I use the same Google OAuth app for local and production?**
A: Yes, if you add all redirect URIs (localhost + staging + production) to the same app. Recommended for simplicity.

**Q: Where should `.env.local` be located?**
A: In the **root** directory of the project (same level as `marketplace/` and `backend/`), NOT inside `marketplace/`.

**Q: What if I lose my `.env.local`?**
A: Just create a new one with your credentials. It's safe to delete because Google OAuth credentials are stored in Google Cloud Console.

**Q: How do I generate a secure `NEXTAUTH_SECRET`?**
A: Run this in terminal:
```bash
openssl rand -base64 32
```

**Q: Can I use Supabase auth instead of Google?**
A: Yes, but Google OAuth is already configured. To switch, update `src/pages/api/auth/[...nextauth].ts`.

---

**Last Updated:** 2026-05-31  
**Status:** PRODUCTION READY
