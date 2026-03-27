# ⚡ Job Hunting Agent — Complete Setup Guide

A full AI-powered job hunting system using Claude AI. Scores jobs, writes cover letters, tracks applications — all automated.

---

## 🗂 Project Structure

```
JOB HUNTING AGENT/
├── backend/
│   ├── main.py          ← FastAPI backend (all AI logic)
│   ├── database.py      ← JSON file database
│   ├── requirements.txt ← Python packages
│   ├── .env.example     ← Template for your API key
│   └── Procfile         ← Railway/Render deployment
├── dashboard/
│   ├── index.html       ← Main dashboard UI
│   ├── style.css        ← Premium dark theme
│   └── app.js           ← Frontend logic
├── start.bat            ← One-click Windows launcher
├── railway.toml         ← Railway deployment config
└── .gitignore
```

---

## 🚀 STEP 1 — Install Python

> If you already have Python 3.10+, skip this.

1. Go to: https://www.python.org/downloads/
2. Download Python 3.12 (latest)
3. **IMPORTANT**: Check ✅ "Add Python to PATH" in the installer
4. Click Install Now
5. Verify: Open a new PowerShell and type `python --version`

---

## 🔑 STEP 2 — Get Your Claude API Key

1. Go to: https://console.anthropic.com
2. Sign up / Log in
3. Click **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

---

## ⚙️ STEP 3 — Configure Environment

1. Open `backend/.env.example`
2. Copy it and rename to `backend/.env`
3. Fill in your details:

```env
CLAUDE_API_KEY=sk-ant-YOUR_KEY_HERE

RESUME_TEXT=Your Name: Aatif | Skills: Python, Data Science, ML, FastAPI | Experience: 2 years software dev | Education: B.Tech CS | Projects: ML models, REST APIs
```

**Resume tip**: Put your entire resume on one line separated by `|` or newlines. The more detail, the better Claude scores your fit.

---

## ▶️ STEP 4 — Run Locally

**Option A: Double-click `start.bat`**

**Option B: Manual**
```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then open `dashboard/index.html` in your browser.

---

## 🌐 STEP 5 — Deploy to Railway (Free Cloud)

1. Go to https://railway.app and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `JOB HUNTING AGENT` repo
4. Railway auto-detects the `railway.toml` config
5. Go to **Variables** tab and add:
   - `CLAUDE_API_KEY` = your key
   - `RESUME_TEXT` = your resume text
6. Click **Deploy**
7. Copy your Railway URL (e.g. `https://job-agent.railway.app`)
8. Open dashboard → **Settings** → paste the URL → Save

---

## 💼 STEP 6 — Use the Dashboard

### Add a Job Manually
1. Click **Add Job** in sidebar
2. Paste job title, company, and the full JD
3. Click **⚡ Analyze with Claude**
4. Claude will:
   - Score your match (0-100)
   - Decide apply or skip
   - Write a tailored cover letter

### Track Applications
- Go to **All Jobs** to see everything
- Click any row to open the detail modal
- Change status: Pending → Applied → Interview → Offer

### Webhook for Antigravity
- Go to **Settings** → copy the Webhook URL
- Send this to Antigravity: `POST /webhook/jobs`
- It accepts bulk job arrays and processes in the background

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/jobs/analyze` | Analyze a single job |
| POST | `/webhook/jobs` | Bulk jobs from Antigravity |
| GET | `/jobs` | All jobs |
| GET | `/jobs/{id}` | Single job detail |
| POST | `/jobs/{id}/cover-letter` | Regenerate cover letter |
| PATCH | `/jobs/{id}/status` | Update status |
| GET | `/stats` | Dashboard stats |
| DELETE | `/jobs/{id}` | Delete job |

Interactive API docs: `http://localhost:8000/docs`

---

## 🤖 Antigravity Webhook Format

Send jobs from Antigravity like this:

```json
POST /webhook/jobs
{
  "jobs": [
    {
      "job_title": "ML Engineer",
      "company": "OpenAI",
      "job_description": "We are looking for...",
      "job_url": "https://linkedin.com/jobs/...",
      "source": "linkedin"
    }
  ]
}
```

The backend will score each job and generate cover letters automatically in the background.

---

## ❓ Troubleshooting

| Problem | Fix |
|---------|-----|
| `python not found` | Install Python + check "Add to PATH" |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| Dashboard shows "API Offline" | Make sure backend is running on port 8000 |
| Cover letter is empty | Score was < 60. The job was auto-skipped. |
| Railway deploy fails | Add env vars in Railway dashboard → Variables |

---

## 📬 Contact

Built by Antigravity AI for Aatif's job hunt.
