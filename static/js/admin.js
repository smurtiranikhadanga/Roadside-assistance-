/* admin.js — Admin dashboard logic */

document.addEventListener('DOMContentLoaded', () => {
  if (socket) initSocket('admin', 'admin');
  loadAdminCharts();
  showAdminSection('adash');
});

function showAdminSection(name) {
  document.querySelectorAll('[id^="section-a"]').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${name}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[onclick*="'${name}'"]`)?.classList.add('active');
  const titles = { adash:'Dashboard', ausers:'Users', amechanics:'Mechanics',
                   arequests:'Requests', aanalytics:'Analytics', apayments:'Payments' };
  document.getElementById('admin-page-title').textContent = titles[name] || 'Admin';
  if (name === 'aanalytics') setTimeout(loadAdminCharts, 100);
}

async function toggleBlockUser(uid, btn) {
  const res = await api(`/api/v1/admin/users/${uid}/toggle-block`, { method: 'POST' });
  if (res.success) {
    btn.textContent = res.data.is_active ? '🔒 Block' : '🔓 Unblock';
    showToast(res.data.is_active ? 'User unblocked' : 'User blocked', res.data.is_active ? 'success' : 'warning');
  }
}

async function approveMechanic(mid, btn) {
  const res = await api(`/api/v1/admin/mechanics/${mid}/approve`, { method: 'POST' });
  if (res.success) { btn.remove(); showToast('✅ Mechanic approved', 'success'); }
}

async function suspendMechanic(mid, btn) {
  const res = await api(`/api/v1/admin/mechanics/${mid}/suspend`, { method: 'POST' });
  if (res.success) {
    btn.textContent = res.data.is_suspended ? '🔓 Unsuspend' : '🚫 Suspend';
    showToast(res.data.is_suspended ? 'Mechanic suspended' : 'Mechanic unsuspended', 'info');
  }
}

function filterAdminRequests() {
  const val = document.getElementById('req-filter').value;
  document.querySelectorAll('.req-row').forEach(row => {
    row.style.display = (!val || row.dataset.status === val) ? '' : 'none';
  });
}

async function refreshAdminData() {
  const res = await api('/api/v1/admin/stats');
  if (res.success) {
    document.getElementById('active-req-count').textContent = res.data.active_requests;
    showToast('Data refreshed', 'success');
  }
}
