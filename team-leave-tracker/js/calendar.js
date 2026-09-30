/* ============================================================
   calendar.js — Calendar page logic (month & week views)
   ============================================================ */

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed
let calView  = 'month'; // 'month' | 'week'
let calWeekStart = new Date(); // Monday of current week
let _calRecords  = [];
let _calHolidays = {};
let _filterEmployee = '';
let _filterType     = '';
let _filterDept     = '';

document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();

  // Set week start to this Monday
  calWeekStart = getMonday(new Date());

  await Promise.all([loadCalendarFilters(), loadCalendarData()]);

  // Controls
  document.getElementById('btnToday') ?.addEventListener('click', goToday);
  document.getElementById('btnPrev')  ?.addEventListener('click', goPrev);
  document.getElementById('btnNext')  ?.addEventListener('click', goNext);
  document.getElementById('btnMonthView')?.addEventListener('click', () => setView('month'));
  document.getElementById('btnWeekView') ?.addEventListener('click', () => setView('week'));

  document.getElementById('filterEmployee')?.addEventListener('change', e => { _filterEmployee = e.target.value; renderCalendar(); });
  document.getElementById('filterType')    ?.addEventListener('change', e => { _filterType     = e.target.value; renderCalendar(); });
  document.getElementById('filterDept')    ?.addEventListener('change', e => { _filterDept     = e.target.value; renderCalendar(); });

  document.getElementById('addLeaveBtn')?.addEventListener('click', () => openLeaveForm());

  // Modal close buttons
  document.getElementById('closeDetailBtn')  ?.addEventListener('click', () => closeModal('leaveDetailModal'));
  document.getElementById('editDetailBtn')   ?.addEventListener('click', editFromDetail);
  document.getElementById('deleteDetailBtn') ?.addEventListener('click', deleteFromDetail);
  document.getElementById('closeLeaveFormBtn')?.addEventListener('click', () => closeModal('leaveFormModal'));
  document.getElementById('cancelLeaveBtn')  ?.addEventListener('click', () => closeModal('leaveFormModal'));
  document.getElementById('leaveForm')       ?.addEventListener('submit', handleLeaveFormSubmit);
  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => closeModal('confirmModal'));
});

// ── Load filter dropdowns ────────────────────────────────────
async function loadCalendarFilters() {
  const [members, types] = await Promise.all([getTeamMembers(), getLeaveTypes()]);

  const empSel  = document.getElementById('filterEmployee');
  const typeSel = document.getElementById('filterType');
  const deptSel = document.getElementById('filterDept');

  if (empSel) {
    empSel.innerHTML = '<option value="">All Employees</option>' +
      members.map(m => `<option value="${m.id}">${escapeHtml(m.full_name)}</option>`).join('');
  }
  if (typeSel) {
    typeSel.innerHTML = '<option value="">All Leave Types</option>' +
      types.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  }
  if (deptSel) {
    const depts = getDepartments(members);
    deptSel.innerHTML = '<option value="">All Departments</option>' +
      depts.map(d => `<option value="${d}">${escapeHtml(d)}</option>`).join('');
  }

  // Populate leave form selects too
  populateLeaveFormSelects(members, types);
}

function populateLeaveFormSelects(members, types) {
  const empSel  = document.getElementById('leaveEmployee');
  const typeSel = document.getElementById('leaveType');
  if (empSel) {
    empSel.innerHTML = '<option value="">Select employee…</option>' +
      members.filter(m => m.is_active).map(m => `<option value="${m.id}">${escapeHtml(m.full_name)}</option>`).join('');
  }
  if (typeSel) {
    typeSel.innerHTML = '<option value="">Select leave type…</option>' +
      types.filter(t => t.is_active).map(t => `<option value="${t.id}" data-color="${t.color}">${escapeHtml(t.name)}</option>`).join('');
  }
}

