/* ============================================================
   leave-types.js — Leave Types management page
   ============================================================ */

let _leaveTypesData  = [];
let _editingTypeId   = null;
let _selectedColor   = '#3b82f6';

document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();
  await loadLeaveTypes();

  document.getElementById('addTypeBtn')      ?.addEventListener('click', () => openTypeForm());
  document.getElementById('leaveTypeForm')   ?.addEventListener('submit', handleTypeSubmit);
  document.getElementById('cancelTypeBtn')   ?.addEventListener('click', () => closeModal('leaveTypeModal'));
  document.getElementById('closeTypeBtn')    ?.addEventListener('click', () => closeModal('leaveTypeModal'));
  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => closeModal('confirmModal'));
  document.getElementById('searchInput')     ?.addEventListener('input', debounce(renderTypesTable, 250));

  // Custom hex color input
  document.getElementById('colorHex')?.addEventListener('input', e => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      _selectedColor = val;
      document.querySelectorAll('.color-swatch').forEach(sw => {
        sw.classList.toggle('selected', sw.dataset.color === val);
      });
    }
  });
});

async function loadLeaveTypes() {
  showLoading('typesTableBody', 'Loading leave types…');
  try {
    _leaveTypesData = await getLeaveTypes();
    renderTypesTable();
  } catch (err) {
    showToast('Failed to load leave types: ' + err.message, 'error');
  }
}

function renderTypesTable() {
  const tbody  = document.getElementById('typesTableBody');
  if (!tbody) return;
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const rows   = _leaveTypesData.filter(t =>
    !search || t.name.toLowerCase().includes(search) || (t.description || '').toLowerCase().includes(search)
  );

  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state" style="padding:36px">
          <div class="empty-state-icon">🏷</div>
          <h3>No leave types found</h3>
          <button class="btn btn-primary" onclick="openTypeForm()">+ Add Leave Type</button>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(t => {
    const statusBadge = t.is_active
      ? `<span class="status-badge active">Active</span>`
      : `<span class="status-badge inactive">Inactive</span>`;
    const toggleBtn = t.is_active
      ? `<button class="btn btn-sm btn-secondary" onclick="toggleTypeStatus(${t.id}, false)">Deactivate</button>`
      : `<button class="btn btn-sm btn-secondary" onclick="toggleTypeStatus(${t.id}, true)">Activate</button>`;
    return `
      <tr>
        <td>
          <div class="d-flex align-center gap-2">
            <div style="width:14px;height:14px;border-radius:3px;background:${t.color};flex-shrink:0"></div>
            <strong>${escapeHtml(t.name)}</strong>
          </div>
        </td>
        <td class="text-muted">${escapeHtml(t.description || '—')}</td>
        <td>
          <div class="d-flex align-center gap-2">
            <div class="color-swatch" style="width:22px;height:22px;background:${t.color};border:none;cursor:default"></div>
            <code style="font-size:.78rem">${t.color}</code>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div class="tbl-actions">
            <button class="btn btn-sm btn-primary" onclick="openTypeForm(${t.id})">Edit</button>
            ${toggleBtn}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Form ──────────────────────────────────────────────────────
function openTypeForm(id = null) {
  _editingTypeId = id;
  const form = document.getElementById('leaveTypeForm');
  clearFormErrors(form);
  document.getElementById('typeFormTitle').textContent = id ? 'Edit Leave Type'  : 'Add Leave Type';
  document.getElementById('saveTypeBtn')  .textContent = id ? 'Update Leave Type': 'Add Leave Type';

  if (id) {
    const t = _leaveTypesData.find(x => x.id === id);
    if (t) {
      document.getElementById('typeName')       .value = t.name        || '';
      document.getElementById('typeDescription').value = t.description || '';
      document.getElementById('typeStatus')     .value = t.is_active ? 'true' : 'false';
      document.getElementById('colorHex')       .value = t.color       || '#3b82f6';
      _selectedColor = t.color || '#3b82f6';
    }
  } else {
    form.reset();
    _selectedColor = '#3b82f6';
    document.getElementById('typeStatus').value = 'true';
    document.getElementById('colorHex')  .value = '#3b82f6';
  }

  renderColorSwatches('colorSwatches', _selectedColor, c => {
    _selectedColor = c;
    document.getElementById('colorHex').value = c;
  });

  openModal('leaveTypeModal');
}

async function handleTypeSubmit(e) {
  e.preventDefault();
  if (!validateForm(e.target)) return;

  const name        = document.getElementById('typeName')       .value.trim();
  const description = document.getElementById('typeDescription').value.trim();
  const is_active   = document.getElementById('typeStatus')     .value === 'true';
  const color       = _selectedColor || '#3b82f6';

  const btn = document.getElementById('saveTypeBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (_editingTypeId) {
      await updateLeaveType(_editingTypeId, { name, description, color, is_active });
      showToast('Leave type updated.', 'success');
    } else {
      await addLeaveType({ name, description, color, is_active });
      showToast('Leave type added.', 'success');
    }
    closeModal('leaveTypeModal');
    await loadLeaveTypes();
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = _editingTypeId ? 'Update Leave Type' : 'Add Leave Type';
  }
}

async function toggleTypeStatus(id, activate) {
  const ok = await showConfirmDialog(
    `${activate ? 'Activate' : 'Deactivate'} this leave type?`,
    activate ? 'This leave type will be available for new leave records.'
             : 'This leave type will no longer appear in the add-leave form.'
  );
  if (!ok) return;
  try {
    await updateLeaveType(id, { is_active: activate });
    showToast(`Leave type ${activate ? 'activated' : 'deactivated'}.`, 'success');
    await loadLeaveTypes();
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
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
