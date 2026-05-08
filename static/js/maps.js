/* maps.js — Leaflet.js + OpenStreetMap (free, no API key required) */

let userMap, trackingMap, mechanicMap;
let userMarker, mechanicMarker;

// ── Custom marker icons ────────────────────────────────────────
function makeIcon(color, emoji, size = 36) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size * 0.45)}px;line-height:1;
    ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// ── User dashboard map ─────────────────────────────────────────
function initMap() {
  const el = document.getElementById('map');
  if (!el || userMap) return;

  userMap = L.map('map', {
    center: [12.9716, 77.5946],
    zoom: 13,
    zoomControl: true,
    scrollWheelZoom: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(userMap);

  // Expose globally for nearby.js
  window.userMap = userMap;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      window.userLat = userLat;
      window.userLng = userLng;

      userMap.setView([userLat, userLng], 14);

      userMarker = L.marker([userLat, userLng], { icon: makeIcon('#4A90D9', '📍', 38) })
        .addTo(userMap)
        .bindPopup('<b style="font-size:.88rem;color:#1E3A5F">📍 You are here</b>')
        .openPopup();

      // Reverse geocode via Nominatim (free)
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${userLat}&lon=${userLng}&format=json`)
        .then(r => r.json()).then(data => {
          const addr = data.display_name || 'Your location';
          const short = addr.split(',').slice(0, 3).join(',');
          const addrEl = document.getElementById('req-address');
          if (addrEl) addrEl.value = short;
          const ls = document.getElementById('location-status');
          if (ls) ls.textContent = '📍 ' + addr.split(',').slice(0, 2).join(',');
          const ms = document.getElementById('map-status');
          if (ms) ms.textContent = '📍 Location detected — loading nearby places...';
        }).catch(() => {});

      // Load nearby places
      if (typeof NearbyPlaces !== 'undefined') {
        NearbyPlaces.loadAll(userLat, userLng);
      }
      loadNearbyMechanics();
    }, () => {
      const ms = document.getElementById('map-status');
      if (ms) ms.textContent = '⚠️ Location access denied — showing default map';
      // Still load nearby for default center
      if (typeof NearbyPlaces !== 'undefined') {
        NearbyPlaces.loadAll(12.9716, 77.5946);
      }
    });
  }
}

// ── Load nearby mechanics on map ──────────────────────────────
function loadNearbyMechanics() {
  const lat = userLat || 12.9716;
  const lng = userLng || 77.5946;

  fetch(`/api/v1/mechanics/nearby?lat=${lat}&lng=${lng}`)
    .then(r => r.json()).then(res => {
      const list = document.getElementById('mechanics-list');
      if (!res.success || !res.data || !res.data.length) {
        if (list) list.innerHTML = '<div class="text-muted text-sm" style="padding:1rem">No mechanics found nearby. They may be offline.</div>';
        addDemoMechanicsToMap(lat, lng);
        return;
      }
      if (list) {
        list.innerHTML = res.data.map(m => `
          <div class="mechanic-card">
            <img class="mechanic-avatar" src="${m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=00B894&color=fff`}" />
            <div class="mechanic-info">
              <div class="mechanic-name">${m.name}</div>
              <div class="mechanic-meta">
                <span class="rating-stars">★ ${m.rating || '4.8'}</span>
                <span>📍 ${m.distance_km || '2.3'} km</span>
                <span class="badge badge-green">● Online</span>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="selectService('flat_tire');showSection('emergency')">Request</button>
          </div>`).join('');

        res.data.forEach(m => {
          if (!m.latitude || !m.longitude) return;
          L.marker([m.latitude, m.longitude], { icon: makeIcon('#00B894', '🔧', 34) })
            .addTo(userMap)
            .bindPopup(`<div style="font-size:.82rem"><strong>🔧 ${m.name}</strong><br>★ ${m.rating} · ${m.distance_km} km away</div>`);
        });
      }
    }).catch(() => addDemoMechanicsToMap(lat, lng));
}

function addDemoMechanicsToMap(lat, lng) {
  const demos = [
    { name: 'Rajan Kumar', d: [0.015, 0.008], r: 4.9 },
    { name: 'Suresh B.',   d: [-0.01, 0.02],  r: 4.7 },
    { name: 'Anand S.',    d: [0.02, -0.015], r: 4.8 },
  ];
  const list = document.getElementById('mechanics-list');
  if (list && list.querySelector('.text-muted')) {
    list.innerHTML = demos.map(m => `
      <div class="mechanic-card">
        <img class="mechanic-avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=00B894&color=fff" />
        <div class="mechanic-info">
          <div class="mechanic-name">${m.name}</div>
          <div class="mechanic-meta">
            <span class="rating-stars">★ ${m.r}</span>
            <span class="badge badge-green">● Online</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="selectService('flat_tire');showSection('emergency')">Request</button>
      </div>`).join('');
  }
  if (!userMap) return;
  demos.forEach(m => {
    L.marker([lat + m.d[0], lng + m.d[1]], { icon: makeIcon('#00B894', '🔧', 34) })
      .addTo(userMap)
      .bindPopup(`<div style="font-size:.82rem"><strong>🔧 ${m.name}</strong><br>★ ${m.r} · Demo mechanic</div>`);
  });
}

function refreshNearbyMechanics() { loadNearbyMechanics(); }

// ── Tracking map ──────────────────────────────────────────────
function initTrackingMap(lat, lng) {
  const el = document.getElementById('tracking-map');
  if (!el) return;
  if (trackingMap) { trackingMap.remove(); trackingMap = null; }

  trackingMap = L.map('tracking-map', { scrollWheelZoom: false, zoomControl: true })
    .setView([lat, lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19,
  }).addTo(trackingMap);

  L.marker([lat, lng], { icon: makeIcon('#4A90D9', '📍', 38) })
    .addTo(trackingMap)
    .bindPopup('<b style="font-size:.82rem">📍 Your Location</b>')
    .openPopup();
}

function updateMechanicMarker(lat, lng) {
  if (!trackingMap) return;
  if (!mechanicMarker) {
    mechanicMarker = L.marker([lat, lng], { icon: makeIcon('#00B894', '🔧', 38) })
      .addTo(trackingMap)
      .bindPopup('<b style="font-size:.82rem">🔧 Your Mechanic</b>');
  } else {
    mechanicMarker.setLatLng([lat, lng]);
  }
  trackingMap.setView([lat, lng], 14);
}

// ── Mechanic dashboard map ────────────────────────────────────
function initMechanicMap() {
  const el = document.getElementById('mechanic-location-map');
  if (!el || mechanicMap) return;

  mechanicMap = L.map('mechanic-location-map', { scrollWheelZoom: false, zoomControl: true })
    .setView([12.9716, 77.5946], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19,
  }).addTo(mechanicMap);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      mechanicMap.setView([lat, lng], 14);
      L.marker([lat, lng], { icon: makeIcon('#FF6B35', '📍', 38) })
        .addTo(mechanicMap)
        .bindPopup('<b style="font-size:.82rem">📍 Your Location</b>')
        .openPopup();
    });
  }
}

// Alias for mechanic dashboard callback
function initMechanicMap() {
  initMechanicMap && window._mechanicMapInit && window._mechanicMapInit();
}
window._mechanicMapInit = initMechanicMap;
