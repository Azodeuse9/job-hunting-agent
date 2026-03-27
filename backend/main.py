from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import anthropic
import json
import uuid
from datetime import datetime
from database import db
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Job Hunting Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))

RESUME = os.getenv("RESUME_TEXT", """
Your Name: Aatif
Skills: Python, Machine Learning, Data Science, FastAPI, SQL, React
Experience: 2 years in software development
Education: B.Tech in Computer Science
Projects: Built ML models, REST APIs, dashboards
""")

# ────────────────────────────────────────────────
# MODELS
# ────────────────────────────────────────────────

class JobRequest(BaseModel):
    job_title: str
    company: str
    job_description: str
    job_url: Optional[str] = ""
    source: Optional[str] = "manual"

class WebhookPayload(BaseModel):
    jobs: List[JobRequest]

class CoverLetterRequest(BaseModel):
    job_id: str

class StatusUpdate(BaseModel):
    job_id: str
    status: str  # applied | rejected | interview | offer

# ────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────

def score_job(job_description: str) -> dict:
    """Use Claude to score how well resume matches the JD."""
    prompt = f"""You are a career coach. Score how well this resume matches the job description.

RESUME:
{RESUME}

JOB DESCRIPTION:
{job_description}

Return a JSON object with:
- score: integer 0-100
- reason: one sentence why
- should_apply: boolean (true if score >= 60)
- key_matches: list of 3 matching skills/experiences
- missing_skills: list of up to 3 skills the candidate lacks

Return ONLY valid JSON, no markdown."""

    message = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}]
    )
    
    try:
        result = json.loads(message.content[0].text)
    except Exception:
        result = {
            "score": 50,
            "reason": "Could not parse response",
            "should_apply": True,
            "key_matches": [],
            "missing_skills": []
        }
    return result


def generate_cover_letter(job_title: str, company: str, job_description: str) -> str:
    """Use Claude to write a tailored cover letter."""
    prompt = f"""You are an expert career coach and professional writer. 
Write a compelling, personalized cover letter for this job application.

RESUME:
{RESUME}

JOB TITLE: {job_title}
COMPANY: {company}
JOB DESCRIPTION:
{job_description}

Rules:
- Keep it under 300 words
- Be specific, not generic
- Match skills from resume to JD requirements
- Sound enthusiastic but professional
- End with a clear call to action
- Do NOT include [brackets] or placeholders — write it complete and ready to send

Return ONLY the cover letter text, no extra commentary."""

    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text.strip()


# ────────────────────────────────────────────────
# ROUTES
# ────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Job Hunting Agent is running 🚀", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


@app.post("/jobs/analyze")
def analyze_job(job: JobRequest):
    """Score a job and generate cover letter if score >= 60."""
    job_id = str(uuid.uuid4())
    
    # Score the job
    score_result = score_job(job.job_description)
    
    cover_letter = ""
    if score_result.get("should_apply", False):
        cover_letter = generate_cover_letter(
            job.job_title, job.company, job.job_description
        )
    
    record = {
        "id": job_id,
        "job_title": job.job_title,
        "company": job.company,
        "job_description": job.job_description,
        "job_url": job.job_url,
        "source": job.source,
        "score": score_result.get("score", 0),
        "reason": score_result.get("reason", ""),
        "should_apply": score_result.get("should_apply", False),
        "key_matches": score_result.get("key_matches", []),
        "missing_skills": score_result.get("missing_skills", []),
        "cover_letter": cover_letter,
        "status": "pending" if score_result.get("should_apply") else "skipped",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    db.save_job(record)
    return record


@app.post("/webhook/jobs")
def webhook_jobs(payload: WebhookPayload, background_tasks: BackgroundTasks):
    """Antigravity sends jobs here in bulk. Process in background."""
    job_ids = []
    for job in payload.jobs:
        job_id = str(uuid.uuid4())
        record = {
            "id": job_id,
            "job_title": job.job_title,
            "company": job.company,
            "job_description": job.job_description,
            "job_url": job.job_url,
            "source": job.source or "antigravity",
            "score": 0,
            "reason": "Processing...",
            "should_apply": False,
            "key_matches": [],
            "missing_skills": [],
            "cover_letter": "",
            "status": "processing",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        db.save_job(record)
        job_ids.append(job_id)
        background_tasks.add_task(process_job_background, job_id, job)
    
    return {"received": len(payload.jobs), "job_ids": job_ids}


def process_job_background(job_id: str, job: JobRequest):
    """Background task to score and generate cover letter."""
    score_result = score_job(job.job_description)
    cover_letter = ""
    if score_result.get("should_apply", False):
        cover_letter = generate_cover_letter(
            job.job_title, job.company, job.job_description
        )
    
    db.update_job(job_id, {
        "score": score_result.get("score", 0),
        "reason": score_result.get("reason", ""),
        "should_apply": score_result.get("should_apply", False),
        "key_matches": score_result.get("key_matches", []),
        "missing_skills": score_result.get("missing_skills", []),
        "cover_letter": cover_letter,
        "status": "pending" if score_result.get("should_apply") else "skipped",
        "updated_at": datetime.utcnow().isoformat(),
    })


@app.get("/jobs")
def get_all_jobs():
    """Get all jobs for the dashboard."""
    return db.get_all_jobs()


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/jobs/{job_id}/cover-letter")
def regenerate_cover_letter(job_id: str):
    """Regenerate cover letter for a specific job."""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    cover_letter = generate_cover_letter(
        job["job_title"], job["company"], job["job_description"]
    )
    db.update_job(job_id, {
        "cover_letter": cover_letter,
        "updated_at": datetime.utcnow().isoformat()
    })
    return {"cover_letter": cover_letter}


@app.patch("/jobs/{job_id}/status")
def update_status(job_id: str, update: StatusUpdate):
    """Update job application status."""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    db.update_job(job_id, {
        "status": update.status,
        "updated_at": datetime.utcnow().isoformat()
    })
    return {"job_id": job_id, "status": update.status}


@app.get("/stats")
def get_stats():
    """Dashboard stats summary."""
    jobs = db.get_all_jobs()
    total = len(jobs)
    applied = sum(1 for j in jobs if j["status"] == "applied")
    skipped = sum(1 for j in jobs if j["status"] == "skipped")
    interviews = sum(1 for j in jobs if j["status"] == "interview")
    offers = sum(1 for j in jobs if j["status"] == "offer")
    avg_score = round(sum(j["score"] for j in jobs) / total, 1) if total else 0
    
    return {
        "total": total,
        "applied": applied,
        "skipped": skipped,
        "interviews": interviews,
        "offers": offers,
        "avg_score": avg_score,
        "pending": sum(1 for j in jobs if j["status"] == "pending"),
    }


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    db.delete_job(job_id)
    return {"deleted": job_id}
