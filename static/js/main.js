/* main.js — shared utilities */

// ── Section navigation ────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(`section-${name}`);
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const active = document.querySelector(`[data-section="${name}"]`) ||
                 document.querySelector(`[onclick*="'${name}'"]`);
  if (active) active.classList.add('active');
  const titles = { home:'Dashboard', emergency:'Emergency Help', tracking:'My Requests',
    payments:'Payments', history:'History', profile:'Profile' };
  const t = document.getElementById('page-title');
  if (t && titles[name]) t.textContent = titles[name];
}

// ── Greeting ──────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting-time');
  if (!el) return;
  el.textContent = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
setGreeting();

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Toast notifications ───────────────────────────────────────
function showToast(msg, type = 'info') {
  const c = document.getElementById('flash-container') || (() => {
    const d = document.createElement('div');
    d.id = 'flash-container';
    document.body.appendChild(d);
    return d;
  })();
  const el = document.createElement('div');
  el.className = `flash-msg flash-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── API fetch helper ──────────────────────────────────────────
async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

// ── Format currency ───────────────────────────────────────────
function fmtMoney(v) { return `₹${Number(v).toFixed(0)}`; }

// ── Format date ───────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

// ── Rating stars ──────────────────────────────────────────────
function renderStars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// ── Flash dismiss auto ────────────────────────────────────────
document.querySelectorAll('.flash-msg').forEach(el => setTimeout(() => el.remove(), 5000));

// ── Service type labels ───────────────────────────────────────
const SERVICE_LABELS = {
  flat_tire: '🔴 Flat Tyre', battery: '🔋 Battery Jump',
  fuel: '⛽ Fuel Delivery', engine: '⚙️ Engine Issue',
  towing: '🚛 Towing', other: '🛠️ Other'
};
