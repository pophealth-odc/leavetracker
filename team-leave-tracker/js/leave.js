/* ============================================================
   leave.js — Leave management page (add / edit / delete / view)
   ============================================================ */

let _leaveRecords = [];
let _leaveMembers = [];
let _leaveTypes   = [];
let _editingId    = null;

document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();
  await loadLeavePageData();

  document.getElementById('addLeaveBtn')   ?.addEventListener('click', () => openLeaveForm());
  document.getElementById('leaveForm')     ?.addEventListener('submit', handleLeaveSubmit);
  document.getElementById('cancelLeaveBtn')?.addEventListener('click', () => closeModal('leaveFormModal'));
  document.getElementById('closeFormBtn')  ?.addEventListener('click', () => closeModal('leaveFormModal'));
  document.getElementById('closeDetailBtn')?.addEventListener('click', () => closeModal('leaveDetailModal'));
  document.getElementById('editDetailBtn') ?.addEventListener('click', editFromDetail);
  document.getElementById('deleteDetailBtn')?.addEventListener('click', deleteFromDetail);
  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => closeModal('confirmModal'));

  document.getElementById('leaveStart')?.addEventListener('change', updateWD);
  document.getElementById('leaveEnd')  ?.addEventListener('change', updateWD);

  // Filters
  document.getElementById('filterEmployee')?.addEventListener('change', renderTable);
  document.getElementById('filterType')    ?.addEventListener('change', renderTable);
  document.getElementById('filterDept')    ?.addEventListener('change', renderTable);
  document.getElementById('searchInput')   ?.addEventListener('input',  debounce(renderTable, 300));
});

async function loadLeavePageData() {
  showLoading('leaveTableBody', 'Loading leave records…');
  try {
    [_leaveRecords, _leaveMembers, _leaveTypes] = await Promise.all([
      getLeaveRecords(),
      getTeamMembers(),
      getLeaveTypes()
    ]);
    populateFilters();
    renderTable();
  } catch (err) {
    showToast('Failed to load leave data: ' + err.message, 'error');
    console.error(err);
  }
}

function populateFilters() {
  const empSel  = document.getElementById('filterEmployee');
  const typeSel = document.getElementById('filterType');
  const deptSel = document.getElementById('filterDept');
  const formEmp = document.getElementById('leaveEmployee');
  const formTyp = document.getElementById('leaveType');

  if (empSel) {
    empSel.innerHTML = '<option value="">All Employees</option>' +
      _leaveMembers.map(m => `<option value="${m.id}">${escapeHtml(m.full_name)}</option>`).join('');
  }
  if (typeSel) {
    typeSel.innerHTML = '<option value="">All Leave Types</option>' +
      _leaveTypes.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  }
  if (deptSel) {
    const depts = getDepartments(_leaveMembers);
    deptSel.innerHTML = '<option value="">All Departments</option>' +
      depts.map(d => `<option value="${d}">${escapeHtml(d)}</option>`).join('');
  }
  if (formEmp) {
    formEmp.innerHTML = '<option value="">Select employee…</option>' +
      _leaveMembers.filter(m => m.is_active).map(m => `<option value="${m.id}">${escapeHtml(m.full_name)}</option>`).join('');
  }
  if (formTyp) {
    formTyp.innerHTML = '<option value="">Select leave type…</option>' +
      _leaveTypes.filter(t => t.is_active).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  }
}

