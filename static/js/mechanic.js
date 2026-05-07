/* mechanic.js — Mechanic dashboard logic */

let isOnline = false;
let activeJobRequestId = null;

document.addEventListener('DOMContentLoaded', () => {
  initSocket(MECHANIC_USER_ID, 'mechanic');
  loadMechanicStats();
  if (ACTIVE_REQUEST) showActiveJob(ACTIVE_REQUEST);
  showAdminSection = showMechanicSection;
  showMechanicSection('mhome');
});

function showMechanicSection(name) {
  document.querySelectorAll('[id^="section-m"]').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(`section-${name}`);
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const active = document.querySelector(`[onclick*="'${name}'"]`);
  if (active) active.classList.add('active');
  if (name === 'mearnings') loadEarningsCharts();
  if (name === 'mjobs')     loadJobHistory();
  if (name === 'mreviews')  loadMechanicReviews();
}

// ── Toggle online status ──────────────────────────────────────
async function toggleOnlineStatus() {
  const res = await api('/api/v1/mechanic/toggle-status', { method: 'POST' });
  if (!res.success) return showToast(res.message, 'danger');

  isOnline = res.data.is_online;
  const toggle = document.getElementById('online-toggle');
  const statusText = document.getElementById('online-status-text');
  toggle.classList.toggle('on', isOnline);
  if (statusText) statusText.textContent = isOnline ? '🟢 Online' : 'Offline';
  showToast(isOnline ? '✅ You are now online!' : '⭕ You are now offline', isOnline ? 'success' : 'info');

  if (isOnline) startSendingLocationContinuous();
  else stopSendingLocation();
}

function startSendingLocationContinuous() {
  if (!navigator.geolocation) return;
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(pos => {
      api('/api/v1/mechanic/location', {
        method: 'PATCH',
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      });
    });
  }, 8000);
}

// ── Incoming request from socket ──────────────────────────────
function showIncomingRequest(data) {
  const container = document.getElementById('incoming-requests');
  if (!container) return;
  const card = document.createElement('div');
  card.className = 'card mb-2';
  card.id = `incoming-${data.id}`;
  card.innerHTML = `
    <div class="flex items-center justify-between mb-1">
      <span class="badge badge-red">New Request</span>
      <span class="text-xs text-muted">Just now</span>
    </div>
    <div class="text-sm mb-1"><strong>${SERVICE_LABELS[data.service_type] || data.service_type}</strong></div>
    <div class="text-xs text-muted mb-2">${data.user_address || 'Location detected'}</div>
    <div class="text-sm mb-2 text-blue">₹${data.total_amount} · ${data.ai_eta_minutes} min ETA</div>
    <div class="flex gap-1">
      <button class="btn btn-success btn-sm" onclick="acceptJob(${data.id})">✅ Accept</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('incoming-${data.id}').remove()">✗ Decline</button>
    </div>`;
  container.insertBefore(card, container.firstChild);
}

async function acceptJob(requestId) {
  await api(`/api/v1/requests/${requestId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'traveling' })
  });
  showToast('✅ Job accepted! Navigate to customer.', 'success');
  document.getElementById(`incoming-${requestId}`)?.remove();
  const res = await api(`/api/v1/requests/${requestId}`);
  if (res.success) showActiveJob(res.data);
}

function showActiveJob(req) {
  activeJobRequestId = req.id;
  const card = document.getElementById('active-job-card');
  if (card) card.style.display = 'block';
  const info = document.getElementById('active-job-info');
  if (info) {
    info.innerHTML = `
      <div class="text-sm mb-1"><strong>${SERVICE_LABELS[req.service_type] || req.service_type}</strong></div>
      <div class="text-xs text-muted">📍 ${req.user_address || 'Customer location'}</div>
      <div class="text-sm text-green mt-1">₹${req.total_amount}</div>`;
  }
  const badge = document.getElementById('active-job-status');
  if (badge) badge.textContent = req.status;
  startSendingLocation(req.id, MECHANIC_USER_ID);
}

async function updateJobStatus(status) {
  if (!activeJobRequestId) return showToast('No active job', 'warning');
  if (socket) {
    socket.emit('status_update', { request_id: activeJobRequestId, status });
  }
  if (status === 'completed') {
    stopSendingLocation();
    document.getElementById('active-job-card').style.display = 'none';
    activeJobRequestId = null;
    showToast('✅ Job completed!', 'success');
  }
  const badge = document.getElementById('active-job-status');
  if (badge) badge.textContent = status;
}

// ── Stats ─────────────────────────────────────────────────────
async function loadMechanicStats() {
  // Stats would come from the server; using placeholder
  document.getElementById('m-total-jobs').textContent = '—';
  document.getElementById('m-total-earnings').textContent = '₹—';
  document.getElementById('m-rating').textContent = '—';
  document.getElementById('m-today-earnings').textContent = '₹—';
}

async function loadEarningsCharts() {
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const data   = [320, 480, 250, 610, 420, 750, 380];
  loadMechanicEarningsChart(labels, data);
  document.getElementById('earn-today').textContent = '₹' + data[new Date().getDay()];
  document.getElementById('earn-week').textContent = '₹' + data.reduce((a,b) => a+b, 0);
  document.getElementById('earn-month').textContent = '₹' + (data.reduce((a,b) => a+b, 0) * 4);
}

async function loadJobHistory() {
  const tbody = document.getElementById('mechanic-jobs-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="text-muted">No job history available.</td></tr>';
}

async function loadMechanicReviews() {
  document.getElementById('avg-rating-display').textContent = '4.8';
  document.getElementById('avg-stars').textContent = '★★★★★';
  document.getElementById('total-reviews-display').textContent = '24 reviews';
}
