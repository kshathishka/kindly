# Deploying Kindly

Frontend on Vercel, backend on Render. They are separate deploys and each needs
to know the other's URL, so there is a deliberate ordering below.

**Vercel cannot host the FastAPI backend as written.** `JSONStorage` creates and
writes `data/*.json` at startup, and Vercel's serverless filesystem is read-only
apart from `/tmp`, which is per-instance and wiped between invocations. The
backend needs a host with a real disk.

---

## 1. Backend → Render

The repo has a `render.yaml` blueprint.

1. Go to https://dashboard.render.com/blueprints → **New Blueprint Instance**.
2. Connect `kshathishka/kindly`. Render reads `render.yaml` and proposes a
   `kindly-api` web service with a 1 GB disk at `/var/data`.
3. Two variables are marked `sync: false`, so Render will ask for them:
   - `CORS_ORIGINS` — leave blank for now, you fill it in at step 3.
   - `OPENAI_API_KEY` — optional. Without it stories fall back to the built-in
     template and the UI labels them as such.
4. Deploy. You get a URL like `https://kindly-api.onrender.com`.

Check it: `https://kindly-api.onrender.com/health` should return
`{"status":"ok", ...}`.

### About the plan

`render.yaml` specifies `plan: starter` (paid) because **persistent disks are
not available on Render's free tier**. On the free plan the service also sleeps
when idle and restarts with an empty filesystem — for JSON file storage that
means every profile and help request disappears. If you want free anyway, change
`plan` to `free` and delete the `disk:` block, and treat the data as temporary.

The durable fix is to replace `JSONStorage` with a database. Render, Neon and
Supabase all have free Postgres tiers, and `storage_service.py` is small enough
that swapping it is a contained job.

---

## 2. Frontend → Vercel

The Next.js app lives in `frontend/`, not the repo root, so the root directory
setting matters.

1. https://vercel.com/new → import `kshathishka/kindly`.
2. **Root Directory: `frontend`.** Vercel detects Next.js and fills in the build
   command and output directory itself.
3. Add one environment variable:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_BASE_URL` | `https://kindly-api.onrender.com` |

   No trailing slash. This is read at build time and baked into the client
   bundle, so **changing it later needs a redeploy**, not just a settings save.
4. Deploy. You get `https://kindly-<something>.vercel.app`.

---

## 3. Point the backend back at the frontend

Until you do this, every request from the browser is blocked by CORS and the app
shows "Could not reach the Kindly server".

In Render → `kindly-api` → Environment, set:

```
CORS_ORIGINS=https://kindly-<something>.vercel.app
```

Comma-separate several. If you use a custom domain, include it too — and
remember Vercel preview deployments each get their own hostname, which will not
be covered unless you add them.

Save; Render restarts the service.

---

## 4. Check it end to end

1. Open the Vercel URL. You should land on `/auth`.
2. Create an account, complete onboarding with a child's name.
3. Home → describe a situation → **Make my story**.
4. **Open child mode** → I need help → pick a request.
5. Back to Adult View → **Requests** → answer it.

If the app loads but every screen says it cannot reach the server, it is almost
always one of: `CORS_ORIGINS` missing the Vercel domain, `NEXT_PUBLIC_API_BASE_URL`
unset or stale (needs a redeploy), or a Render free service still waking up.

---

## Authentication

Every route under `/api/v1` that touches family data requires a bearer token.
Only `/health`, `/api/v1/frontend-config`, `/api/v1/social-skills/scenarios` and
the `/api/v1/auth/*` entry points are open.

- Signup and login mint a token; only its SHA-256 is stored in
  `data/sessions.json`, so a leaked file cannot be replayed.
- The caller's identity comes from the token, never from a request body or query
  parameter. There is no id a client can change to reach another family.
- Tokens last 30 days. Signing out revokes immediately; expired sessions are
  purged when new ones are minted.
- A request for a resource belonging to someone else returns **404, not 403**,
  so the API does not confirm an id exists to a caller who cannot have it.

`tests/test_api.py` covers this: anonymous callers rejected, malformed tokens
rejected, one caregiver unable to read or modify another's children, requests
and stories, ownership not reassignable through the request body, and logout
actually revoking.

### Still worth doing

- **Rate-limit `/api/v1/auth/login`.** Nothing currently slows down password
  guessing.
- **`data/users.json` is in git** with a real email and password hashes. Rotate
  that password. Consider whether `data/` belongs in the repo at all — on Render
  it is ignored anyway, since `JSON_DATA_DIR` points at the mounted disk.
- **Child mode shares the caregiver's session.** That is fine while it is a view
  inside the caregiver's app, but if the child ever gets their own device it
  needs a separate, narrower credential.

---

## Environment variables, both halves

**Backend** (Render, or `.env` locally — see `.env.example`)

| Name | Purpose |
| --- | --- |
| `JSON_DATA_DIR` | Where the JSON files live. `/var/data` on Render. |
| `CORS_ORIGINS` | Comma-separated origins allowed to call the API. |
| `APP_ENV` | Shown on the Settings screen. |
| `OPENAI_API_KEY` | Optional; template fallback without it. |
| `OPENAI_MODEL` | Defaults to `gpt-4o-mini`. |

**Frontend** (Vercel, or `frontend/.env.local` — see `frontend/.env.example`)

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Backend origin. Baked in at build time. |
