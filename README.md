# Kindly

A calm support space for autistic children and their caregivers. Caregivers
prepare for situations with short social stories; children ask for help with one
tap and see, on their own screen, when a grown-up is coming.

- **Backend** — FastAPI, JSON file storage, optional OpenAI story generation (`app/`)
- **Frontend** — Next.js 16, React 19 (`frontend/`)

## Quick start

Two terminals.

```bash
python -m venv .venv-local
.venv-local/Scripts/python.exe -m pip install -r requirements-dev.txt
cp .env.example .env
.venv-local/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

Then open http://localhost:3000. The API docs are at http://127.0.0.1:8000/docs.

Story generation works without an API key — it falls back to a built-in template
and labels the result as such. Set `OPENAI_API_KEY` in `.env` for AI-written
stories.

## Tests

```bash
.venv-local/Scripts/python.exe -m pytest tests/ -q
cd frontend && npx tsc --noEmit && npm run build
```

## Deploying

Frontend to Vercel, backend to Render — they are separate deploys and each needs
the other's URL. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) walks through it.

Note that Vercel cannot host the backend as written: `JSONStorage` writes to
disk, and Vercel's serverless filesystem is ephemeral.

## Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploying, environment variables,
  and how authentication works
- [`docs/INTEGRATION.md`](docs/INTEGRATION.md) — how the two halves connect,
  what changed to join them, and the open issues
