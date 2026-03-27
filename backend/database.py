import json
import os
from typing import Optional, List, Dict
from threading import Lock

DATA_FILE = os.getenv("DATA_FILE", "jobs_data.json")
_lock = Lock()


class Database:
    def __init__(self):
        self._ensure_file()

    def _ensure_file(self):
        if not os.path.exists(DATA_FILE):
            with open(DATA_FILE, "w") as f:
                json.dump([], f)

    def _read(self) -> List[Dict]:
        with _lock:
            with open(DATA_FILE, "r") as f:
                return json.load(f)

    def _write(self, data: List[Dict]):
        with _lock:
            with open(DATA_FILE, "w") as f:
                json.dump(data, f, indent=2)

    def save_job(self, job: Dict):
        jobs = self._read()
        jobs.append(job)
        self._write(jobs)

    def get_all_jobs(self) -> List[Dict]:
        jobs = self._read()
        return sorted(jobs, key=lambda j: j.get("created_at", ""), reverse=True)

    def get_job(self, job_id: str) -> Optional[Dict]:
        return next((j for j in self._read() if j["id"] == job_id), None)

    def update_job(self, job_id: str, updates: Dict):
        jobs = self._read()
        for job in jobs:
            if job["id"] == job_id:
                job.update(updates)
                break
        self._write(jobs)

    def delete_job(self, job_id: str):
        jobs = self._read()
        jobs = [j for j in jobs if j["id"] != job_id]
        self._write(jobs)


db = Database()