// ── Fetch data ───────────────────────────────────────────────
async function loadCalendarData() {
  try {
    const [records, holidays] = await Promise.all([getLeaveRecords(), getAllPublicHolidays()]);
    _calRecords  = records;
    _calHolidays = {};
    holidays.forEach(h => {
      if (!_calHolidays[h.date]) _calHolidays[h.date] = [];
      _calHolidays[h.date].push(h.name);
    });
    renderCalendar();
  } catch (err) {
    showToast('Failed to load calendar data.', 'error');
    console.error(err);
  }
}

// ── Navigation ───────────────────────────────────────────────
function goToday() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  calWeekStart = getMonday(now);
  renderCalendar();
}
function goPrev() {
  if (calView === 'month') {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
  } else {
    calWeekStart = addDaysLocal(calWeekStart, -7);
  }
  renderCalendar();
}
function goNext() {
  if (calView === 'month') {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
  } else {
    calWeekStart = addDaysLocal(calWeekStart, 7);
  }
  renderCalendar();
}
function setView(v) {
  calView = v;
  document.getElementById('btnMonthView')?.classList.toggle('active', v === 'month');
  document.getElementById('btnWeekView') ?.classList.toggle('active', v === 'week');
  renderCalendar();
}

// ── Main render dispatcher ───────────────────────────────────
function renderCalendar() {
  const titleEl = document.getElementById('calTitle');
  if (calView === 'month') {
    if (titleEl) titleEl.textContent = monthLabel(calYear, calMonth);
    renderMonthView();
  } else {
    const weekEnd = addDaysLocal(calWeekStart, 6);
    if (titleEl) titleEl.textContent =
      `${formatDateShort(formatDate(calWeekStart, {iso:true}))} – ${formatDateShort(formatDate(weekEnd, {iso:true}))}`;
    renderWeekView();
  }
}

// ── Filter helper ─────────────────────────────────────────────
function filteredRecords() {
  return _calRecords.filter(r => {
    if (_filterEmployee && String(r.employee_id) !== _filterEmployee) return false;
    if (_filterType     && String(r.leave_type_id) !== _filterType)   return false;
    if (_filterDept     && r.profiles?.department !== _filterDept)     return false;
    return true;
  });
}

// ── Month View ───────────────────────────────────────────────
function renderMonthView() {
  const container = document.getElementById('calContainer');
  if (!container) return;

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);

  // Monday-first grid: find the Monday before (or on) the 1st
  let gridStart = new Date(firstDay);
  const dow = (firstDay.getDay() + 6) % 7; // Mon=0
  gridStart.setDate(gridStart.getDate() - dow);

  let gridEnd = new Date(lastDay);
  const dowEnd = (lastDay.getDay() + 6) % 7;
  gridEnd.setDate(gridEnd.getDate() + (6 - dowEnd));

  const records  = filteredRecords();
  const todayISO = formatDate(new Date(), { iso: true });

  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = `
    <div class="cal-grid">
      <div class="cal-weekdays">
        ${days.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
      </div>
      <div class="cal-days-grid">`;

  let cur = new Date(gridStart);
  while (cur <= gridEnd) {
    const iso     = formatDate(cur, { iso: true });
    const isToday = iso === todayISO;
    const isOther = cur.getMonth() !== calMonth;
    const dow2    = cur.getDay();
    const isWknd  = dow2 === 0 || dow2 === 6;
    const isHol   = !!_calHolidays[iso];

    const cellClass = [
      'cal-cell',
      isOther  ? 'other-month'    : '',
      isToday  ? 'today'          : '',
      isWknd   ? 'weekend'        : '',
      isHol    ? 'public-holiday' : ''
    ].filter(Boolean).join(' ');

    const dayRecords = records.filter(r => r.start_date <= iso && r.end_date >= iso);
    const SHOW_MAX = 3;

    let eventsHtml = '';
    if (isHol) {
      eventsHtml += _calHolidays[iso].map(n =>
        `<div class="cal-holiday-label" title="${escapeHtml(n)}">🗓 ${escapeHtml(n)}</div>`
      ).join('');
    }
    eventsHtml += dayRecords.slice(0, SHOW_MAX).map(r => {
      const name = r.profiles?.full_name || 'Unknown';
      const col  = r.leave_types?.color  || '#3b82f6';
      return `<div class="cal-event" style="background:${col}" data-id="${r.id}" onclick="openCalDetail(${r.id})" title="${escapeHtml(name)} — ${escapeHtml(r.leave_types?.name)}">${escapeHtml(name)}</div>`;
    }).join('');
    if (dayRecords.length > SHOW_MAX) {
      eventsHtml += `<div class="cal-more" onclick="showDayPopover('${iso}', event)">+${dayRecords.length - SHOW_MAX} more</div>`;
    }

    html += `
      <div class="${cellClass}" data-date="${iso}">
        <div class="cal-day-num">${cur.getDate()}</div>
        ${eventsHtml}
      </div>`;
    cur = addDaysLocal(cur, 1);
  }

  html += `</div></div>`;
  container.innerHTML = html;
}

