# Deploying MyWeb AI to the public

Three pieces: **database** (already hosted on Neon), **backend** (FastAPI), **frontend**
(static Vite build). Plus the Chrome extension. Total time: ~30 minutes.

## 0. One-time secrets

Generate a strong JWT secret and keep it for step 2:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

> The backend logs a SECURITY warning at boot if it's still running the dev secret.

## 1. Database — Neon (done)

Already provisioned. Copy the connection string from the Neon console.
Run migrations against it once from your machine:

```bash
cd backend && source .venv/bin/activate && alembic upgrade head
```

## 2. Backend — Render or Fly.io

The repo has a working `backend/Dockerfile`. On **Render** (simplest):

1. New → Web Service → connect the GitHub repo, root directory `backend`.
2. Environment: Docker. Instance: the starter tier is fine to launch.
3. Set environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Neon string (paste verbatim — SSL params are normalized) |
| `JWT_SECRET` | the secret from step 0 |
| `ANTHROPIC_API_KEY` | your key (summaries + Ask + Synthesize) |
| `FRONTEND_URL` | `https://<your-frontend-domain>` |
| `CORS_ORIGINS` | `["https://<your-frontend-domain>"]` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional — Google login |
| `GOOGLE_REDIRECT_URI` | `https://<your-backend-domain>/auth/google/callback` |

4. Deploy. Verify `https://<backend>/health` returns `{"status": "ok"}`.

> CORS already allows `chrome-extension://*` origins, so the extension works
> against the hosted API with no extra config.

## 3. Frontend — Vercel

`frontend/vercel.json` (SPA rewrites) is already in the repo.

```bash
cd frontend
npx vercel --prod
```

Set one environment variable in the Vercel project: `VITE_API_URL=https://<your-backend-domain>`.
Redeploy after setting it. Done — the app is live.

## 4. Google OAuth (optional)

In Google Cloud Console → Credentials → your OAuth client:
- Authorized redirect URI: `https://<backend>/auth/google/callback`
- Authorized JavaScript origin: `https://<frontend>`

## 5. Chrome extension

For yourself/testers right now: `npm run build` in `extension/`, load `extension/dist`
unpacked. It targets localhost by default; to point a dev build at production without
rebuilding, set `apiBase`/`webUrl` in `chrome.storage.local` from the extension's
service-worker console.

For the Chrome Web Store:
1. `cd extension && npm run build && cd dist && zip -r ../myweb-extension.zip .`
2. [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole)
   ($5 one-time fee) → New item → upload the zip.
3. Listing needs: description (in `manifest.json`), icons (bundled), 1–2 screenshots
   of the popup, a privacy-practices declaration (storage/scripting/tabs/bookmarks/
   identity/contextMenus are all user-initiated; nothing is collected in the
   background), and a link to `https://<frontend>/privacy`.
4. Before uploading, change the two defaults in `src/popup/main.ts`
   (`DEFAULT_API`, `DEFAULT_WEB`) to your production URLs so installs work
   out of the box.

## 6. Post-launch checklist

- [ ] `/health` returns ok; sign up a fresh account end-to-end
- [ ] Save a page via the extension against prod
- [ ] Import a bookmarks file from the web app (Home empty state)
- [ ] JWT_SECURITY warning absent from backend logs
- [ ] `/privacy` and `/terms` reachable from the landing footer
- [ ] Neon: enable point-in-time recovery / scheduled backups
- [ ] Update `frontend/src/lib/constants.ts` EXTENSION_URL → Web Store listing once live
