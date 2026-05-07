/* maps.js — Leaflet.js + OpenStreetMap (no API key needed) */

let userMap, trackingMap, mechanicMap;
let userMarker, mechanicMarker;
const mechMapMarkers = {};

// ── Leaflet dark tile layer ──────────────────────────────────
function darkTile() {
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd', maxZoom: 19
  });
}
function lightTile() {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19
  });
}

// ── User dashboard map ────────────────────────────────────────
function initMap() {
  const el = document.getElementById('map');
  if (!el || userMap) return;

  userMap = L.map('map', { zoomControl: true, scrollWheelZoom: false });
  lightTile().addTo(userMap);
  userMap.setView([12.9716, 77.5946], 13);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      userMap.setView([userLat, userLng], 14);

      // User marker
      const userIcon = L.divIcon({
        html: '<div style="width:16px;height:16px;background:#4A90D9;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>',
        iconSize: [16, 16], iconAnchor: [8, 8], className: ''
      });
      userMarker = L.marker([userLat, userLng], { icon: userIcon })
        .addTo(userMap).bindPopup('📍 You are here').openPopup();

      // Reverse geocode
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${userLat}&lon=${userLng}&format=json`)
        .then(r => r.json()).then(data => {
          const addr = data.display_name || 'Your location';
          const short = addr.split(',').slice(0, 3).join(',');
          const el = document.getElementById('req-address');
          if (el) el.value = short;
          const ls = document.getElementById('location-status');
          if (ls) ls.textContent = '📍 ' + addr.split(',').slice(0, 2).join(',');
          const ms = document.getElementById('map-status');
          if (ms) ms.textContent = '📍 Location detected — loading nearby places...';
        }).catch(() => {});

      // Load real nearby places from Overpass API
      if (typeof NearbyPlaces !== 'undefined') {
        NearbyPlaces.loadAll(userLat, userLng);
      }

      loadNearbyMechanics();
    }, () => {
      const ms = document.getElementById('map-status');
      if (ms) ms.textContent = '⚠️ Location access denied — showing default map';
    });
  }
}

// ── Load nearby mechanics on map ─────────────────────────────
function loadNearbyMechanics() {
  const lat = userLat || 12.9716;
  const lng = userLng || 77.5946;

  fetch(`/api/v1/mechanics/nearby?lat=${lat}&lng=${lng}`)
    .then(r => r.json()).then(res => {
      const list = document.getElementById('mechanics-list');

      // Clear old markers
      Object.values(mechMapMarkers).forEach(m => m.remove());

      if (!res.success || !res.data || !res.data.length) {
        if (list) list.innerHTML = '<div class="text-muted text-sm" style="padding:1rem">No mechanics found nearby. They may be offline.</div>';
        // Add some demo mechanics around the user for visual testing
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
          const icon = L.divIcon({
            html: '<div style="width:14px;height:14px;background:#00B894;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
            iconSize: [14, 14], iconAnchor: [7, 7], className: ''
          });
          const mk = L.marker([m.latitude, m.longitude], { icon })
            .addTo(userMap)
            .bindPopup(`🔧 <strong>${m.name}</strong><br>★ ${m.rating} · ${m.distance_km} km away`);
          mechMapMarkers[m.id] = mk;
        });
      }
    }).catch(() => {
      addDemoMechanicsToMap(lat, lng);
    });
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
    const icon = L.divIcon({
      html: '<div style="width:14px;height:14px;background:#00B894;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7], className: ''
    });
    L.marker([lat + m.d[0], lng + m.d[1]], { icon })
      .addTo(userMap)
      .bindPopup(`🔧 <strong>${m.name}</strong><br>★ ${m.r} · Demo mechanic`);
  });
}

function refreshNearbyMechanics() { loadNearbyMechanics(); }

// ── Tracking map ─────────────────────────────────────────────
function initTrackingMap(lat, lng) {
  const el = document.getElementById('tracking-map');
  if (!el) return;
  if (trackingMap) { trackingMap.remove(); trackingMap = null; }

  trackingMap = L.map('tracking-map', { scrollWheelZoom: false });
  lightTile().addTo(trackingMap);
  trackingMap.setView([lat, lng], 14);

  const uIcon = L.divIcon({
    html: '<div style="width:16px;height:16px;background:#4A90D9;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>',
    iconSize: [16, 16], iconAnchor: [8, 8], className: ''
  });
  L.marker([lat, lng], { icon: uIcon }).addTo(trackingMap).bindPopup('📍 Your Location');
}

function updateMechanicMarker(lat, lng) {
  if (!trackingMap) return;
  const mIcon = L.divIcon({
    html: '<div style="width:18px;height:18px;background:#00B894;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>',
    iconSize: [18, 18], iconAnchor: [9, 9], className: ''
  });
  if (!mechanicMarker) {
    mechanicMarker = L.marker([lat, lng], { icon: mIcon }).addTo(trackingMap).bindPopup('🔧 Your Mechanic');
  } else {
    mechanicMarker.setLatLng([lat, lng]);
  }
  trackingMap.setView([lat, lng], 14);
}

// ── Mechanic dashboard map ───────────────────────────────────
function initMechanicMap() {
  const el = document.getElementById('mechanic-location-map');
  if (!el || mechanicMap) return;
  mechanicMap = L.map('mechanic-location-map', { scrollWheelZoom: false });
  lightTile().addTo(mechanicMap);
  mechanicMap.setView([12.9716, 77.5946], 13);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      mechanicMap.setView([lat, lng], 14);
      const icon = L.divIcon({
        html: '<div style="width:16px;height:16px;background:#FF6B35;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>',
        iconSize: [16, 16], iconAnchor: [8, 8], className: ''
      });
      L.marker([lat, lng], { icon }).addTo(mechanicMap).bindPopup('📍 Your Location');
    });
  }
}
