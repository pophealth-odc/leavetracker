/* ============================================================
   history.js — Leave History page
   ============================================================ */

let _histRecords = [];
let _histMembers = [];
let _histTypes   = [];
let _sortCol     = 'start_date';
let _sortAsc     = false;

document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();

  // Pre-fill employee filter from URL param (deep-link from team page)
  const params = new URLSearchParams(window.location.search);
  const empParam = params.get('employee');
  if (empParam) {
    const sel = document.getElementById('filterEmployee');
    if (sel) sel.value = empParam;
  }

  await loadHistoryData();

  document.getElementById('searchInput')   ?.addEventListener('input',  debounce(applyFilters, 300));
  document.getElementById('filterEmployee')?.addEventListener('change', applyFilters);
  document.getElementById('filterType')    ?.addEventListener('change', applyFilters);
  document.getElementById('filterDept')    ?.addEventListener('change', applyFilters);
  document.getElementById('filterYear')    ?.addEventListener('change', applyFilters);
  document.getElementById('filterDateFrom')?.addEventListener('change', applyFilters);
  document.getElementById('filterDateTo')  ?.addEventListener('change', applyFilters);
  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);

  // Column sort headers
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (_sortCol === col) _sortAsc = !_sortAsc;
      else { _sortCol = col; _sortAsc = true; }
      renderHistoryTable();
    });
  });

  // Detail / confirm
  document.getElementById('closeDetailBtn')  ?.addEventListener('click', () => closeModal('leaveDetailModal'));
  document.getElementById('deleteDetailBtn') ?.addEventListener('click', deleteFromDetail);
  document.getElementById('editDetailBtn')   ?.addEventListener('click', editFromDetail);
  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => closeModal('confirmModal'));
});

async function loadHistoryData() {
  showLoading('histTableBody', 'Loading history…');
  try {
    [_histRecords, _histMembers, _histTypes] = await Promise.all([
      getLeaveRecords(),
      getTeamMembers(),
      getLeaveTypes()
    ]);
    populateHistoryFilters();
    applyFilters();
  } catch (err) {
    showToast('Failed to load leave history: ' + err.message, 'error');
  }
}

function populateHistoryFilters() {
  const empSel  = document.getElementById('filterEmployee');
  const typeSel = document.getElementById('filterType');
  const deptSel = document.getElementById('filterDept');
  const yearSel = document.getElementById('filterYear');

  // Pre-selected employee from URL
  const params = new URLSearchParams(window.location.search);
  const empParam = params.get('employee');

  if (empSel) {
    empSel.innerHTML = '<option value="">All Employees</option>' +
      _histMembers.map(m => `<option value="${m.id}"${String(m.id) === empParam ? ' selected' : ''}>${escapeHtml(m.full_name)}</option>`).join('');
  }
  if (typeSel) {
    typeSel.innerHTML = '<option value="">All Leave Types</option>' +
      _histTypes.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  }
  if (deptSel) {
    const depts = getDepartments(_histMembers);
    deptSel.innerHTML = '<option value="">All Departments</option>' +
      depts.map(d => `<option value="${d}">${escapeHtml(d)}</option>`).join('');
  }
  if (yearSel) {
    const years = getYears(_histRecords);
    yearSel.innerHTML = '<option value="">All Years</option>' +
      years.map(y => `<option value="${y}">${y}</option>`).join('');
  }
}

