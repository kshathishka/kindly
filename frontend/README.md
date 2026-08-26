# StoryBridge AI

StoryBridge AI is a backend prototype for generating personalized social stories for autistic children.

## Features
- FastAPI REST API with Swagger docs
- Child profile CRUD using JSON persistence
- Story generation with AI + template fallback
- Modular service architecture
- Streamlit demo frontend

## Quick start

1. Create a virtual environment:
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

2. Install dependencies:
   pip install -r requirements.txt

3. Configure environment:
   Copy .env.example to .env and set your OpenAI key if desired.

4. Start the API:
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

5. Open the docs:
   http://localhost:8000/docs

6. Start the Streamlit demo:
   streamlit run app/streamlit_app.py

## API overview

- POST /api/v1/children
- GET /api/v1/children
- GET /api/v1/children/{id}
- PUT /api/v1/children/{id}
- DELETE /api/v1/children/{id}
- POST /api/v1/stories/generate
- GET /api/v1/stories/history
- GET /api/v1/stories/{id}

## Notes

This prototype intentionally uses JSON files instead of a database, making future migrations straightforward.
