/* maps.js — Google Maps API */

let userMap, trackingMap, mechanicMap;
let userMarker, mechanicMarker;
const mechMapMarkers = {};

// Shared InfoWindow reused across markers on each map
let userInfoWindow = null;
let trackingInfoWindow = null;
let mechanicInfoWindow = null;

// ── User dashboard map (callback from Google Maps script) ─────
function initMap() {
  const el = document.getElementById('map');
  if (!el || userMap) return;

  userInfoWindow = new google.maps.InfoWindow();

  userMap = new google.maps.Map(el, {
    center: { lat: 12.9716, lng: 77.5946 },
    zoom: 13,
    scrollwheel: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      userMap.setCenter({ lat: userLat, lng: userLng });
      userMap.setZoom(14);

      // User marker (blue dot)
      userMarker = new google.maps.Marker({
        position: { lat: userLat, lng: userLng },
        map: userMap,
        title: 'You are here',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#4A90D9',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 999,
      });

      userInfoWindow.setContent('<div style="font-size:.85rem;font-weight:600;color:#1E3A5F">📍 You are here</div>');
      userInfoWindow.open(userMap, userMarker);

      // Reverse geocode via Nominatim
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
      Object.values(mechMapMarkers).forEach(m => m.setMap(null));

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
          const marker = new google.maps.Marker({
            position: { lat: m.latitude, lng: m.longitude },
            map: userMap,
            title: m.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#00B894',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });
          const iw = new google.maps.InfoWindow({
            content: `<div style="font-size:.82rem"><strong>🔧 ${m.name}</strong><br>★ ${m.rating} · ${m.distance_km} km away</div>`,
          });
          marker.addListener('click', () => iw.open(userMap, marker));
          mechMapMarkers[m.id] = marker;
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
    const marker = new google.maps.Marker({
      position: { lat: lat + m.d[0], lng: lng + m.d[1] },
      map: userMap,
      title: m.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#00B894',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
    const iw = new google.maps.InfoWindow({
      content: `<div style="font-size:.82rem"><strong>🔧 ${m.name}</strong><br>★ ${m.r} · Demo mechanic</div>`,
    });
    marker.addListener('click', () => iw.open(userMap, marker));
  });
}

function refreshNearbyMechanics() { loadNearbyMechanics(); }

// ── Tracking map ─────────────────────────────────────────────
function initTrackingMap(lat, lng) {
  const el = document.getElementById('tracking-map');
  if (!el) return;

  if (trackingMap) {
    trackingMap = null;
    el.innerHTML = '';
  }

  trackingInfoWindow = new google.maps.InfoWindow();

  trackingMap = new google.maps.Map(el, {
    center: { lat, lng },
    zoom: 14,
    scrollwheel: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });

  const uMarker = new google.maps.Marker({
    position: { lat, lng },
    map: trackingMap,
    title: 'Your Location',
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: '#4A90D9',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
    },
    zIndex: 999,
  });
  uMarker.addListener('click', () => {
    trackingInfoWindow.setContent('<div style="font-size:.82rem;font-weight:600">📍 Your Location</div>');
    trackingInfoWindow.open(trackingMap, uMarker);
  });
}

function updateMechanicMarker(lat, lng) {
  if (!trackingMap) return;
  if (!mechanicMarker) {
    mechanicMarker = new google.maps.Marker({
      position: { lat, lng },
      map: trackingMap,
      title: 'Your Mechanic',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#00B894',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
    });
    mechanicMarker.addListener('click', () => {
      trackingInfoWindow.setContent('<div style="font-size:.82rem;font-weight:600">🔧 Your Mechanic</div>');
      trackingInfoWindow.open(trackingMap, mechanicMarker);
    });
  } else {
    mechanicMarker.setPosition({ lat, lng });
  }
  trackingMap.setCenter({ lat, lng });
}

// ── Mechanic dashboard map ───────────────────────────────────
function initMechanicMap() {
  const el = document.getElementById('mechanic-location-map');
  if (!el || mechanicMap) return;

  mechanicInfoWindow = new google.maps.InfoWindow();

  mechanicMap = new google.maps.Map(el, {
    center: { lat: 12.9716, lng: 77.5946 },
    zoom: 13,
    scrollwheel: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      mechanicMap.setCenter({ lat, lng });
      mechanicMap.setZoom(14);
      const mk = new google.maps.Marker({
        position: { lat, lng },
        map: mechanicMap,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#FF6B35',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      mk.addListener('click', () => {
        mechanicInfoWindow.setContent('<div style="font-size:.82rem;font-weight:600">📍 Your Location</div>');
        mechanicInfoWindow.open(mechanicMap, mk);
      });
    });
  }
}
