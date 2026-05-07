/* user.js — User dashboard logic */

// Init on page load
document.addEventListener('DOMContentLoaded', () => {
  initSocket(USER_ID, 'user');
  loadUserStats();
  loadActiveRequest();
  loadNotifications();
  if (typeof showSection === 'function') showSection('home');
});

// ── User Stats ────────────────────────────────────────────────
async function loadUserStats() {
  const res = await api('/api/v1/requests/history');
  if (!res.success) return;
  const reqs = res.data;
  document.getElementById('stat-total-requests').textContent = reqs.length;
  document.getElementById('stat-completed').textContent = reqs.filter(r => r.status === 'completed').length;
  const spent = reqs.reduce((s, r) => s + (r.total_amount || 0), 0);
  document.getElementById('stat-spent').textContent = fmtMoney(spent);
  document.getElementById('stat-avg-rating').textContent = '4.8';
}

// ── Service selection ─────────────────────────────────────────
function selectService(type) {
  selectedService = type;
  document.querySelectorAll('.service-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.type === type);
  });
  document.getElementById('request-form-card').style.display = 'block';
  getAIETA(type);
}

async function getAIETA(type) {
  const hour = new Date().getHours();
  const res = await api('/ai/eta', {
    method: 'POST',
    body: JSON.stringify({ distance_km: 4, service_type: type, hour })
  });
  const el = document.getElementById('ai-eta-info');
  if (el && res.total_eta_minutes) {
    el.innerHTML = `🤖 AI Estimate: <strong>${res.message}</strong>`;
  }
}

// ── Submit Request ────────────────────────────────────────────
async function submitRequest() {
  if (!selectedService) return showToast('Please select a service type', 'warning');
  if (!userLat || !userLng) return showToast('Location not detected yet', 'warning');

  const btn = document.getElementById('submit-req-btn');
  btn.disabled = true;
  btn.textContent = 'Finding mechanic...';

  const res = await api('/api/v1/requests', {
    method: 'POST',
    body: JSON.stringify({
      service_type: selectedService,
      lat: userLat, lng: userLng,
      address: document.getElementById('req-address')?.value || '',
      description: document.getElementById('req-description')?.value || ''
    })
  });

  btn.disabled = false;
  btn.textContent = '🆘 Request Assistance Now';

  if (res.success) {
    currentRequestId = res.data.id;
    showToast('✅ Request submitted! Mechanic assigned.', 'success');
    showSection('tracking');
    displayActiveRequest(res.data);
  } else {
    showToast(res.message || 'Could not find a mechanic right now.', 'danger');
  }
}

// ── Load active request ───────────────────────────────────────
async function loadActiveRequest() {
  const res = await api('/api/v1/requests/active');
  if (!res.success || !res.data) {
    return;
  }
  currentRequestId = res.data.id;
  displayActiveRequest(res.data);
}