// ── Week View ────────────────────────────────────────────────
function renderWeekView() {
  const container = document.getElementById('calContainer');
  if (!container) return;

  const todayISO = formatDate(new Date(), { iso: true });
  const records  = filteredRecords();
  const days     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let headerHtml = '';
  let eventsHtml = '';

  for (let i = 0; i < 7; i++) {
    const d   = addDaysLocal(calWeekStart, i);
    const iso = formatDate(d, { iso: true });
    const isToday = iso === todayISO;
    const dow = d.getDay();
    const isWknd = dow === 0 || dow === 6;

    headerHtml += `
      <div class="week-header-cell${isToday ? ' today' : ''}">
        <div class="wk-day">${days[i]}</div>
        <div class="wk-date">${d.getDate()}</div>
        ${_calHolidays[iso] ? `<div style="font-size:.65rem;color:#ea580c">🗓 Holiday</div>` : ''}
      </div>`;

    const dayRecs = records.filter(r => r.start_date <= iso && r.end_date >= iso);
    eventsHtml += `
      <div class="week-event-cell${isToday ? ' today' : ''}${isWknd ? ' weekend' : ''}">
        ${dayRecs.map(r => {
          const name = r.profiles?.full_name || 'Unknown';
          const col  = r.leave_types?.color  || '#3b82f6';
          return `<div class="cal-event" style="background:${col}" onclick="openCalDetail(${r.id})" title="${escapeHtml(r.leave_types?.name)}">${escapeHtml(name)}</div>`;
        }).join('')}
      </div>`;
  }

  container.innerHTML = `
    <div class="week-grid">
      <div class="week-header-row">${headerHtml}</div>
      <div class="week-events-row">${eventsHtml}</div>
    </div>`;
}

// ── Calendar event detail ─────────────────────────────────────
let _calDetailRecord = null;

