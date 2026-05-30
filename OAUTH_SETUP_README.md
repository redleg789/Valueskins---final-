# OAuth Setup - Quick Reference

**Problem:** OAuth errors on localhost or production  
**Solution:** Follow this 5-minute setup

---

## For Local Development

### Step 1: Run Setup Script (Easiest)
From the **root** directory:

```bash
./setup-env.sh
```

This will:
1. Ask for your Google Client ID & Secret
2. Generate a secure `NEXTAUTH_SECRET`
3. Create `.env.local` with all required variables

### Step 2: Get Google Credentials
If you don't have them:

1. Go to https://console.cloud.google.com/
2. Create or select your project
3. Go to **APIs & Services → Credentials**
4. Click **+ Create Credentials → OAuth 2.0 Client ID**
5. Select **Web application**
6. Under "Authorized redirect URIs", add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### Step 3: Start Dev Server
```bash
cd marketplace
npm install
npm run dev
```

Go to `http://localhost:3000` and test login with Google.

---

## For Production (Render / Vercel)

### Step 1: Create OAuth App for Production
Repeat the Google OAuth setup, but use your production URL:

```
https://your-app.onrender.com/api/auth/callback/google
```

You can use the **same** Google OAuth app, just add multiple redirect URIs.

### Step 2: Add Environment Variables to Render
1. Go to your Render dashboard
2. Select your project
3. Go to **Settings → Environment**
4. Add these variables:
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-production-client-id
   GOOGLE_CLIENT_SECRET=your-production-secret
   NEXTAUTH_SECRET=generate-new-random-32-char-string
   NEXTAUTH_URL=https://your-app.onrender.com
   ```

5. Deploy

---

## File Structure

```
Valueskins/
├── .env.local (LOCAL DEV - don't commit)
├── .env.example (REFERENCE - commit this)
├── ENV_SETUP.md (DETAILED GUIDE)
├── OAUTH_SETUP_README.md (THIS FILE)
├── setup-env.sh (AUTOMATED SETUP SCRIPT)
├── marketplace/
│   ├── src/
│   │   ├── lib/validate-env.ts (ENV VALIDATION)
│   │   └── pages/
│   │       ├── _app.tsx (APP ENTRY POINT)
│   │       └── api/auth/[...nextauth].ts (OAUTH HANDLER)
```

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Missing required parameter: client_id" | Run `./setup-env.sh` or manually create `.env.local` |
| "Redirect URI mismatch" | Add your callback URL to Google Console OAuth app |
| ".env.local not found" | Make sure it's in **root** directory, not `marketplace/` |
| Login still not working | Clear browser cache (Cmd+Shift+R), restart dev server |

---

## ✅ Checklist

- [ ] Google OAuth app created
- [ ] Redirect URI added to Google Console
- [ ] `.env.local` created (run `./setup-env.sh`)
- [ ] Dev server restarted (`npm run dev`)
- [ ] Login tested on `http://localhost:3000`
- [ ] Production URLs configured in Render
- [ ] Production tested

---

**Status:** AUTOMATED & PRODUCTION READY  
**Last Updated:** 2026-05-31
