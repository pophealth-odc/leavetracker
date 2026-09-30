/* ============================================================
   team.js — Team Members page
   ============================================================ */

let _teamMembers  = [];
let _editingMemberId = null;

document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();
  await loadTeamMembers();

  document.getElementById('addMemberBtn')    ?.addEventListener('click', () => openMemberForm());
  document.getElementById('memberForm')      ?.addEventListener('submit', handleMemberSubmit);
  document.getElementById('cancelMemberBtn') ?.addEventListener('click', () => closeModal('memberFormModal'));
  document.getElementById('closeFormBtn')    ?.addEventListener('click', () => closeModal('memberFormModal'));
  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => closeModal('confirmModal'));
  document.getElementById('filterStatus')    ?.addEventListener('change', renderTeamTable);
  document.getElementById('filterDept')      ?.addEventListener('change', renderTeamTable);
  document.getElementById('searchInput')     ?.addEventListener('input',  debounce(renderTeamTable, 250));
});

async function loadTeamMembers() {
  showLoading('teamTableBody', 'Loading team members…');
  try {
    _teamMembers = await getTeamMembers();
    populateDeptFilter();
    renderTeamTable();
  } catch (err) {
    showToast('Failed to load team members: ' + err.message, 'error');
    console.error(err);
  }
}

function populateDeptFilter() {
  const sel = document.getElementById('filterDept');
  if (!sel) return;
  const depts = getDepartments(_teamMembers);
  sel.innerHTML = '<option value="">All Departments</option>' +
    depts.map(d => `<option value="${d}">${escapeHtml(d)}</option>`).join('');
}

function renderTeamTable() {
  const tbody    = document.getElementById('teamTableBody');
  if (!tbody) return;
  const status   = document.getElementById('filterStatus')?.value || '';
  const dept     = document.getElementById('filterDept')  ?.value || '';
  const search   = (document.getElementById('searchInput')?.value || '').toLowerCase();

  let members = _teamMembers.filter(m => {
    if (status === 'active'   && !m.is_active) return false;
    if (status === 'inactive' &&  m.is_active) return false;
    if (dept   && m.department !== dept)       return false;
    if (search) {
      const hay = [m.full_name, m.email, m.department].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (!members.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state" style="padding:36px">
          <div class="empty-state-icon">👥</div>
          <h3>No team members found</h3>
          <p>Try adjusting the filters, or add a new team member.</p>
          <button class="btn btn-primary" onclick="openMemberForm()">+ Add Team Member</button>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => {
    const bg = avatarColor(m.full_name);
    const statusBadge = m.is_active
      ? `<span class="status-badge active">Active</span>`
      : `<span class="status-badge inactive">Inactive</span>`;
    const toggleBtn = m.is_active
      ? `<button class="btn btn-sm btn-secondary" onclick="toggleActive(${m.id}, false)">Deactivate</button>`
      : `<button class="btn btn-sm btn-secondary" onclick="toggleActive(${m.id}, true)">Activate</button>`;
    return `
      <tr>
        <td>
          <div class="d-flex align-center gap-2">
            <div class="leave-avatar" style="background:${bg};width:32px;height:32px;font-size:.8rem">${initials(m.full_name)}</div>
            <div>
              <div style="font-weight:600">${escapeHtml(m.full_name)}</div>
              <div class="text-muted" style="font-size:.78rem">${escapeHtml(m.email || '')}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(m.department || '—')}</td>
        <td>${statusBadge}</td>
        <td class="text-muted" style="font-size:.82rem">${formatDate(m.created_at)}</td>
        <td>
          <div class="tbl-actions">
            <button class="btn btn-sm btn-primary"   onclick="openMemberForm(${m.id})">Edit</button>
            ${toggleBtn}
            <button class="btn btn-sm btn-secondary" onclick="viewMemberLeave(${m.id})">View Leave</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Form ──────────────────────────────────────────────────────
function openMemberForm(id = null) {
  _editingMemberId = id;
  const form = document.getElementById('memberForm');
  clearFormErrors(form);
  document.getElementById('memberFormTitle').textContent = id ? 'Edit Team Member' : 'Add Team Member';
  document.getElementById('saveMemberBtn') .textContent  = id ? 'Update Member'   : 'Add Member';

  if (id) {
    const m = _teamMembers.find(x => x.id === id);
    if (m) {
      document.getElementById('memberName')  .value = m.full_name   || '';
      document.getElementById('memberEmail') .value = m.email       || '';
      document.getElementById('memberDept')  .value = m.department  || '';
      document.getElementById('memberStatus').value = m.is_active ? 'true' : 'false';
    }
  } else {
    form.reset();
    document.getElementById('memberStatus').value = 'true';
  }
  openModal('memberFormModal');
}

async function handleMemberSubmit(e) {
  e.preventDefault();
  if (!validateForm(e.target)) return;

  const full_name  = document.getElementById('memberName') .value.trim();
  const email      = document.getElementById('memberEmail').value.trim();
  const department = document.getElementById('memberDept') .value.trim();
  const is_active  = document.getElementById('memberStatus').value === 'true';

  const btn = document.getElementById('saveMemberBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (_editingMemberId) {
      await updateTeamMember(_editingMemberId, { full_name, email: email || null, department: department || null, is_active });
      showToast('Team member updated.', 'success');
    } else {
      await addTeamMember({ full_name, email, department, is_active });
      showToast('Team member added.', 'success');
    }
    closeModal('memberFormModal');
    await loadTeamMembers();
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = _editingMemberId ? 'Update Member' : 'Add Member';
  }
}

async function toggleActive(id, activate) {
  const action = activate ? 'activate' : 'deactivate';
  const ok = await showConfirmDialog(
    `${activate ? 'Activate' : 'Deactivate'} this team member?`,
    `This will mark the member as ${activate ? 'active' : 'inactive'}.<br>Historical leave records will be preserved.`
  );
  if (!ok) return;
  try {
    activate ? await activateTeamMember(id) : await deactivateTeamMember(id);
    showToast(`Team member ${action}d.`, 'success');
    await loadTeamMembers();
  } catch (err) {
    showToast(`Failed to ${action}: ` + err.message, 'error');
  }
}

function viewMemberLeave(id) {
  window.location.href = `history.html?employee=${id}`;
}

// ── Confirm dialog ────────────────────────────────────────────
function showConfirmDialog(title, detail) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) { resolve(window.confirm(title)); return; }
    document.getElementById('confirmTitle') .textContent = title;
    document.getElementById('confirmDetail').innerHTML   = detail;
    const ok  = document.getElementById('confirmOkBtn');
    const can = document.getElementById('confirmCancelBtn');
    const done = (v) => { closeModal('confirmModal'); ok.onclick = null; can.onclick = null; resolve(v); };
    ok .onclick = () => done(true);
    can.onclick = () => done(false);
    openModal('confirmModal');
  });
}