async function openCalDetail(id) {
  try {
    const r = await getLeaveRecord(id);
    _calDetailRecord = r;
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
  if (!_calDetailRecord) return;
  closeModal('leaveDetailModal');
  openLeaveForm(_calDetailRecord);
}

async function deleteFromDetail() {
  if (!_calDetailRecord) return;
  const r = _calDetailRecord;
  const confirmed = await confirmAction(
    'Delete this leave record?',
    `<strong>${escapeHtml(r.profiles?.full_name)}</strong><br>
     ${escapeHtml(r.leave_types?.name)}<br>
     ${formatDate(r.start_date)} – ${formatDate(r.end_date)}`
  );
  if (!confirmed) return;
  try {
    await deleteLeave(r.id);
    closeModal('leaveDetailModal');
    showToast('Leave record deleted.', 'success');
    _calRecords = _calRecords.filter(x => x.id !== r.id);
    renderCalendar();
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}

// ── Add / Edit Leave Form ─────────────────────────────────────
let _editingLeaveId = null;

function openLeaveForm(record = null) {
  _editingLeaveId = record?.id || null;
  const form = document.getElementById('leaveForm');
  clearFormErrors(form);
  document.getElementById('leaveFormTitle').textContent = record ? 'Edit Leave' : 'Add Leave';

  document.getElementById('leaveEmployee').value  = record?.employee_id  || '';
  document.getElementById('leaveType')    .value  = record?.leave_type_id || '';
  document.getElementById('leaveStart')   .value  = record?.start_date   || '';
  document.getElementById('leaveEnd')     .value  = record?.end_date     || '';
  document.getElementById('leaveReason')  .value  = record?.reason       || '';

  updateWorkingDaysDisplay();
  openModal('leaveFormModal');
}

async function updateWorkingDaysDisplay() {
  const s = document.getElementById('leaveStart')?.value;
  const e = document.getElementById('leaveEnd')  ?.value;
  const el = document.getElementById('workingDaysDisplay');
  if (!el) return;
  if (s && e && s <= e) {
    el.innerHTML = `<div class="working-days-display">Working days: <strong id="wdCount">…</strong></div>`;
    clearHolidayCache();
    const days = await calculateWorkingDays(s, e);
    const wd = document.getElementById('wdCount');
    if (wd) wd.textContent = days;
  } else {
    el.innerHTML = '';
  }
}

document.getElementById('leaveStart')?.addEventListener('change', updateWorkingDaysDisplay);
document.getElementById('leaveEnd')  ?.addEventListener('change', updateWorkingDaysDisplay);

async function handleLeaveFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;

  const employeeId  = document.getElementById('leaveEmployee').value;
  const leaveTypeId = document.getElementById('leaveType').value;
  const startDate   = document.getElementById('leaveStart').value;
  const endDate     = document.getElementById('leaveEnd').value;
  const reason      = document.getElementById('leaveReason').value.trim();

  if (endDate < startDate) {
    showToast('End date cannot be before start date.', 'error'); return;
  }

  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    clearHolidayCache();
    const days = await calculateWorkingDays(startDate, endDate);
    const payload = {
      employee_id: Number(employeeId),
      leave_type_id: Number(leaveTypeId),
      start_date: startDate,
      end_date: endDate,
      number_of_days: days,
      reason
    };

    if (_editingLeaveId) {
      await updateLeave(_editingLeaveId, payload);
      showToast('Leave record updated successfully.', 'success');
    } else {
      await addLeave(payload);
      showToast('Leave record added successfully.', 'success');
    }

    closeModal('leaveFormModal');
    await loadCalendarData();
  } catch (err) {
    showToast('Failed to save leave: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = _editingLeaveId ? 'Update Leave' : 'Save Leave';
  }
}

// ── "Day popover" — show all events for a given date ─────────
function showDayPopover(iso, event) {
  event.stopPropagation();
  const records = filteredRecords().filter(r => r.start_date <= iso && r.end_date >= iso);
  // Simple: open a tiny inline summary in a toast-like element
  const names = records.map(r =>
    `${escapeHtml(r.profiles?.full_name || '?')} (${escapeHtml(r.leave_types?.name || 'Leave')})`
  ).join('\n');
  alert(`Leave on ${formatDate(iso + 'T00:00:00')}:\n\n${names}`);
}

// ── Confirm dialog ────────────────────────────────────────────
function confirmAction(title, detailHtml) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) { resolve(window.confirm(title)); return; }
    document.getElementById('confirmTitle') .textContent = title;
    document.getElementById('confirmDetail').innerHTML   = detailHtml;
    const btnOk  = document.getElementById('confirmOkBtn');
    const btnCan = document.getElementById('confirmCancelBtn');
    const cleanup = () => { closeModal('confirmModal'); btnOk.onclick = null; btnCan.onclick = null; };
    btnOk .onclick = () => { cleanup(); resolve(true); };
    btnCan.onclick = () => { cleanup(); resolve(false); };
    openModal('confirmModal');
  });
}

// ── Date helpers ──────────────────────────────────────────────
function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day === 0) ? -6 : 1 - day; // Mon first
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDaysLocal(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
