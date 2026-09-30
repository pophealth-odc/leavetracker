/* ============================================================
   dashboard.js — Dashboard page logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();
  await loadDashboard();
});

async function loadDashboard() {
  showLoading('statCards', 'Loading dashboard…');
  showLoading('onLeaveList', '');
  showLoading('upcomingList', '');

  try {
    const stats = await getDashboardStats();
    renderStatCards(stats);
    renderOnLeaveList(stats.onLeaveToday);
    renderUpcomingList(stats.upcomingLeave);
  } catch (err) {
    console.error(err);
    showToast('Failed to load dashboard. Check your Supabase configuration.', 'error');
    document.getElementById('statCards').innerHTML =
      `<p class="text-danger" style="padding:16px">Unable to load data. ${escapeHtml(err.message)}</p>`;
  }
}

function renderStatCards(stats) {
  const container = document.getElementById('statCards');
  if (!container) return;
  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon blue">👥</div>
      <div class="stat-info">
        <div class="stat-value">${stats.totalMembers}</div>
        <div class="stat-label">Total Team Members</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">🌴</div>
      <div class="stat-info">
        <div class="stat-value">${stats.onLeaveToday.length}</div>
        <div class="stat-label">On Leave Today</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange">📅</div>
      <div class="stat-info">
        <div class="stat-value">${stats.upcomingLeave.length}</div>
        <div class="stat-label">Upcoming Leave (30 days)</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon purple">📋</div>
      <div class="stat-info">
        <div class="stat-value">${stats.leaveThisMonth}</div>
        <div class="stat-label">Leave Records This Month</div>
      </div>
    </div>
  `;
}

function renderOnLeaveList(records) {
  const container = document.getElementById('onLeaveList');
  if (!container) return;

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:28px">
        <div class="empty-state-icon" style="font-size:2rem">🎉</div>
        <h3>Everyone is in today!</h3>
        <p>No one is currently on leave.</p>
      </div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const name = r.profiles?.full_name || 'Unknown';
    const type = r.leave_types?.name   || 'Leave';
    const col  = r.leave_types?.color  || '#3b82f6';
    const bg   = avatarColor(name);
    return `
      <div class="leave-list-item" onclick="openLeaveDetail(${r.id})">
        <div class="leave-avatar" style="background:${bg}">${initials(name)}</div>
        <div class="leave-list-info">
          <div class="leave-list-name">${escapeHtml(name)}</div>
          <div class="leave-list-meta">${escapeHtml(r.profiles?.department || '')}</div>
        </div>
        <span class="leave-badge" style="background:${col}">${escapeHtml(type)}</span>
      </div>`;
  }).join('');
}

function renderUpcomingList(records) {
  const container = document.getElementById('upcomingList');
  if (!container) return;

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:28px">
        <div class="empty-state-icon" style="font-size:2rem">📅</div>
        <h3>No upcoming leave</h3>
        <p>No leave scheduled in the next 30 days.</p>
      </div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const name = r.profiles?.full_name || 'Unknown';
    const type = r.leave_types?.name   || 'Leave';
    const col  = r.leave_types?.color  || '#3b82f6';
    const startDt = new Date(r.start_date + 'T00:00:00');
    const bg = avatarColor(name);
    return `
      <div class="upcoming-item" onclick="openLeaveDetail(${r.id})">
        <div class="upcoming-date-badge">
          <div class="day">${startDt.getDate()}</div>
          <div class="month">${startDt.toLocaleString('en-GB',{month:'short'})}</div>
        </div>
        <div class="upcoming-info">
          <div class="upcoming-name">
            <span class="leave-avatar" style="background:${bg};display:inline-flex;width:22px;height:22px;font-size:0.65rem;vertical-align:middle;margin-right:5px">${initials(name)}</span>
            ${escapeHtml(name)}
          </div>
          <span class="leave-badge" style="background:${col};font-size:0.7rem">${escapeHtml(type)}</span>
          <div class="upcoming-range">${formatDateRange(r.start_date, r.end_date)} &nbsp;·&nbsp; ${r.number_of_days} day${r.number_of_days !== 1 ? 's' : ''}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Leave detail modal (shared across pages) ─────────────────
let _detailRecord = null;

async function openLeaveDetail(id) {
  try {
    const r = await getLeaveRecord(id);
    _detailRecord = r;
    const el = document.getElementById('leaveDetailModal');
    if (!el) { window.location.href = `pages/leave.html`; return; }

    document.getElementById('detailEmployee') .textContent = r.profiles?.full_name || '—';
    document.getElementById('detailType')     .textContent = r.leave_types?.name   || '—';
    document.getElementById('detailStart')    .textContent = formatDate(r.start_date);
    document.getElementById('detailEnd')      .textContent = formatDate(r.end_date);
    document.getElementById('detailDays')     .textContent = r.number_of_days;
    document.getElementById('detailReason')   .textContent = r.reason || '—';
    openModal('leaveDetailModal');
  } catch (err) {
    showToast('Failed to load leave detail.', 'error');
  }
}

function closeLeaveDetail() { closeModal('leaveDetailModal'); }

async function deleteLeaveFromDetail() {
  if (!_detailRecord) return;
  const r = _detailRecord;
  const confirmed = await showConfirm(
    'Delete this leave record?',
    `<strong>${escapeHtml(r.profiles?.full_name)}</strong><br>
     ${escapeHtml(r.leave_types?.name)}<br>
     ${formatDate(r.start_date)} – ${formatDate(r.end_date)}`
  );
  if (!confirmed) return;
  try {
    await deleteLeave(r.id);
    closeLeaveDetail();
    showToast('Leave record deleted.', 'success');
    await loadDashboard();
  } catch (err) {
    showToast('Failed to delete leave: ' + err.message, 'error');
  }
}

// ── Confirmation dialog ───────────────────────────────────────
function showConfirm(title, detailHtml) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) { resolve(window.confirm(title)); return; }
    document.getElementById('confirmTitle').textContent  = title;
    document.getElementById('confirmDetail').innerHTML   = detailHtml;
    const btnOk  = document.getElementById('confirmOkBtn');
    const btnCan = document.getElementById('confirmCancelBtn');
    const cleanup = () => { closeModal('confirmModal'); btnOk.onclick = null; btnCan.onclick = null; };
    btnOk .onclick = () => { cleanup(); resolve(true); };
    btnCan.onclick = () => { cleanup(); resolve(false); };
    openModal('confirmModal');
  });
}
