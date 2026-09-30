/* ============================================================
   utils.js — Shared helpers used across the application
   ============================================================ */

// ── Cached holiday set ──────────────────────────────────────
let _holidaySet = null; // Set of 'YYYY-MM-DD' strings

async function loadHolidays() {
  if (_holidaySet) return _holidaySet;
  try {
    const rows = await getAllPublicHolidays();
    _holidaySet = new Set(rows.map(r => r.date));
  } catch {
    _holidaySet = new Set();
  }
  return _holidaySet;
}

function clearHolidayCache() { _holidaySet = null; }

// ── Working-days calculation ────────────────────────────────
async function calculateWorkingDays(startDateStr, endDateStr) {
  const holidays = await loadHolidays();
  const start = new Date(startDateStr + 'T00:00:00');
  const end   = new Date(endDateStr   + 'T00:00:00');
  if (isNaN(start) || isNaN(end) || end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow  = cur.getDay(); // 0=Sun 6=Sat
    const iso  = formatDate(cur);
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── Date formatting ──────────────────────────────────────────
function formatDate(d, opts = {}) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : d;
  if (isNaN(dt)) return '';
  if (opts.iso) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatDateShort(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateRange(s, e) {
  return `${formatDateShort(s)} – ${formatDateShort(e)}`;
}

function todayISO() {
  return formatDate(new Date(), { iso: true });
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// ── Avatar color from name ───────────────────────────────────
const _AVATAR_COLORS = [
  '#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6',
  '#ec4899','#06b6d4','#f97316','#10b981','#6366f1'
];
function avatarColor(name = '') {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return _AVATAR_COLORS[Math.abs(hash) % _AVATAR_COLORS.length];
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

// ── Toast Notification ───────────────────────────────────────
let _toastContainer = null;
function ensureToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

function showToast(message, type = 'success', duration = 3500) {
  const container = ensureToastContainer();
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.success}</span>
    <span>${message}</span>
    <button class="toast-close" aria-label="Close">✕</button>
  `;
  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);
  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(30px)';
  toast.style.transition = 'opacity .25s, transform .25s';
  setTimeout(() => toast.remove(), 260);
}

// ── Modal helpers ────────────────────────────────────────────
function openModal(overlayId) {
  const el = document.getElementById(overlayId);
  if (el) {
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}
function closeModal(overlayId) {
  const el = document.getElementById(overlayId);
  if (el) {
    el.classList.remove('open');
    document.body.style.overflow = '';
  }
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => {
    m.classList.remove('open');
  });
  document.body.style.overflow = '';
}

// Close modal on overlay click (but not on modal itself)
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Loading state helper ─────────────────────────────────────
function showLoading(containerId, message = 'Loading…') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner spinner-lg"></div>
      <span>${message}</span>
    </div>`;
}

function showEmpty(containerId, title = 'No records found', msg = '', btnLabel = '', btnCb = null) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const btnHtml = btnLabel
    ? `<button class="btn btn-primary" id="_emptyBtn">${btnLabel}</button>`
    : '';
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <h3>${title}</h3>
      ${msg ? `<p>${msg}</p>` : ''}
      ${btnHtml}
    </div>`;
  if (btnLabel && btnCb) {
    const btn = el.querySelector('#_emptyBtn');
    if (btn) btn.addEventListener('click', btnCb);
  }
}

// ── Form validation ──────────────────────────────────────────
function validateForm(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach(field => {
    const errId = field.dataset.errorId;
    const errEl = errId ? document.getElementById(errId) : null;
    if (!field.value.trim()) {
      field.classList.add('is-invalid');
      if (errEl) errEl.textContent = 'This field is required.';
      valid = false;
    } else {
      field.classList.remove('is-invalid');
      if (errEl) errEl.textContent = '';
    }
  });
  return valid;
}

function clearFormErrors(form) {
  form.querySelectorAll('.is-invalid').forEach(f => f.classList.remove('is-invalid'));
  form.querySelectorAll('.form-error').forEach(e => e.textContent = '');
}

// ── Misc ──────────────────────────────────────────────────────
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

function getDepartments(members) {
  const set = new Set(members.filter(m => m.department).map(m => m.department));
  return [...set].sort();
}

function getYears(records) {
  const set = new Set(records.map(r => r.start_date?.slice(0, 4)).filter(Boolean));
  return [...set].sort((a, b) => b - a);
}

// ── Sidebar / navigation wiring ──────────────────────────────
function initSidebar() {
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');

  if (hamburger && sidebar && overlay) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Mark the active nav item based on current page
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    if (item.dataset.page === page) item.classList.add('active');
  });

  // Nav-item click navigation
  document.querySelectorAll('.nav-item[data-href]').forEach(item => {
    item.addEventListener('click', () => {
      window.location.href = item.dataset.href;
    });
  });
}

// ── Preset color swatches ────────────────────────────────────
const PRESET_COLORS = [
  '#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6',
  '#ec4899','#06b6d4','#f97316','#10b981','#6366f1',
  '#64748b','#dc2626','#16a34a','#d97706','#7c3aed'
];

function renderColorSwatches(containerId, currentColor, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = PRESET_COLORS.map(c => `
    <div class="color-swatch${c === currentColor ? ' selected' : ''}"
         style="background:${c}" data-color="${c}" title="${c}"></div>
  `).join('');
  container.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      onChange(sw.dataset.color);
    });
  });
}
