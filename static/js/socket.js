/* socket.js — SocketIO client for all dashboards */

let socket;

function initSocket(userId, role) {
  socket = io();

  socket.on('connect', () => {
    socket.emit('join', { role, id: userId });
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('joined', d => console.log('[Socket] Joined room:', d.room));

  // Request accepted by mechanic
  socket.on('request_accepted', data => {
    showToast(`✅ Mechanic assigned! ETA: ${data.ai_eta_minutes} mins`, 'success');
    if (typeof handleRequestAccepted === 'function') handleRequestAccepted(data);
  });

  // Mechanic live location
  socket.on('mechanic_position', data => {
    if (typeof updateMechanicMarker === 'function') updateMechanicMarker(data.lat, data.lng);
    const eta = document.getElementById('eta-display');
    if (eta && data.eta_minutes) eta.textContent = `ETA: ~${data.eta_minutes} mins`;
  });

  // Status changed
  socket.on('request_status_changed', data => {
    showToast(data.message, data.status === 'completed' ? 'success' : 'info');
    if (typeof updateStatusUI === 'function') updateStatusUI(data.status);
    if (data.status === 'completed') {
      setTimeout(() => openModal('review-modal'), 1500);
    }
  });

  // Chat message
  socket.on('chat_message', data => {
    appendChatMessage(data.content, data.sender_role === 'mechanic' ? 'bot' : 'user');
  });

  // Payment success
  socket.on('payment_success', () => showToast('💳 Payment confirmed!', 'success'));

  // SOS confirmed
  socket.on('sos_confirmed', d => showToast(d.message, 'danger'));

  // New job (mechanic side)
  socket.on('new_job', data => {
    showToast('📥 New request received!', 'info');
    if (typeof showIncomingRequest === 'function') showIncomingRequest(data);
  });

  // Admin SOS alert
  socket.on('sos_alert', data => {
    showToast(`🚨 SOS from user ${data.user_id} at ${data.address}`, 'danger');
  });

  socket.on('disconnect', () => console.log('[Socket] Disconnected'));
}

// ── Mechanic sends live GPS ───────────────────────────────────
let locationInterval = null;

function startSendingLocation(requestId, mechanicId) {
  if (locationInterval) clearInterval(locationInterval);
  locationInterval = setInterval(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      socket.emit('mechanic_location_update', {
        mechanic_id: mechanicId,
        request_id: requestId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    });
  }, 5000);
}

function stopSendingLocation() {
  if (locationInterval) { clearInterval(locationInterval); locationInterval = null; }
}

// ── Chat helpers ──────────────────────────────────────────────
function sendChatMessage() {
  const input = document.getElementById('chat-input-field');
  if (!input || !input.value.trim() || !currentRequestId) return;
  const content = input.value.trim();
  socket.emit('chat_send', {
    request_id: currentRequestId,
    sender_id: USER_ID,
    sender_role: 'user',
    content,
  });
  appendChatMessage(content, 'user');
  input.value = '';
}

function appendChatMessage(content, side) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `chat-msg ${side}`;
  el.textContent = content;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}
