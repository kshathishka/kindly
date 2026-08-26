# Kindly — frontend / backend integration

How the Next.js frontend in `frontend/` talks to the FastAPI backend in `app/`,
what changed to connect them, and what is still open.

---

## Running both halves

Two processes. The backend first.

**Backend — http://127.0.0.1:8000**

```bash
python -m venv .venv-local
.venv-local/Scripts/python.exe -m pip install -r requirements-dev.txt
cp .env.example .env
.venv-local/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Interactive API docs are at http://127.0.0.1:8000/docs.

**Frontend — http://localhost:3000**

```bash
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

`frontend/.env.local` holds one variable:

```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

It must be an address the *browser* can reach, not a container hostname — the
requests are made from the page, not from the Next.js server.

`CORS_ORIGINS` in `.env` must list the frontend's origin or every call is
blocked. The default covers `localhost:3000` and `127.0.0.1:3000`.

---

## How the two connect

Everything goes through one module. Nothing else in the app calls `fetch`.

| File | Role |
| --- | --- |
| `frontend/lib/api-types.ts` | TypeScript mirrors of the Pydantic models in `app/models/common.py` |
| `frontend/lib/api.ts` | One typed method per endpoint, plus `ApiError` |
| `frontend/lib/session.ts` | Who is signed in, and which child is in context |
| `frontend/lib/hooks.ts` | Loading and polling for the caregiver screens |

`api-types.ts` is hand-written, so **a change to a Pydantic model needs the
matching change here**. The backend publishes an OpenAPI schema at
`/openapi.json` if you would rather generate them later.

### Which screen calls what

| Screen | Endpoints |
| --- | --- |
| `app/auth` | `POST /auth/signup`, `POST /auth/login` |
| Settings → Sign out | `POST /auth/logout` |
| `app/onboarding` | `POST /children` |
| `app/page` (Home) | `GET /frontend-config`, `GET /children`, `GET /help-requests`, `GET /stories/history`, `POST /stories/generate` |
| `app/page` (Child mode) | `POST /help-requests`, `GET /help-requests/{id}` |
| `app/page` (Requests) | `GET /help-requests`, `POST /help-requests/{id}/respond` |
| `app/page` (Settings) | `GET /health` |
| `app/situations` | `POST /stories/generate` |
| `app/activities` | `GET /children`, `PUT /children/{id}` |

### Polling, because there is no realtime channel

The backend has no websocket or SSE, so anything a child can change while a
caregiver is watching is polled:

- **Caregiver request list** — every 5s, paused while the tab is hidden.
- **Child waiting screen** — every 3s, because a child on that screen is
  actively waiting to be told somebody is coming.
- **Stories and profiles** — not polled. They only change when the caregiver
  changes them.

A failed poll on the child's waiting screen keeps the last known state rather
than replacing "someone is coming" with an error.

---

## Changes made to the backend

Three, all needed to make the two halves work together.

**1. `app/config.py` — CORS could not be configured.**

`cors_origins` is a `List[str]`, and pydantic-settings JSON-decodes complex
fields from `.env` *before* field validators run. So the `parse_cors_origins`
validator was unreachable, and any plain comma-separated `CORS_ORIGINS` crashed
the app at import with `SettingsError`. The field is now annotated with
`NoDecode`, which skips the JSON step and lets the existing validator do its
job. Comma-separated values work as intended.

**2. `app/models/common.py` + `app/main.py` — child profiles had no owner.**

`ChildProfile` had no link to a user, and `GET /api/v1/children` returned every
profile in the store. Signing in as a new caregiver showed all 51 children
belonging to other families. Added `ChildProfile.caregiver_id` — optional, so
the profiles already in `data/children.json` still load — and scoped the
listing to it.

**4. `app/security.py` (new) — bearer-token authentication.**

Signup and login now mint a token and store only its SHA-256 in
`data/sessions.json`. A `current_user` dependency resolves the token on every
data route, and ownership is derived from it rather than from a request body or
query parameter, so there is no id a caller can change to reach another family.
Also added `POST /api/v1/auth/logout` and `GET /api/v1/auth/me`.

On the frontend, `lib/api.ts` attaches the token to every request and handles
401 centrally: the session is cleared and the user is sent to sign in, from
wherever in the app the rejected call happened.

**5. `tests/conftest.py` (new) — tests no longer write to `data/`.**

The suite ran against the real data directory and dirtied the committed JSON
files on every run. It now points `JSON_DATA_DIR` at a temp directory before
`app.config` is imported, and each test gets its own signed-in caregiver.

**3. `frontend/` replaced.** The vanilla-JS client that used to live there was
removed in favour of the Next.js app.

---

## Open issues

These are real and worth fixing. None of them block local development.

### Security

**Authentication is in place.** Every `/api/v1` route that touches family data
requires a bearer token; see the Authentication section of
[DEPLOYMENT.md](DEPLOYMENT.md) for how it works and what it guarantees. The
remaining gap is rate limiting on `/api/v1/auth/login` — nothing currently slows
down password guessing.

**Real credentials are committed.** `data/users.json` is in the public repo and
contains a real email address with PBKDF2 password hashes. The hashes are
properly salted and stretched, but they are public. Rotate that password, and
consider whether `data/` belongs in git at all — it is the live database.

**`.venv/` is committed** — 13,894 files, including a broken interpreter path
(`D:\Python\Python311`) that fails on any other machine. It is already in
`.gitignore`, so it was added before that rule existed. `git rm -r --cached
.venv` would untrack it without deleting your local copy. This is also why
cloning the repo on Windows fails with "Filename too long" unless
`core.longpaths` is set.

### Correctness

**Pronouns are used as subjects.** `AIService._fallback_story` writes
`When {pronouns} notices the feeling growing`, which produces "When he/him
notices…". The field holds a pronoun *set*, so it needs splitting into subject
and object forms before it reads correctly.

**`datetime.utcnow()` is deprecated** and warns throughout the test run. It is
scheduled for removal; `datetime.now(datetime.UTC)` is the replacement.

**Python version.** The pins in `requirements.txt` match the committed `.venv`
and need **Python 3.11**. On 3.14 there is no `pydantic-core` 2.23.4 wheel and
pip falls back to a Rust build. If you are on a newer Python, install
`pydantic>=2.12` instead — the app code is compatible either way.

### Missing endpoints

Two screens are waiting on backend work:

- **Routines** (`app/routines`, and the Routines tab) — there is no routines
  API. The screen says so plainly rather than saving to `localStorage` and
  letting a caregiver believe a routine was stored. Needs
  `GET/POST/PUT/DELETE /api/v1/routines`.
- **Social skills** — `GET /api/v1/social-skills/scenarios` returns five
  scenarios and is wired into `lib/api.ts`, but no screen uses it yet. The
  child-mode "How I feel" card is the natural home for it.

---

## Testing

```bash
.venv-local/Scripts/python.exe -m pytest tests/ -q   # 15 passing
cd frontend && npx tsc --noEmit && npm run build
```

Six of those cover the auth boundary: anonymous callers rejected, malformed
tokens rejected, one caregiver unable to read or modify another's children,
requests and stories, ownership not reassignable through the request body, and
logout actually revoking a token.

There are no frontend tests yet. `lib/api.ts` and `lib/hooks.ts` are the two
places worth covering first.
