/* ════════════════════════════════════════════
   JOB HUNTING AGENT — FRONTEND LOGIC
════════════════════════════════════════════ */

// ── CONFIG ──────────────────────────────────
const DEFAULT_API = 'http://localhost:8000';
let API_BASE = localStorage.getItem('api_base') || DEFAULT_API;
let allJobs = [];

// ── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupNav();
  setupFilters();
  checkHealth();
  loadDashboard();

  document.getElementById('refresh-btn').addEventListener('click', () => {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('spinning');
    loadDashboard().finally(() => {
      if (currentView === 'jobs') loadAllJobs();
      setTimeout(() => btn.classList.remove('spinning'), 600);
    });
  });

  document.getElementById('view-all-btn').addEventListener('click', () => {
    switchView('jobs');
  });

  document.getElementById('menu-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('api-url-input').value = API_BASE;
  updateWebhookDisplay();
});

// ── NAVIGATION ───────────────────────────────
let currentView = 'dashboard';

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add('active');
  const nav = document.getElementById(`nav-${view}`);
  if (nav) nav.classList.add('active');

  const labels = { dashboard: 'Dashboard', jobs: 'All Jobs', add: 'Analyze Job', settings: 'Settings' };
  document.getElementById('breadcrumb').textContent = labels[view] || view;

  if (view === 'jobs') loadAllJobs();
  if (view === 'dashboard') loadDashboard();
  if (view === 'settings') updateWebhookDisplay();
}

// ── API HELPERS ──────────────────────────────
async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function checkHealth() {
  const statusEl = document.getElementById('api-status');
  try {
    await apiFetch('/health');
    statusEl.className = 'api-status online';
    statusEl.innerHTML = '<div class="status-dot"></div><span>API Online</span>';
  } catch {
    statusEl.className = 'api-status offline';
    statusEl.innerHTML = '<div class="status-dot"></div><span>API Offline</span>';
  }
}

// ── DASHBOARD ────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, jobs] = await Promise.all([
      apiFetch('/stats'),
      apiFetch('/jobs'),
    ]);
    allJobs = jobs;
    renderStats(stats);
    renderRecentTable(jobs.slice(0, 8));
    checkHealth();
  } catch (err) {
    console.error('Dashboard load error:', err);
    renderRecentTable([]);
  }
}

function renderStats(s) {
  setText('s-total',      s.total ?? '—');
  setText('s-applied',    s.applied ?? '—');
  setText('s-interviews', s.interviews ?? '—');
  setText('s-offers',     s.offers ?? '—');
  setText('s-score',      s.avg_score ? `${s.avg_score}%` : '—');
  setText('s-skipped',    s.skipped ?? '—');
}

function renderRecentTable(jobs) {
  const tbody = document.getElementById('recent-body');
  if (!jobs.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>No jobs yet</h3>
      <p>Click "Add Job" to analyze your first job description with Claude.</p>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = jobs.map(j => jobRow(j, false)).join('');
}

// ── ALL JOBS VIEW ────────────────────────────
let filteredJobs = [];

async function loadAllJobs() {
  const tbody = document.getElementById('all-body');
  tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">Loading…</td></tr>`;
  try {
    allJobs = await apiFetch('/jobs');
    filteredJobs = [...allJobs];
    applyFilters();
  } catch {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">⚠️ Could not connect to backend.</td></tr>`;
  }
}

function setupFilters() {
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  document.getElementById('score-filter').addEventListener('change', applyFilters);
}

function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const statusF = document.getElementById('status-filter').value;
  const scoreF  = document.getElementById('score-filter').value;

  filteredJobs = allJobs.filter(j => {
    const matchSearch = !search ||
      j.job_title.toLowerCase().includes(search) ||
      j.company.toLowerCase().includes(search);

    const matchStatus = !statusF || j.status === statusF;

    let matchScore = true;
    if (scoreF === '80')  matchScore = j.score >= 80;
    if (scoreF === '60')  matchScore = j.score >= 60;
    if (scoreF === '0')   matchScore = j.score < 60;

    return matchSearch && matchStatus && matchScore;
  });

  renderAllTable(filteredJobs);
}