// ── Table rendering ───────────────────────────────────────────
function getFilteredRecords() {
  const empF   = document.getElementById('filterEmployee')?.value || '';
  const typeF  = document.getElementById('filterType')?.value     || '';
  const deptF  = document.getElementById('filterDept')?.value     || '';
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();

  return _leaveRecords.filter(r => {
    if (empF  && String(r.employee_id)   !== empF)                  return false;
    if (typeF && String(r.leave_type_id) !== typeF)                 return false;
    if (deptF && r.profiles?.department  !== deptF)                 return false;
    if (search) {
      const hay = [r.profiles?.full_name, r.reason, r.leave_types?.name]
        .join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function renderTable() {
  const tbody = document.getElementById('leaveTableBody');
  if (!tbody) return;
  const records = getFilteredRecords();

  if (!records.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state" style="padding:36px">
          <div class="empty-state-icon">📋</div>
          <h3>No leave records found</h3>
          <p>Try adjusting the filters, or add a new leave record.</p>
          <button class="btn btn-primary" onclick="openLeaveForm()">+ Add Leave</button>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const name   = r.profiles?.full_name   || '—';
    const dept   = r.profiles?.department  || '';
    const type   = r.leave_types?.name     || '—';
    const col    = r.leave_types?.color    || '#3b82f6';
    const bg     = avatarColor(name);
    return `
      <tr>
        <td>
          <div class="d-flex align-center gap-2">
            <div class="leave-avatar" style="background:${bg};width:30px;height:30px;font-size:.75rem">${initials(name)}</div>
            <div>
              <div style="font-weight:600">${escapeHtml(name)}</div>
              <div class="text-muted" style="font-size:.78rem">${escapeHtml(dept)}</div>
            </div>
          </div>
        </td>
        <td><span class="leave-badge" style="background:${col}">${escapeHtml(type)}</span></td>
        <td>${formatDate(r.start_date)}</td>
        <td>${formatDate(r.end_date)}</td>
        <td>${r.number_of_days}</td>
        <td class="text-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.reason || '—')}</td>
        <td>
          <div class="tbl-actions">
            <button class="btn btn-sm btn-secondary" onclick="openLeaveDetail(${r.id})">View</button>
            <button class="btn btn-sm btn-primary"   onclick="openLeaveEdit(${r.id})">Edit</button>
            <button class="btn btn-sm btn-danger"    onclick="confirmDeleteLeave(${r.id})">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Detail modal ──────────────────────────────────────────────
let _detailRecord = null;

async function openLeaveDetail(id) {
  try {
    const r = await getLeaveRecord(id);
    _detailRecord = r;
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
  if (!_detailRecord) return;
  closeModal('leaveDetailModal');
  openLeaveForm(_detailRecord);
}

async function deleteFromDetail() {
  if (!_detailRecord) return;
  closeModal('leaveDetailModal');
  await confirmDeleteLeave(_detailRecord.id);
}

// ── Add / Edit form ───────────────────────────────────────────
function openLeaveForm(record = null) {
  _editingId = record?.id || null;
  const form = document.getElementById('leaveForm');
  clearFormErrors(form);
  document.getElementById('leaveFormTitle').textContent = record ? 'Edit Leave' : 'Add Leave';
  document.getElementById('saveLeaveBtn').textContent   = record ? 'Update Leave' : 'Save Leave';
  document.getElementById('leaveEmployee').value = record?.employee_id   || '';
  document.getElementById('leaveType')    .value = record?.leave_type_id || '';
  document.getElementById('leaveStart')   .value = record?.start_date    || '';
  document.getElementById('leaveEnd')     .value = record?.end_date      || '';
  document.getElementById('leaveReason')  .value = record?.reason        || '';
  updateWD();
  openModal('leaveFormModal');
}

function openLeaveEdit(id) {
  const r = _leaveRecords.find(x => x.id === id);
  if (r) openLeaveForm(r);
}

async function updateWD() {
  const s  = document.getElementById('leaveStart')?.value;
  const e  = document.getElementById('leaveEnd')  ?.value;
  const el = document.getElementById('workingDaysDisplay');
  if (!el) return;
  if (s && e && s <= e) {
    el.innerHTML = `Working days: <strong id="wdCount">…</strong>`;
    clearHolidayCache();
    const days = await calculateWorkingDays(s, e);
    const wd = document.getElementById('wdCount');
    if (wd) wd.textContent = days;
  } else {
    el.innerHTML = '';
  }
}

async function handleLeaveSubmit(e) {
  e.preventDefault();
  if (!validateForm(e.target)) return;

  const empId  = document.getElementById('leaveEmployee').value;
  const typeId = document.getElementById('leaveType').value;
  const start  = document.getElementById('leaveStart').value;
  const end    = document.getElementById('leaveEnd').value;
  const reason = document.getElementById('leaveReason').value.trim();

  if (end < start) { showToast('End date cannot be before start date.', 'error'); return; }

  const btn = document.getElementById('saveLeaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    clearHolidayCache();
    const days = await calculateWorkingDays(start, end);
    const payload = {
      employee_id: Number(empId),
      leave_type_id: Number(typeId),
      start_date: start,
      end_date: end,
      number_of_days: days,
      reason
    };
    if (_editingId) {
      await updateLeave(_editingId, payload);
      showToast('Leave updated successfully.', 'success');
    } else {
      await addLeave(payload);
      showToast('Leave added successfully.', 'success');
    }
    closeModal('leaveFormModal');
    await loadLeavePageData();
  } catch (err) {
    showToast('Failed to save leave: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = _editingId ? 'Update Leave' : 'Save Leave';
  }
}

// ── Delete ────────────────────────────────────────────────────
async function confirmDeleteLeave(id) {
  const r = _leaveRecords.find(x => x.id === id) || await getLeaveRecord(id);
  const ok = await showConfirmDialog(
    'Delete this leave record?',
    `<strong>${escapeHtml(r.profiles?.full_name || r.employee_id)}</strong><br>
     ${escapeHtml(r.leave_types?.name || r.leave_type_id)}<br>
     ${formatDate(r.start_date)} – ${formatDate(r.end_date)}`
  );
  if (!ok) return;
  try {
    await deleteLeave(id);
    showToast('Leave record deleted.', 'success');
    await loadLeavePageData();
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
    const done = (val) => { closeModal('confirmModal'); ok.onclick = null; can.onclick = null; resolve(val); };
    ok .onclick = () => done(true);
    can.onclick = () => done(false);
    openModal('confirmModal');
  });
}