function displayActiveRequest(req) {
  document.getElementById('no-active-request').classList.add('hidden');
  document.getElementById('active-request-card').classList.remove('hidden');
  updateStatusUI(req.status);

  if (req.mechanic) {
    document.getElementById('mechanic-detail').innerHTML = `
      <img class="mechanic-avatar" src="${req.mechanic.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.mechanic.name)}`}" />
      <div class="mechanic-info">
        <div class="mechanic-name">${req.mechanic.name}</div>
        <div class="mechanic-meta">
          <span>📞 ${req.mechanic.phone || '—'}</span>
          <span>🚗 ${req.mechanic.vehicle_number || '—'}</span>
          <span class="rating-stars">${renderStars(req.mechanic.rating)}</span>
        </div>
      </div>`;
    if (req.user_lat && req.user_lng) initTrackingMap(req.user_lat, req.user_lng);
  }
  const eta = document.getElementById('eta-display');
  if (eta && req.ai_eta_minutes) eta.textContent = `ETA: ~${req.ai_eta_minutes} mins`;
}

// ── Status UI ─────────────────────────────────────────────────
const STATUS_PROGRESS = { accepted:25, traveling:50, reached:65, in_progress:80, completed:100 };

function updateStatusUI(status) {
  document.getElementById('req-status-badge').textContent = status.replace('_', ' ');
  const pct = STATUS_PROGRESS[status] || 25;
  document.getElementById('progress-fill').style.width = pct + '%';

  const order = ['accepted','traveling','reached','in_progress','completed'];
  const idx   = order.indexOf(status);
  order.forEach((s, i) => {
    const dot = document.getElementById(`dot-${s}`);
    if (!dot) return;
    dot.classList.toggle('done', i < idx);
    dot.classList.toggle('active', i === idx);
  });

  if (status === 'completed') {
    showToast('✅ Service completed! Please rate your mechanic.', 'success');
    setTimeout(() => openModal('review-modal'), 1500);
  }
}

// ── SOS ───────────────────────────────────────────────────────
function triggerSOS() {
  if (!confirm('🚨 Send SOS alert? Emergency help will be dispatched immediately.')) return;
  navigator.geolocation?.getCurrentPosition(pos => {
    api('/api/v1/emergency/log', {
      method: 'POST',
      body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, note: 'SOS triggered' })
    });
    if (socket) socket.emit('sos_triggered', {
      user_id: USER_ID, lat: pos.coords.latitude,
      lng: pos.coords.longitude, address: 'Detected location'
    });
    showToast('🚨 SOS sent! Emergency services notified.', 'danger');
  });
}

// ── Notifications ─────────────────────────────────────────────
async function loadNotifications() {
  const res = await api('/api/v1/notifications');
  if (!res.success) return;
  const unread = res.data.filter(n => !n.is_read).length;
  const badge = document.getElementById('notif-count');
  if (badge) { badge.textContent = unread; badge.classList.toggle('hidden', unread === 0); }
}

// ── Request History ───────────────────────────────────────────
async function loadHistory() {
  const res = await api('/api/v1/requests/history');
  if (!res.success) return;
  const tbody = document.getElementById('history-body');
  if (!tbody) return;
  tbody.innerHTML = res.data.map(r => `
    <tr>
      <td class="text-xs text-muted">${fmtDate(r.requested_at)}</td>
      <td>${SERVICE_LABELS[r.service_type] || r.service_type}</td>
      <td>${r.mechanic?.name || '—'}</td>
      <td>${fmtMoney(r.total_amount)}</td>
      <td><span class="badge ${r.status==='completed'?'badge-green':r.status==='cancelled'?'badge-red':'badge-blue'}">${r.status}</span></td>
      <td>${r.status==='completed' && !r.review ? `<button class="btn btn-ghost btn-sm" onclick="openReviewModal(${r.id})">Rate</button>` : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-muted">No requests yet</td></tr>';
}

// ── Reviews ───────────────────────────────────────────────────
function openReviewModal(reqId) {
  reviewRequestId = reqId;
  selectedRating = 0;
  openModal('review-modal');
}

function setRating(val) {
  selectedRating = val;
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.v) <= val);
  });
}

async function submitReview() {
  if (!selectedRating) return showToast('Please select a rating', 'warning');
  const reqId = reviewRequestId || currentRequestId;
  if (!reqId) return;
  const res = await api('/api/v1/reviews', {
    method: 'POST',
    body: JSON.stringify({
      request_id: reqId,
      rating: selectedRating,
      comment: document.getElementById('review-comment')?.value || ''
    })
  });
  if (res.success) { showToast('⭐ Review submitted! Thank you.', 'success'); closeModal('review-modal'); }
  else showToast(res.message, 'danger');
}

// Load history when section is shown
document.querySelectorAll('[onclick*="history"]').forEach(el => {
  el.addEventListener('click', loadHistory);
});
document.querySelectorAll('[onclick*="payments"]').forEach(el => {
  el.addEventListener('click', loadPaymentHistory);
});