function renderAllTable(jobs) {
  const tbody = document.getElementById('all-body');
  if (!jobs.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>No jobs match your filters</h3>
      <p>Try clearing the search or changing the status filter.</p>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = jobs.map(j => jobRow(j, true)).join('');
}

function jobRow(j, showMatches) {
  const score = j.score || 0;
  const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
  const initials = j.company.slice(0, 2).toUpperCase();
  const date = j.created_at ? new Date(j.created_at).toLocaleDateString() : '—';

  const matchesCol = showMatches
    ? `<td>${(j.key_matches || []).slice(0,2).map(m => `<span class="chip" style="font-size:11px">${m}</span>`).join(' ')}</td>`
    : '';

  return `<tr onclick="openJobModal('${j.id}')">
    <td><strong>${esc(j.job_title)}</strong></td>
    <td>
      <div class="company-badge">
        <div class="company-avatar">${initials}</div>
        <span>${esc(j.company)}</span>
      </div>
    </td>
    <td><span class="score-badge ${scoreClass}">${score}</span></td>
    ${matchesCol}
    <td><span class="status-pill status-${j.status}">${j.status}</span></td>
    <td style="color:var(--text-muted);font-size:12px">${date}</td>
    <td onclick="event.stopPropagation()">
      <div class="table-actions">
        <button class="action-btn" title="View details" onclick="openJobModal('${j.id}')">👁</button>
        <button class="action-btn" title="Delete" onclick="deleteJob('${j.id}')">🗑</button>
      </div>
    </td>
  </tr>`;
}

// ── ADD JOB / ANALYZE ────────────────────────
async function analyzeJob() {
  const title = document.getElementById('in-title').value.trim();
  const company = document.getElementById('in-company').value.trim();
  const jd = document.getElementById('in-jd').value.trim();
  const url = document.getElementById('in-url').value.trim();

  if (!title || !company || !jd) {
    showToast('⚠️ Please fill in Job Title, Company, and Job Description');
    return;
  }

  const btn = document.getElementById('analyze-btn');
  const btnText = document.getElementById('analyze-btn-text');
  const spinner = document.getElementById('analyze-spinner');

  btn.disabled = true;
  btnText.textContent = 'Analyzing with Claude…';
  spinner.classList.remove('hidden');
  document.getElementById('result-card').classList.add('hidden');

  try {
    const result = await apiFetch('/jobs/analyze', {
      method: 'POST',
      body: JSON.stringify({
        job_title: title,
        company: company,
        job_description: jd,
        job_url: url,
        source: 'manual',
      }),
    });

    renderResult(result);
    showToast('✅ Analysis complete!');
  } catch (err) {
    showToast('❌ Error: Could not connect to backend. Is it running?');
    console.error(err);
  } finally {
    btn.disabled = false;
    btnText.textContent = '⚡ Analyze with Claude';
    spinner.classList.add('hidden');
  }
}

function renderResult(r) {
  const card = document.getElementById('result-card');
  card.classList.remove('hidden');

  document.getElementById('result-title').textContent = r.job_title;
  document.getElementById('result-company').textContent = r.company;
  document.getElementById('result-reason').textContent = r.reason;

  const verdict = document.getElementById('result-verdict');
  if (r.should_apply) {
    verdict.textContent = '✅ Apply — Good Match';
    verdict.className = 'result-verdict verdict-apply';
  } else {
    verdict.textContent = '⏭ Skip — Low Match';
    verdict.className = 'result-verdict verdict-skip';
  }

  // Animate score ring
  const score = r.score || 0;
  document.getElementById('ring-text').textContent = score;
  const ringFill = document.getElementById('ring-fill');
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - score / 100);
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  ringFill.style.stroke = color;
  setTimeout(() => { ringFill.style.strokeDashoffset = offset; }, 50);

  // Chips
  const matchesEl = document.getElementById('matches-chips');
  const missingEl = document.getElementById('missing-chips');
  matchesEl.innerHTML = (r.key_matches || []).map(m => `<span class="chip">${esc(m)}</span>`).join('');
  missingEl.innerHTML = (r.missing_skills || []).map(m => `<span class="chip">${esc(m)}</span>`).join('');

  // Cover letter
  const clBox = document.getElementById('cover-letter-box');
  if (r.cover_letter) {
    clBox.classList.remove('hidden');
    document.getElementById('cover-letter-text').textContent = r.cover_letter;
    window._currentCoverLetter = r.cover_letter;
    window._currentJobId = r.id;
  } else {
    clBox.classList.add('hidden');
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function copyCoverLetter() {
  if (window._currentCoverLetter) {
    navigator.clipboard.writeText(window._currentCoverLetter)
      .then(() => showToast('📋 Cover letter copied!'))
      .catch(() => showToast('⚠️ Copy failed — select and copy manually'));
  }
}

// ── JOB DETAIL MODAL ─────────────────────────
async function openJobModal(jobId) {
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  overlay.classList.remove('hidden');
  body.innerHTML = '<p style="color:var(--text-muted)">Loading…</p>';

  try {
    const j = await apiFetch(`/jobs/${jobId}`);
    const score = j.score || 0;
    const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
    const date = j.created_at ? new Date(j.created_at).toLocaleString() : '—';

    body.innerHTML = `
      <div class="modal-title">${esc(j.job_title)}</div>
      <div class="modal-company">${esc(j.company)} ${j.job_url ? `· <a href="${esc(j.job_url)}" target="_blank" style="color:var(--accent2)">View Posting ↗</a>` : ''}</div>

      <div class="modal-score-row">
        <span class="score-badge ${scoreClass}" style="width:auto;padding:4px 12px;font-size:14px">Match: ${score}/100</span>
        <span class="status-pill status-${j.status}">${j.status}</span>
        <span style="font-size:12px;color:var(--text-muted)">${date}</span>
      </div>

      <div class="modal-section">
        <h4>AI Analysis</h4>
        <p style="font-size:13px;color:var(--text-muted);line-height:1.6">${esc(j.reason || '—')}</p>
      </div>

      ${j.key_matches?.length ? `<div class="modal-section">
        <h4>Key Matches</h4>
        <div class="chips">${j.key_matches.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>
      </div>` : ''}

      ${j.missing_skills?.length ? `<div class="modal-section">
        <h4>Missing Skills</h4>
        <div class="chips red">${j.missing_skills.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>
      </div>` : ''}

      ${j.cover_letter ? `<div class="modal-section">
        <h4>Cover Letter</h4>
        <div class="modal-cl-box">${esc(j.cover_letter)}</div>
      </div>` : '<p style="color:var(--text-muted);font-size:13px">No cover letter generated (score too low).</p>'}

      <div class="modal-actions">
        <select class="status-select" id="modal-status-select">
          <option value="">Update Status…</option>
          <option value="pending">Pending</option>
          <option value="applied">Applied</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
          <option value="skipped">Skipped</option>
        </select>
        ${j.cover_letter ? `<button class="btn-ghost small" onclick="copyText(\`${esc(j.cover_letter)}\`)">Copy Cover Letter</button>` : ''}
        <button class="btn-ghost small" onclick="regenCoverLetter('${j.id}')">↻ Regen Letter</button>
      </div>
    `;

    document.getElementById('modal-status-select').addEventListener('change', async function() {
      if (!this.value) return;
      try {
        await apiFetch(`/jobs/${j.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ job_id: j.id, status: this.value }),
        });
        showToast(`✅ Status updated to: ${this.value}`);
        loadDashboard();
      } catch {
        showToast('❌ Failed to update status');
      }
    });

  } catch (err) {
    body.innerHTML = '<p style="color:var(--red)">Failed to load job details.</p>';
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

async function regenCoverLetter(jobId) {
  showToast('⚡ Regenerating cover letter…');
  try {
    const res = await apiFetch(`/jobs/${jobId}/cover-letter`, { method: 'POST' });
    openJobModal(jobId);
    showToast('✅ New cover letter ready!');
  } catch {
    showToast('❌ Regen failed');
  }
}

async function deleteJob(jobId) {
  if (!confirm('Delete this job from history?')) return;
  try {
    await apiFetch(`/jobs/${jobId}`, { method: 'DELETE' });
    showToast('🗑 Job deleted');
    loadDashboard();
    if (currentView === 'jobs') loadAllJobs();
  } catch {
    showToast('❌ Delete failed');
  }
}

// ── SETTINGS ─────────────────────────────────
function saveSettings() {
  const val = document.getElementById('api-url-input').value.trim().replace(/\/$/, '');
  API_BASE = val || DEFAULT_API;
  localStorage.setItem('api_base', API_BASE);
  updateWebhookDisplay();
  const msg = document.getElementById('settings-msg');
  msg.classList.remove('hidden');
  msg.textContent = `✅ Saved! Using: ${API_BASE}`;
  setTimeout(() => msg.classList.add('hidden'), 3000);
  checkHealth();
}

function loadSettings() {
  const saved = localStorage.getItem('api_base');
  if (saved) API_BASE = saved;
}

function updateWebhookDisplay() {
  document.getElementById('webhook-url-display').textContent = `${API_BASE}/webhook/jobs`;
}

function copyWebhook() {
  const url = `${API_BASE}/webhook/jobs`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('📋 Webhook URL copied!'))
    .catch(() => showToast('Copy: ' + url));
}

// ── HELPERS ───────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast('📋 Copied!'))
    .catch(() => showToast('⚠️ Manual copy required'));
}
