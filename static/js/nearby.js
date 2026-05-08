/* ═══════════════════════════════════════════════════════════════
   nearby.js — Real places via Overpass API (OpenStreetMap) + OSRM routing
   Uses multi-tag queries + auto-expanding radius for rural/small-town coverage
   100% free — no API key required
═══════════════════════════════════════════════════════════════ */

const NearbyPlaces = {
  cache: {},
  leafletMarkers: [],
  selectedPlace: null,

  // ── Category definitions with multiple OSM tags (India-aware) ──
  CATEGORIES: {
    fuel: {
      label:  'Petrol Pumps',
      icon:   '⛽',
      color:  '#FF6B35',
      // Indian petrol pumps: IOC, BPCL, HPCL — tagged variously
      tags: [
        '["amenity"="fuel"]',
        '["amenity"="fuel"]["brand"~"Indian Oil|BPCL|HPCL|Essar|Shell|Reliance",i]',
        '["name"~"petrol|fuel|pump|filling|bpcl|hpcl|iocl|indian oil",i]',
      ],
    },
    mechanic: {
      label:  'Mechanics / Garages',
      icon:   '🔧',
      color:  '#00B894',
      tags: [
        '["shop"="car_repair"]',
        '["amenity"="car_repair"]',
        '["shop"="motorcycle_repair"]',
        '["name"~"garage|mechanic|auto repair|workshop|service center|tyre",i]',
      ],
    },
    hospital: {
      label:  'Hospitals & Clinics',
      icon:   '🏥',
      color:  '#E84393',
      tags: [
        '["amenity"="hospital"]',
        '["amenity"="clinic"]',
        '["amenity"="doctors"]',
        '["healthcare"~"hospital|clinic|doctor"]',
        '["name"~"hospital|clinic|health|medical|nursing|PHC|CHC",i]',
      ],
    },
    police: {
      label:  'Police Stations',
      icon:   '👮',
      color:  '#6C5CE7',
      tags: [
        '["amenity"="police"]',
        '["name"~"police|thana|chowki",i]',
      ],
    },
    toll: {
      label:  'Toll Gates',
      icon:   '🛣️',
      color:  '#FDCB6E',
      tags: [
        '["barrier"="toll_booth"]',
        '["highway"="toll_booth"]',
        '["name"~"toll|plaza|naka",i]',
      ],
    },
  },

  // ── Overpass mirrors (fallback order) ──────────────────────────
  OVERPASS_ENDPOINTS: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ],

  // ── Build Overpass QL query for all tags of a category ─────────
  buildQuery(cat, lat, lng, radiusM) {
    const tagList = this.CATEGORIES[cat].tags;
    const unions  = tagList.flatMap(t => [
      `node${t}(around:${radiusM},${lat},${lng});`,
      `way${t}(around:${radiusM},${lat},${lng});`,
    ]).join('\n        ');

    return `[out:json][timeout:20];
      (
        ${unions}
      );
      out center 15;`;
  },

  // ── Fetch from Overpass with endpoint fallback ──────────────────
  async fetchOverpass(query) {
    const body = 'data=' + encodeURIComponent(query);
    for (const endpoint of this.OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST', body,
          signal: AbortSignal.timeout(18000),
        });
        if (!res.ok) continue;
        const json = await res.json();
        return json.elements || [];
      } catch (e) {
        console.warn('Overpass endpoint failed:', endpoint, e.message);
      }
    }
    return [];
  },

  // ── Fetch with auto-expanding radius ───────────────────────────
  async fetchCategory(cat, lat, lng) {
    const cacheKey = `${cat}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    // Try progressively larger radii until we get results
    const radii = [5000, 15000, 40000, 80000];
    let elements = [];
    let usedRadius = 5000;

    for (const r of radii) {
      usedRadius = r;
      const query = this.buildQuery(cat, lat, lng, r);
      elements = await this.fetchOverpass(query);

      // Deduplicate by ID
      const seen = new Set();
      elements = elements.filter(el => {
        if (seen.has(el.id)) return false;
        seen.add(el.id);
        return true;
      });

      if (elements.length > 0) break;
      console.log(`[NearbyPlaces] ${cat}: 0 results at ${r/1000}km, expanding...`);
    }

    const cfg = this.CATEGORIES[cat];
    const places = elements.map(el => ({
      id:      el.id,
      lat:     el.lat ?? el.center?.lat,
      lng:     el.lon ?? el.center?.lon,
      name:    el.tags?.name || el.tags?.operator || el.tags?.brand || cfg.label,
      addr:    this.buildAddr(el.tags),
      phone:   el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['contact:mobile'] || '',
      open:    el.tags?.opening_hours || '',
      brand:   el.tags?.brand || '',
      cat,
      duration: null,
      distKm:  null,
      radiusKm: (usedRadius / 1000),
    })).filter(p => p.lat && p.lng);

    this.cache[cacheKey] = places;
    console.log(`[NearbyPlaces] ${cat}: found ${places.length} at ${usedRadius/1000}km`);
    return places;
  },

  buildAddr(tags) {
    if (!tags) return '';
    const parts = [
      tags['addr:housename'],
      tags['addr:street'],
      tags['addr:suburb'],
      tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    ].filter(Boolean);
    return parts.join(', ') || tags['is_in'] || '';
  },

  // ── OSRM routing for travel time ───────────────────────────────
  async getOSRMDuration(fromLat, fromLng, toLat, toLng) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const json = await res.json();
      if (json.code === 'Ok' && json.routes?.[0]) {
        return {
          duration: Math.ceil(json.routes[0].duration / 60),
          distKm:   (json.routes[0].distance / 1000).toFixed(1),
        };
      }
    } catch (e) {}
    // Haversine fallback (assumes ~40 km/h avg speed on rural roads)
    const dist = haversine(fromLat, fromLng, toLat, toLng);
    return { duration: Math.ceil(dist / 0.667), distKm: dist.toFixed(1) };
  },

  // ── Enrich top N results with real driving time ─────────────────
  async enrichWithTravelTime(places, fromLat, fromLng) {
    const top = places.slice(0, 6);
    await Promise.allSettled(top.map(async p => {
      const info = await this.getOSRMDuration(fromLat, fromLng, p.lat, p.lng);
      p.duration = info.duration;
      p.distKm   = info.distKm;
    }));
    // Straight-line estimate for the rest
    places.slice(6).forEach(p => {
      const dist = haversine(fromLat, fromLng, p.lat, p.lng);
      p.distKm   = dist.toFixed(1);
      p.duration = Math.ceil(dist / 0.667);
    });
    return places.sort((a, b) => (a.duration || 9999) - (b.duration || 9999));
  },

  // ── Main entry ─────────────────────────────────────────────────
  async loadAll(lat, lng) {
    const panel = document.getElementById('nearby-list');
    if (panel) panel.innerHTML = `
      <div class="nearby-loading">
        <div class="spinner"></div>
        Searching real places nearby (auto-expanding if needed)...
      </div>`;

    // Clear old markers
    this.leafletMarkers.forEach(m => { try { window.userMap?.removeLayer(m); } catch(e){} });
    this.leafletMarkers = [];

    // Fetch all categories in parallel
    const results = {};
    await Promise.allSettled(Object.keys(this.CATEGORIES).map(async cat => {
      const raw  = await this.fetchCategory(cat, lat, lng);
      results[cat] = await this.enrichWithTravelTime(raw, lat, lng);
    }));

    // Ensure all keys exist
    Object.keys(this.CATEGORIES).forEach(cat => {
      if (!results[cat]) results[cat] = [];
    });

    // Add Leaflet markers for top 10 per category
    Object.keys(results).forEach(cat => {
      const cfg = this.CATEGORIES[cat];
      results[cat].slice(0, 10).forEach(p => {
        if (!window.userMap) return;
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="
              width:38px;height:38px;border-radius:50%;
              background:${cfg.color};border:2.5px solid #fff;
              box-shadow:0 2px 10px rgba(0,0,0,.3);
              display:flex;align-items:center;justify-content:center;
              font-size:17px;cursor:pointer;
            ">${cfg.icon}</div>`,
            iconSize:   [38, 38],
            iconAnchor: [19, 19],
            popupAnchor:[0, -23],
          }),
        }).addTo(window.userMap);

        marker.bindPopup(this.buildPopup(p), { maxWidth: 290 });
        this.leafletMarkers.push(marker);
      });
    });

    this.renderPanel(results, lat, lng);
  },

  // ── Popup HTML ─────────────────────────────────────────────────
  buildPopup(p) {
    const cfg       = this.CATEGORIES[p.cat];
    const brandHtml = p.brand && p.brand !== p.name
      ? `<div style="font-size:.73rem;color:#9AA5B4;margin-bottom:.2rem">${p.brand}</div>` : '';
    const addrHtml  = p.addr
      ? `<div style="font-size:.78rem;color:#5A6A7A;margin-bottom:.2rem">📍 ${p.addr}</div>` : '';
    const phoneHtml = p.phone
      ? `<div style="font-size:.78rem;color:#5A6A7A;margin-bottom:.2rem">📞 <a href="tel:${p.phone}" style="color:#FF6B35;font-weight:700">${p.phone}</a></div>` : '';
    const openHtml  = p.open
      ? `<div style="font-size:.73rem;color:#00B894;margin-bottom:.2rem">🕐 ${p.open}</div>` : '';
    const etaHtml   = p.duration != null
      ? `<div style="font-size:.85rem;font-weight:800;color:#FF6B35;margin:.4rem 0">⏱️ ${p.duration} min &nbsp;·&nbsp; ${p.distKm} km away</div>` : '';
    const radiusNote = p.radiusKm > 5
      ? `<div style="font-size:.68rem;color:#FDCB6E;margin-bottom:.3rem">📡 Found in ${p.radiusKm}km radius</div>` : '';
    const safeP = JSON.stringify(p).replace(/"/g, '&quot;');

    return `
      <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:210px;max-width:280px">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
          <span style="font-size:1.5rem">${cfg.icon}</span>
          <strong style="font-size:.95rem;color:#1E3A5F;line-height:1.2">${p.name}</strong>
        </div>
        ${brandHtml}${radiusNote}${addrHtml}${phoneHtml}${openHtml}${etaHtml}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.6rem">
          <button onclick="NearbyPlaces.goThere(${p.lat},${p.lng})"
            style="padding:.5rem;border-radius:8px;background:#F0F4F8;border:1px solid #D0D9E5;
                   font-size:.75rem;font-weight:700;cursor:pointer;font-family:inherit;color:#1E3A5F">
            🗺️ Directions
          </button>
          <button onclick="NearbyPlaces.showNotifyModal(${safeP})"
            style="padding:.5rem;border-radius:8px;
                   background:linear-gradient(135deg,#FF6B35,#E55A26);
                   border:none;font-size:.75rem;font-weight:700;cursor:pointer;
                   font-family:inherit;color:#fff">
            📞 Notify
          </button>
        </div>
      </div>`;
  },

  // ── Side panel ─────────────────────────────────────────────────
  renderPanel(results, userLat, userLng) {
    const panel = document.getElementById('nearby-list');
    if (!panel) return;

    const tabs = Object.keys(this.CATEGORIES);
    const totalCount = tabs.reduce((s, c) => s + (results[c]?.length || 0), 0);

    // Find max radius used (to show in header)
    const allPlaces = tabs.flatMap(cat => (results[cat] || []).map(p => ({ ...p, cat })))
      .sort((a, b) => (a.duration || 9999) - (b.duration || 9999));
    const maxRadius = allPlaces.length > 0
      ? Math.max(...allPlaces.map(p => p.radiusKm || 5)) : 5;
    const radiusLabel = maxRadius > 5 ? ` (within ${maxRadius}km)` : ' (within 5km)';

    let html = `
      <div style="font-size:.72rem;color:#9AA5B4;margin-bottom:.75rem;display:flex;align-items:center;gap:.35rem">
        📡 Live OSM data${radiusLabel} · sorted by travel time
      </div>
      <div class="nearby-tabs" style="display:flex;gap:.4rem;margin-bottom:1rem;flex-wrap:wrap">
        <button class="ntab active" data-cat="all" onclick="NearbyPlaces.filterTab('all',this)">
          All <span class="ntab-count">${totalCount}</span>
        </button>
        ${tabs.map(cat => `
          <button class="ntab" data-cat="${cat}" onclick="NearbyPlaces.filterTab('${cat}',this)">
            ${this.CATEGORIES[cat].icon} ${this.CATEGORIES[cat].label}
            <span class="ntab-count">${results[cat]?.length || 0}</span>
          </button>`).join('')}
      </div>
      <div id="nearby-items">`;

    if (allPlaces.length === 0) {
      html += `
        <div style="text-align:center;padding:2rem;color:#9AA5B4">
          <div style="font-size:2.5rem;margin-bottom:.75rem">🗺️</div>
          <div style="font-weight:700;margin-bottom:.35rem">No places found in OSM data</div>
          <div style="font-size:.8rem">This area has limited OpenStreetMap coverage.<br>
          Real mechanics and petrol pumps may not be mapped yet.</div>
        </div>`;
    } else {
      html += allPlaces.slice(0, 30).map(p => this.buildListItem(p)).join('');
    }
    html += '</div>';
    panel.innerHTML = html;
    panel._allPlaces = allPlaces;
    panel._results   = results;
  },

  buildListItem(p) {
    const cfg    = this.CATEGORIES[p.cat];
    const eta    = p.duration != null ? `${p.duration} min` : '—';
    const dist   = p.distKm   ? `${p.distKm} km`           : '';
    const radiusBadge = p.radiusKm > 5
      ? `<span style="font-size:.65rem;color:#FDCB6E;font-weight:700">${p.radiusKm}km away</span>` : '';
    const safeP  = JSON.stringify(p)
      .replace(/</g,'\\u003c').replace(/>/g,'\\u003e')
      .replace(/&/g,'\\u0026').replace(/'/g,'\\u0027');

    return `
      <div class="nearby-item" data-cat="${p.cat}"
        style="display:flex;align-items:center;gap:.875rem;padding:.875rem 1rem;
               border-radius:14px;border:1.5px solid #E5EAF0;background:#fff;
               margin-bottom:.6rem;cursor:pointer;transition:all .18s"
        onclick="NearbyPlaces.panToPlace(${p.lat},${p.lng})">
        <div style="width:44px;height:44px;border-radius:12px;flex-shrink:0;
                    background:${cfg.color}18;border:1.5px solid ${cfg.color}50;
                    display:flex;align-items:center;justify-content:center;font-size:1.2rem">
          ${cfg.icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.875rem;font-weight:700;color:#1E3A5F;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:.75rem;color:#5A6A7A;margin-top:.1rem;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${p.addr || cfg.label}
          </div>
          <div style="display:flex;gap:.4rem;margin-top:.15rem;align-items:center">
            ${p.phone ? `<span style="font-size:.68rem;color:#00B894">📞 ${p.phone}</span>` : ''}
            ${radiusBadge}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;min-width:52px">
          <div style="font-size:.9rem;font-weight:800;color:#FF6B35">${eta}</div>
          <div style="font-size:.7rem;color:#9AA5B4">${dist}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.3rem;flex-shrink:0">
          <button onclick="event.stopPropagation();NearbyPlaces.goThere(${p.lat},${p.lng})"
            title="Directions"
            style="padding:.4rem .6rem;border-radius:8px;background:#F0F4F8;
                   border:1px solid #D0D9E5;font-size:.8rem;cursor:pointer">🗺️</button>
          <button onclick="event.stopPropagation();NearbyPlaces.showNotifyModal(${safeP})"
            title="Notify"
            style="padding:.4rem .6rem;border-radius:8px;background:#FF6B350F;
                   border:1px solid #FF6B3540;font-size:.8rem;cursor:pointer">📞</button>
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
    items.innerHTML = filtered.length > 0
      ? filtered.slice(0, 30).map(p => this.buildListItem(p)).join('')
      : `<div style="text-align:center;padding:1.5rem;color:#9AA5B4;font-size:.85rem">
           No ${this.CATEGORIES[cat]?.label || ''} found nearby.
         </div>`;
  },

  panToPlace(lat, lng) {
    if (!window.userMap) return;
    window.userMap.setView([lat, lng], 16);
    this.leafletMarkers.forEach(m => {
      const ll = m.getLatLng();
      if (Math.abs(ll.lat - lat) < 0.0002 && Math.abs(ll.lng - lng) < 0.0002) {
        m.openPopup();
      }
    });
  },

  goThere(toLat, toLng) {
    const from = (window.userLat && window.userLng)
      ? `${window.userLat},${window.userLng}` : '';
    window.open(`https://www.google.com/maps/dir/${from}/${toLat},${toLng}`, '_blank');
  },

  showNotifyModal(place) {
    if (typeof place === 'string') { try { place = JSON.parse(place); } catch(e){} }
    this.selectedPlace = place;
    const cfg   = this.CATEGORIES[place.cat];
    const modal = document.getElementById('notify-place-modal');
    if (!modal) return this.notifyPlace(place);
    document.getElementById('npm-icon').textContent = cfg.icon;
    document.getElementById('npm-name').textContent = place.name;
    document.getElementById('npm-cat').textContent  = cfg.label;
    document.getElementById('npm-eta').textContent  = place.duration != null
      ? `${place.duration} min · ${place.distKm} km` : '—';
    document.getElementById('npm-addr').textContent = place.addr || 'Nearby location';
    modal.classList.add('open');
  },

  notifyPlace(place) {
    const msg = `🚨 Roadside Assistance Needed\n\nHello, I am stranded and need help!\n📍 My location: ${window.userLat?.toFixed(5)}, ${window.userLng?.toFixed(5)}\nhttps://www.google.com/maps?q=${window.userLat},${window.userLng}\n\n🚗 Issue: ${window.selectedService || 'Vehicle breakdown'}\n⏱️ I'm approximately ${place.duration} min from your location.\n\nPlease assist — sent via RoadSide+`;
    if (place.phone) {
      const phone = place.phone.replace(/[^0-9+]/g, '');
      if (phone) { window.open(`tel:${phone}`); }
    }
    if (navigator.share) {
      navigator.share({ title: 'Roadside Help Needed', text: msg }).catch(() => {});
    } else {
      const phone = place.phone ? place.phone.replace(/[^0-9]/g, '') : '';
      window.open(phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
    if (typeof showToast === 'function') showToast(`📞 Contacting ${place.name}`, 'success');
    if (typeof closeModal === 'function') closeModal('notify-place-modal');
  },

  chooseSelf() {
    if (!this.selectedPlace) return;
    this.goThere(this.selectedPlace.lat, this.selectedPlace.lng);
    if (typeof closeModal === 'function') closeModal('notify-place-modal');
    if (typeof showToast === 'function') showToast('🗺️ Directions opened', 'info');
  },
};

// ── Haversine distance in km ──────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
