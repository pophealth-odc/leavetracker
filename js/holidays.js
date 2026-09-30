/* ============================================================
   holidays.js — Public Holidays management page
   ============================================================ */

let _holidays       = [];
let _editingHolidayId = null;

document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();
  await loadHolidaysPage();

  document.getElementById('addHolidayBtn')   ?.addEventListener('click', () => openHolidayForm());
  document.getElementById('holidayForm')     ?.addEventListener('submit', handleHolidaySubmit);
  document.getElementById('cancelHolidayBtn')?.addEventListener('click', () => closeModal('holidayModal'));
  document.getElementById('closeHolidayBtn') ?.addEventListener('click', () => closeModal('holidayModal'));
  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => closeModal('confirmModal'));
  document.getElementById('filterYear')      ?.addEventListener('change', renderHolidaysTable);
  document.getElementById('searchInput')     ?.addEventListener('input',  debounce(renderHolidaysTable, 250));
});

async function loadHolidaysPage() {
  showLoading('holidaysTableBody', 'Loading holidays…');
  try {
    _holidays = await getAllPublicHolidays();
    populateYearFilter();
    renderHolidaysTable();
    clearHolidayCache(); // reset working-day cache
  } catch (err) {
    showToast('Failed to load holidays: ' + err.message, 'error');
  }
}

function populateYearFilter() {
  const sel = document.getElementById('filterYear');
  if (!sel) return;
  const years = [...new Set(_holidays.map(h => h.year || h.date?.slice(0,4)))].sort((a,b) => b - a);
  const cur   = new Date().getFullYear();
  const options = ['<option value="">All Years</option>',
    ...years.map(y => `<option value="${y}"${String(y) === String(cur) ? ' selected' : ''}>${y}</option>`)
  ].join('');
  sel.innerHTML = options;
}

function renderHolidaysTable() {
  const tbody  = document.getElementById('holidaysTableBody');
  if (!tbody) return;
  const yearF  = document.getElementById('filterYear') ?.value || '';
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();

  let rows = _holidays.filter(h => {
    if (yearF && String(h.year || h.date?.slice(0,4)) !== yearF) return false;
    if (search && !h.name.toLowerCase().includes(search)) return false;
    return true;
  });

  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state" style="padding:36px">
          <div class="empty-state-icon">📆</div>
          <h3>No public holidays found</h3>
          <p>Add holidays to exclude them from working-day calculations.</p>
          <button class="btn btn-primary" onclick="openHolidayForm()">+ Add Holiday</button>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(h => `
    <tr>
      <td style="font-weight:600">${formatDate(h.date)}</td>
      <td>${escapeHtml(h.name)}</td>
      <td class="text-muted">${h.year || h.date?.slice(0,4)}</td>
      <td>
        <div class="tbl-actions">
          <button class="btn btn-sm btn-primary"   onclick="openHolidayForm(${h.id})">Edit</button>
          <button class="btn btn-sm btn-danger"    onclick="confirmDeleteHoliday(${h.id})">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Form ──────────────────────────────────────────────────────
function openHolidayForm(id = null) {
  _editingHolidayId = id;
  const form = document.getElementById('holidayForm');
  clearFormErrors(form);
  document.getElementById('holidayFormTitle').textContent = id ? 'Edit Holiday'  : 'Add Holiday';
  document.getElementById('saveHolidayBtn')  .textContent = id ? 'Update Holiday': 'Add Holiday';

  if (id) {
    const h = _holidays.find(x => x.id === id);
    if (h) {
      document.getElementById('holidayName').value = h.name || '';
      document.getElementById('holidayDate').value = h.date || '';
    }
  } else {
    form.reset();
  }
  openModal('holidayModal');
}

async function handleHolidaySubmit(e) {
  e.preventDefault();
  if (!validateForm(e.target)) return;

  const name = document.getElementById('holidayName').value.trim();
  const date = document.getElementById('holidayDate').value;

  const btn = document.getElementById('saveHolidayBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (_editingHolidayId) {
      await updatePublicHoliday(_editingHolidayId, { name, date });
      showToast('Holiday updated.', 'success');
    } else {
      await addPublicHoliday({ name, date });
      showToast('Holiday added.', 'success');
    }
    closeModal('holidayModal');
    clearHolidayCache();
    await loadHolidaysPage();
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = _editingHolidayId ? 'Update Holiday' : 'Add Holiday';
  }
}

async function confirmDeleteHoliday(id) {
  const h = _holidays.find(x => x.id === id);
  const ok = await showConfirmDialog(
    'Delete this public holiday?',
    `<strong>${escapeHtml(h?.name || 'Holiday')}</strong><br>${formatDate(h?.date)}<br><br>This will affect working-day calculations.`
  );
  if (!ok) return;
  try {
    await deletePublicHoliday(id);
    clearHolidayCache();
    showToast('Holiday deleted.', 'success');
    await loadHolidaysPage();
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