function applyFilters() {
  const search   = (document.getElementById('searchInput')   ?.value || '').toLowerCase();
  const empF     = document.getElementById('filterEmployee') ?.value || '';
  const typeF    = document.getElementById('filterType')     ?.value || '';
  const deptF    = document.getElementById('filterDept')     ?.value || '';
  const yearF    = document.getElementById('filterYear')     ?.value || '';
  const dateFrom = document.getElementById('filterDateFrom') ?.value || '';
  const dateTo   = document.getElementById('filterDateTo')   ?.value || '';

  let records = _histRecords.filter(r => {
    if (empF  && String(r.employee_id)   !== empF)  return false;
    if (typeF && String(r.leave_type_id) !== typeF)  return false;
    if (deptF && r.profiles?.department  !== deptF)  return false;
    if (yearF && !r.start_date?.startsWith(yearF))   return false;
    if (dateFrom && r.start_date < dateFrom)          return false;
    if (dateTo   && r.end_date   > dateTo)            return false;
    if (search) {
      const hay = [r.profiles?.full_name, r.reason, r.leave_types?.name]
        .join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  renderHistoryTable(records);
}

function resetFilters() {
  ['searchInput','filterEmployee','filterType','filterDept','filterYear','filterDateFrom','filterDateTo']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  applyFilters();
}

function renderHistoryTable(records = _histRecords) {
  // Sort
  const sorted = [...records].sort((a, b) => {
    let av, bv;
    switch (_sortCol) {
      case 'name':      av = a.profiles?.full_name   || ''; bv = b.profiles?.full_name   || ''; break;
      case 'type':      av = a.leave_types?.name     || ''; bv = b.leave_types?.name     || ''; break;
      case 'start':     av = a.start_date || ''; bv = b.start_date || ''; break;
      case 'end':       av = a.end_date   || ''; bv = b.end_date   || ''; break;
      case 'days':      av = a.number_of_days; bv = b.number_of_days; break;
      default:          av = a.start_date || ''; bv = b.start_date || '';
    }
    if (av < bv) return _sortAsc ? -1 : 1;
    if (av > bv) return _sortAsc ?  1 : -1;
    return 0;
  });

  const tbody = document.getElementById('histTableBody');
  if (!tbody) return;

  // Update sort icons
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.querySelector('.sort-icon').textContent =
      th.dataset.sort === _sortCol ? (_sortAsc ? '↑' : '↓') : '↕';
  });

  if (!sorted.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state" style="padding:36px">
          <div class="empty-state-icon">📋</div>
          <h3>No records found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map(r => {
    const name = r.profiles?.full_name  || '—';
    const dept = r.profiles?.department || '';
    const type = r.leave_types?.name    || '—';
    const col  = r.leave_types?.color   || '#3b82f6';
    const bg   = avatarColor(name);
    return `
      <tr>
        <td>
          <div class="d-flex align-center gap-2">
            <div class="leave-avatar" style="background:${bg};width:28px;height:28px;font-size:.72rem">${initials(name)}</div>
            <div>
              <div style="font-weight:600">${escapeHtml(name)}</div>
              <div class="text-muted" style="font-size:.78rem">${escapeHtml(dept)}</div>
            </div>
          </div>
        </td>
        <td><span class="leave-badge" style="background:${col}">${escapeHtml(type)}</span></td>
        <td>${formatDate(r.start_date)}</td>
        <td>${formatDate(r.end_date)}</td>
        <td style="text-align:center;font-weight:600">${r.number_of_days}</td>
        <td class="text-muted" style="font-size:.82rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.reason || '—')}</td>
        <td>
          <div class="tbl-actions">
            <button class="btn btn-sm btn-secondary" onclick="openHistDetail(${r.id})">View</button>
            <button class="btn btn-sm btn-danger"    onclick="confirmDelete(${r.id})">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Detail ────────────────────────────────────────────────────
let _currentRecord = null;

async function openHistDetail(id) {
  try {
    const r = await getLeaveRecord(id);
    _currentRecord = r;
    document.getElementById('detailEmployee').textContent = r.profiles?.full_name || '—';
    document.getElementById('detailType')    .textContent = r.leave_types?.name   || '—';
    document.getElementById('detailStart')   .textContent = formatDate(r.start_date);
    document.getElementById('detailEnd')     .textContent = formatDate(r.end_date);
    document.getElementById('detailDays')    .textContent = r.number_of_days;
    document.getElementById('detailReason')  .textContent = r.reason || '—';
    openModal('leaveDetailModal');
  } catch (err) {
    showToast('Failed to load detail.', 'error');
  }
}

function editFromDetail() {
  if (!_currentRecord) return;
  closeModal('leaveDetailModal');
  window.location.href = `leave.html?edit=${_currentRecord.id}`;
}

async function deleteFromDetail() {
  if (!_currentRecord) return;
  closeModal('leaveDetailModal');
  await confirmDelete(_currentRecord.id);
}

async function confirmDelete(id) {
  const r = _histRecords.find(x => x.id === id) || await getLeaveRecord(id);
  const ok = await showConfirmDialog(
    'Delete this leave record?',
    `<strong>${escapeHtml(r.profiles?.full_name || '')}</strong><br>
     ${escapeHtml(r.leave_types?.name || '')}<br>
     ${formatDate(r.start_date)} – ${formatDate(r.end_date)}`
  );
  if (!ok) return;
  try {
    await deleteLeave(id);
    showToast('Leave record deleted.', 'success');
    await loadHistoryData();
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}

function showConfirmDialog(title, detail) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) { resolve(window.confirm(title)); return; }
    document.getElementById('confirmTitle') .textContent = title;
    document.getElementById('confirmDetail').innerHTML   = detail;
    const ok  = document.getElementById('confirmOkBtn');
    const can = document.getElementById('confirmCancelBtn');
    const done = v => { closeModal('confirmModal'); ok.onclick = null; can.onclick = null; resolve(v); };
    ok .onclick = () => done(true);
    can.onclick = () => done(false);
    openModal('confirmModal');
  });
}
