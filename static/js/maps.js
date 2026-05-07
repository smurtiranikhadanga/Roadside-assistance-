/* maps.js — Google Maps integration for user dashboard */

let map, trackingMap, userMarker, mechanicMarker, routeLine;
const mechMarkers = {};

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  map = new google.maps.Map(mapEl, {
    zoom: 14,
    center: { lat: 12.9716, lng: 77.5946 },
    styles: darkMapStyle(),
    disableDefaultUI: true,
    zoomControl: true,
  });

  // Get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      const latlng = { lat: userLat, lng: userLng };

      map.setCenter(latlng);
      userMarker = new google.maps.Marker({
        position: latlng, map,
        title: 'You',
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10,
                fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      });

      // Reverse geocode
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const addr = results[0].formatted_address;
          const addrInput = document.getElementById('req-address');
          if (addrInput) addrInput.value = addr;
          const locStatus = document.getElementById('location-status');
          if (locStatus) locStatus.textContent = '📍 ' + addr.split(',').slice(0,2).join(',');
        }
      });

      document.getElementById('map-status').textContent = '📍 Location detected';
      loadNearbyMechanics();
    }, () => {
      document.getElementById('map-status').textContent = '⚠️ Location access denied';
    });
  }
}

function initMechanicMap() {
  const el = document.getElementById('mechanic-location-map');
  if (!el) return;
  const center = { lat: 12.9716, lng: 77.5946 };
  map = new google.maps.Map(el, { zoom: 14, center, styles: darkMapStyle(), disableDefaultUI: true, zoomControl: true });
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setCenter(latlng);
      new google.maps.Marker({ position: latlng, map, title: 'Your Location' });
    });
  }
}

function loadNearbyMechanics() {
  if (!userLat || !userLng) return;
  api(`/api/v1/mechanics/nearby?lat=${userLat}&lng=${userLng}`).then(res => {
    if (!res.success) return;
    const list = document.getElementById('mechanics-list');
    if (!list) return;

    // Clear old markers
    Object.values(mechMarkers).forEach(m => m.setMap(null));

    if (!res.data.length) {
      list.innerHTML = '<div class="text-muted text-sm">No mechanics nearby right now.</div>';
      return;
    }

    list.innerHTML = res.data.map(m => `
      <div class="mechanic-card">
        <img class="mechanic-avatar" src="${m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1a73e8&color=fff`}" alt="${m.name}" />
        <div class="mechanic-info">
          <div class="mechanic-name">${m.name}</div>
          <div class="mechanic-meta">
            <span class="rating-stars">${renderStars(m.rating)}</span>
            <span>${m.distance_km} km</span>
            <span class="badge badge-green">Available</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="selectService('flat_tire');showSection('emergency')">Request</button>
      </div>`).join('');

    // Add map markers
    res.data.forEach(m => {
      if (!m.latitude || !m.longitude) return;
      const marker = new google.maps.Marker({
        position: { lat: m.latitude, lng: m.longitude }, map,
        title: m.name,
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 6, fillColor: '#00c853', fillOpacity: 1,
                strokeColor: '#fff', strokeWeight: 1, rotation: 0 }
      });
      const info = new google.maps.InfoWindow({
        content: `<div style="color:#000"><strong>${m.name}</strong><br>★ ${m.rating} · ${m.distance_km}km</div>`
      });
      marker.addListener('click', () => info.open(map, marker));
      mechMarkers[m.id] = marker;
    });
  });
}

function refreshNearbyMechanics() { loadNearbyMechanics(); }

// ── Tracking map ──────────────────────────────────────────────
function initTrackingMap(userLat, userLng) {
  const el = document.getElementById('tracking-map');
  if (!el) return;
  trackingMap = new google.maps.Map(el, {
    zoom: 14,
    center: { lat: userLat, lng: userLng },
    styles: darkMapStyle(),
    disableDefaultUI: true,
    zoomControl: true,
  });
  userMarker = new google.maps.Marker({
    position: { lat: userLat, lng: userLng }, map: trackingMap,
    title: 'Your Location',
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9,
            fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
  });
}

function updateMechanicMarker(lat, lng) {
  if (!trackingMap) return;
  const pos = { lat, lng };
  if (!mechanicMarker) {
    mechanicMarker = new google.maps.Marker({
      position: pos, map: trackingMap,
      title: 'Mechanic',
      icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 7, fillColor: '#00c853', fillOpacity: 1,
              strokeColor: '#fff', strokeWeight: 1 }
    });
  } else {
    mechanicMarker.setPosition(pos);
  }
  trackingMap.setCenter(pos);
}

// ── Dark map style ────────────────────────────────────────────
function darkMapStyle() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#1a1f2e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252c3b' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#17263c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1420' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  ];
}
