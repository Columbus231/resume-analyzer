# CareerLens AI

CareerLens AI is a student-focused resume analysis and career-planning application. It combines a responsive React/Vite dashboard with a FastAPI backend. **Demo mode is the default** and works without an AI key.

## What it does

- Extracts text from PDF and DOCX uploads or accepts pasted text.
- Shows resume evidence, skills, a guidance score, role-match estimates, skill gaps, and learning suggestions.
- Produces actionable resume-improvement suggestions and optional section rewrites for review.
- Exports a PDF analysis report and a DOCX resume draft.
- Supports a configurable OpenAI provider; the backend validates structured output and calculates role matches separately.

Role-match estimates use **70% mapped skill overlap, 15% project evidence, 10% education evidence, and 5% experience evidence**. The resume score is configurable internal guidance. Neither score is an ATS result or an employment prediction. Skills appearing in a resume are not independently verified, and an unmentioned skill may still be known by the student.

## Requirements

- Node.js 20+ and npm
- Python 3.10+

## Run locally (Windows PowerShell)

From the project root:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --env-file backend\.env
```

In another terminal, from the project root:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Open the Vite URL (normally `http://localhost:5173`). The API is available at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`.

The backend runs in demo mode unless `AI_ENABLED=true` and `OPENAI_API_KEY` are set in `backend\.env`. To enable OpenAI analysis, set:

```env
AI_ENABLED=true
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174
```

Set `OPENAI_BASE_URL` only when connecting to an OpenAI-compatible provider endpoint. Never put an AI key in the frontend `.env` file or commit a real `.env` file. Resume text is sent to the configured AI provider only when AI mode is enabled. Demo mode uses deterministic local keyword matching and does not send resume content to an AI service.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend status and AI configuration |
| `POST` | `/api/resume/upload` | Validate a PDF/DOCX and return extracted text |
| `POST` | `/api/resume/analyze` | Return the analysis, recommendations, gaps, and roadmap |
| `POST` | `/api/resume/improve` | Suggest a fact-preserving rewrite of supplied section text |
| `POST` | `/api/resume/export` | Create a DOCX draft from supplied resume text |
| `POST` | `/api/jobs/recommend` | Return estimated role recommendations |
| `POST` | `/api/skills/gaps` | Return skill gaps for a selected role |
| `POST` | `/api/learning/roadmap` | Return learning suggestions for a selected role |

Analysis and improvement payloads contain resume text and are validated for length. Uploads are limited to PDF/DOCX and 5 MB; extracted text is limited to 30,000 characters. Expensive analysis endpoints have in-memory per-IP rate limits.

## Privacy and storage

The backend is stateless: it does not create student accounts, persist resumes, or store analysis history. The current browser tab keeps the resume and recent analysis state in memory; clearing the workspace removes it. No database is provisioned because this version deliberately avoids retaining sensitive student data. Add authenticated student isolation, explicit consent, retention rules, and deletion workflows before introducing persistent storage.

When AI mode is enabled, submitted resume text is sent to the configured OpenAI API. Make that disclosure visible to students and follow the institution's privacy requirements before deployment. Do not log full resumes or personal information. The in-memory rate limiter is intended for local/student-project use; production deployments behind proxies should configure trusted proxy handling and a shared rate-limit backend.

Uploaded resume content is treated as untrusted data in AI prompts. Rewrites are previews and must be checked by the student. The app does not invent or verify qualifications, metrics, achievements, live vacancies, or placement outcomes.

## Tests and build

Run backend tests:

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

Run the frontend production build:

```powershell
npm.cmd run build
```
