/* ═══════════════════════════════════════════════════════════════
   nearby.js — Real places from Overpass API (OSM) + OSRM routing
   Petrol pumps, mechanics, toll gates — displayed on Google Maps
═══════════════════════════════════════════════════════════════ */

const NearbyPlaces = {
  cache: {},
  // markers.all stores {marker, infoWindow, lat, lng} objects
  markers: { fuel: [], mechanic: [], toll: [], all: [] },
  selectedPlace: null,

  CATEGORIES: {
    fuel: {
      label: 'Petrol Pumps',
      icon:  '⛽',
      color: '#FF6B35',
      query: (lat, lng, r) =>
        `[out:json][timeout:20];(node["amenity"="fuel"](around:${r},${lat},${lng});way["amenity"="fuel"](around:${r},${lat},${lng}););out center;`,
      markerColor: '#FF6B35',
    },
    mechanic: {
      label: 'Mechanics / Garages',
      icon:  '🔧',
      color: '#00B894',
      query: (lat, lng, r) =>
        `[out:json][timeout:20];(node["shop"="car_repair"](around:${r},${lat},${lng});node["amenity"="car_repair"](around:${r},${lat},${lng});way["shop"="car_repair"](around:${r},${lat},${lng}););out center;`,
      markerColor: '#00B894',
    },
    toll: {
      label: 'Toll Gates',
      icon:  '🛣️',
      color: '#6C5CE7',
      query: (lat, lng, r) =>
        `[out:json][timeout:20];(node["barrier"="toll_booth"](around:${r},${lat},${lng});node["highway"="toll_booth"](around:${r},${lat},${lng}););out center;`,
      markerColor: '#6C5CE7',
    },
  },

  // ── Fetch from Overpass ─────────────────────────────────────
  async fetchCategory(cat, lat, lng, radiusM = 5000) {
    const key = `${cat}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
    if (this.cache[key]) return this.cache[key];

    const query = this.CATEGORIES[cat].query(lat, lng, radiusM);
    const url   = 'https://overpass-api.de/api/interpreter';

    try {
      const res  = await fetch(url, { method: 'POST', body: query });
      const data = await res.json();
      const places = data.elements.map(el => ({
        id:   el.id,
        lat:  el.lat || el.center?.lat,
        lng:  el.lon || el.center?.lon,
        name: el.tags?.name || el.tags?.['name:en'] || this.CATEGORIES[cat].label,
        brand: el.tags?.brand || '',
        phone: el.tags?.phone || el.tags?.['contact:phone'] || '',
        addr:  [el.tags?.['addr:housenumber'], el.tags?.['addr:street'], el.tags?.['addr:city']].filter(Boolean).join(', '),
        open:  el.tags?.opening_hours || '',
        cat,
      })).filter(p => p.lat && p.lng);

      this.cache[key] = places;
      return places;
    } catch (e) {
      console.warn('Overpass error:', e);
      return [];
    }
  },

  // ── OSRM routing — travel time + distance ──────────────────
  async getRoute(fromLat, fromLng, toLat, toLng) {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false&alternatives=false`;
    try {
      const res  = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes[0]) {
        const r = data.routes[0];
        return {
          duration: Math.ceil(r.duration / 60),   // minutes
          distance: (r.distance / 1000).toFixed(1), // km
        };
      }
    } catch (e) {}
    // Fallback: haversine estimate
    const dist = haversine(fromLat, fromLng, toLat, toLng);
    return { duration: Math.ceil(dist / 0.5), distance: dist.toFixed(1) };
  },

  // ── Load all categories and show on map + panel ─────────────
  async loadAll(lat, lng) {
    const panel = document.getElementById('nearby-list');
    if (panel) panel.innerHTML = `<div class="nearby-loading"><div class="spinner"></div> Fetching real nearby places...</div>`;

    // Clear old markers
    this.markers.all.forEach(({ marker }) => marker.setMap(null));
    this.markers.all = [];

    const results = {};
    await Promise.all(Object.keys(this.CATEGORIES).map(async cat => {
      results[cat] = await this.fetchCategory(cat, lat, lng);
    }));

    // Add OSRM ETAs for closest 5 of each category
    await Promise.all(Object.keys(results).map(async cat => {
      const places = results[cat].slice(0, 8);
      await Promise.all(places.map(async p => {
        const route = await this.getRoute(lat, lng, p.lat, p.lng);
        p.duration = route.duration;
        p.distKm   = route.distance;
      }));
      results[cat] = places.sort((a, b) => (a.duration || 999) - (b.duration || 999));
    }));

    // Plot on map (Google Maps markers)
    Object.keys(results).map(cat => {
      const cfg = this.CATEGORIES[cat];
      results[cat].forEach(p => {
        const marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map: userMap,
          title: p.name,
          label: {
            text: cfg.icon,
            fontSize: '14px',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 16,
            fillColor: cfg.markerColor,
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        const iw = new google.maps.InfoWindow({
          content: this.buildPopup(p),
          maxWidth: 280,
        });
        marker.addListener('click', () => {
          iw.open(userMap, marker);
          this.showPlaceDetail(p, lat, lng);
        });
        this.markers.all.push({ marker, infoWindow: iw, lat: p.lat, lng: p.lng });
      });
    });

    // Render side panel
    this.renderPanel(results, lat, lng);
  },

  buildPopup(p) {
    const cfg = this.CATEGORIES[p.cat];
    return `
      <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:200px">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
          <span style="font-size:1.4rem">${cfg.icon}</span>
          <strong style="font-size:.95rem;color:#1E3A5F">${p.name}</strong>
        </div>
        ${p.addr ? `<div style="font-size:.78rem;color:#5A6A7A;margin-bottom:.25rem">📍 ${p.addr}</div>` : ''}
        ${p.open ? `<div style="font-size:.78rem;color:#5A6A7A;margin-bottom:.25rem">🕐 ${p.open}</div>` : ''}
        ${p.duration ? `<div style="font-size:.82rem;font-weight:700;color:#FF6B35;margin:.4rem 0">⏱️ ${p.duration} min · ${p.distKm} km away</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.6rem">
          <button onclick="NearbyPlaces.goThere(${p.lat},${p.lng})"
            style="padding:.45rem;border-radius:8px;background:#F0F4F8;border:1px solid #D0D9E5;font-size:.75rem;font-weight:700;cursor:pointer;font-family:inherit;color:#1E3A5F">
            🗺️ Directions
          </button>
          <button onclick="NearbyPlaces.notifyPlace(${JSON.stringify(p).replace(/"/g, '&quot;')})"
            style="padding:.45rem;border-radius:8px;background:linear-gradient(135deg,#FF6B35,#E55A26);border:none;font-size:.75rem;font-weight:700;cursor:pointer;font-family:inherit;color:#fff">
            📞 Notify
          </button>
        </div>
      </div>`;
  },

  renderPanel(results, userLat, userLng) {
    const panel = document.getElementById('nearby-list');
    if (!panel) return;

    const tabs = Object.keys(this.CATEGORIES);
    let html = `
      <div class="nearby-tabs" style="display:flex;gap:.4rem;margin-bottom:1rem;flex-wrap:wrap">
        <button class="ntab active" data-cat="all" onclick="NearbyPlaces.filterTab('all',this)">
          All <span class="ntab-count">${tabs.reduce((s,c) => s + (results[c]?.length || 0), 0)}</span>
        </button>
        ${tabs.map(cat => `
          <button class="ntab" data-cat="${cat}" onclick="NearbyPlaces.filterTab('${cat}',this)">
            ${this.CATEGORIES[cat].icon} ${this.CATEGORIES[cat].label}
            <span class="ntab-count">${results[cat]?.length || 0}</span>
          </button>`).join('')}
      </div>
      <div id="nearby-items">`;

    const allPlaces = tabs.flatMap(cat => (results[cat] || []).map(p => ({ ...p, cat })))
      .sort((a, b) => (a.duration || 999) - (b.duration || 999));

    if (allPlaces.length === 0) {
      html += `<div class="text-muted text-sm" style="padding:1.5rem;text-align:center">No nearby places found in 5km radius. Try refreshing.</div>`;
    } else {
      html += allPlaces.slice(0, 20).map(p => this.buildListItem(p)).join('');
    }
    html += '</div>';
    panel.innerHTML = html;

    panel._allPlaces = allPlaces;
    panel._results = results;
  },

  buildListItem(p) {
    const cfg = this.CATEGORIES[p.cat];
    const eta = p.duration ? `${p.duration} min` : '—';
    const dist = p.distKm ? `${p.distKm} km` : '';
    return `
      <div class="nearby-item" data-cat="${p.cat}" onclick="NearbyPlaces.selectItem(${p.lat},${p.lng})"
        style="display:flex;align-items:center;gap:.875rem;padding:.875rem 1rem;border-radius:14px;border:1.5px solid #E5EAF0;background:#fff;margin-bottom:.6rem;cursor:pointer;transition:all .18s">
        <div style="width:44px;height:44px;border-radius:12px;background:${cfg.markerColor}15;border:1.5px solid ${cfg.markerColor}40;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${cfg.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.875rem;font-weight:700;color:#1E3A5F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:.75rem;color:#5A6A7A;margin-top:.1rem">${p.addr || cfg.label}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.9rem;font-weight:800;color:#FF6B35">${eta}</div>
          <div style="font-size:.7rem;color:#9AA5B4">${dist}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.3rem;flex-shrink:0">
          <button onclick="event.stopPropagation();NearbyPlaces.goThere(${p.lat},${p.lng})"
            title="Get Directions"
            style="padding:.4rem .6rem;border-radius:8px;background:#F0F4F8;border:1px solid #D0D9E5;font-size:.8rem;cursor:pointer;font-family:inherit">🗺️</button>
          <button onclick="event.stopPropagation();NearbyPlaces.showNotifyModal(${JSON.stringify(p).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/'/g, '\\u0027')})"
            title="Notify / Call"
            style="padding:.4rem .6rem;border-radius:8px;background:#FF6B350F;border:1px solid #FF6B3540;font-size:.8rem;cursor:pointer;font-family:inherit">📞</button>
        </div>
      </div>`;
  },

  filterTab(cat, btn) {
    document.querySelectorAll('.ntab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('nearby-list');
    if (!panel) return;
    const allPlaces = panel._allPlaces || [];
    const items = document.getElementById('nearby-items');
    if (!items) return;
    const filtered = cat === 'all' ? allPlaces : allPlaces.filter(p => p.cat === cat);
    items.innerHTML = filtered.slice(0, 20).map(p => this.buildListItem(p)).join('');
  },

  selectItem(lat, lng) {
    if (!userMap) return;
    userMap.panTo({ lat, lng });
    userMap.setZoom(16);
    // Find and open matching info window
    this.markers.all.forEach(({ marker, infoWindow, lat: mLat, lng: mLng }) => {
      if (Math.abs(mLat - lat) < 0.0001 && Math.abs(mLng - lng) < 0.0001) {
        infoWindow.open(userMap, marker);
      }
    });
  },

  // ── Go There (open Google Maps directions) ─────────────────
  goThere(toLat, toLng) {
    const from = (userLat && userLng) ? `${userLat},${userLng}` : '';
    const url  = `https://www.google.com/maps/dir/${from}/${toLat},${toLng}`;
    window.open(url, '_blank');
  },

  // ── Notify Modal ────────────────────────────────────────────
  showNotifyModal(place) {
    this.selectedPlace = place;
    const cfg = this.CATEGORIES[place.cat];
    const modal = document.getElementById('notify-place-modal');
    if (!modal) return this.notifyPlace(place);

    document.getElementById('npm-icon').textContent  = cfg.icon;
    document.getElementById('npm-name').textContent  = place.name;
    document.getElementById('npm-cat').textContent   = cfg.label;
    document.getElementById('npm-eta').textContent   = place.duration ? `${place.duration} min · ${place.distKm} km` : 'Calculating...';
    document.getElementById('npm-addr').textContent  = place.addr || 'Address from OpenStreetMap';
    modal.classList.add('open');
  },

  notifyPlace(place) {
    // Build notification message with user location
    const msg = `🚨 Roadside Assistance Needed\n\nHello, I am stranded and need help!\n📍 My location: ${userLat?.toFixed(5)}, ${userLng?.toFixed(5)}\nhttps://www.google.com/maps?q=${userLat},${userLng}\n\n🚗 Issue: ${selectedService || 'Vehicle breakdown'}\n⏱️ I'm approximately ${place.duration} min away from your location.\n\nPlease assist — sent via RoadSide+`;

    // Share via Web Share API if available
    if (navigator.share) {
      navigator.share({ title: 'Roadside Help Needed', text: msg }).catch(() => {});
    } else {
      // Fallback: WhatsApp
      const phone = place.phone ? place.phone.replace(/[^0-9]/g, '') : '';
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
    }
    showToast(`📞 Opening contact for ${place.name}`, 'success');
    if (typeof closeModal === 'function') closeModal('notify-place-modal');
  },

  chooseSelf() {
    if (!this.selectedPlace) return;
    this.goThere(this.selectedPlace.lat, this.selectedPlace.lng);
    if (typeof closeModal === 'function') closeModal('notify-place-modal');
    showToast(`🗺️ Directions to ${this.selectedPlace.name} opened`, 'info');
  },
};

// Haversine fallback
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
