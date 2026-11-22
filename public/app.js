'use strict';
/* LUKI MANAGEMENT frontend. All data lives on the server (SQLite); this file renders it and calls the API. */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const off = n => { const d = new Date(); d.setHours(12, 0, 0, 0); return iso(new Date(d.getTime() + n * DAY)); };
const diff = s => Math.round((parse(s) - parse(off(0))) / DAY);
const short = s => { const d = parse(s); return MON[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); };
const fmtN = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const hhmm = ms => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

const ICON = {
  dash: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  team: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  play: '<path d="M6 4l14 8-14 8z" fill="currentColor"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  arrow: '<path d="M7 17L17 7M8 7h9v9"/>',
  video: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>', chevR: '<path d="M9 18l6-6-6-6"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  bellS: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20c1.7 0 2-1 1.5-2-.6-1.2.2-2.5 1.5-2.5H18a4 4 0 0 0 4-4C22 6 17.5 2 12 2z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 13h2M2 10h20M6 6V4h12v2"/>',
  note: '<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4M8 9h8M8 13h5"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  pin: '<path d="M12 17v5M9 10.8V5h6v5.8l3 3.2H6z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- api + state ---------- */
let S = null, AN = null;
async function api(method, url, body) {
  let r;
  try { r = await fetch(url, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-luki': '1' }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Tidak bisa terhubung ke server'); }
  let j = null; try { j = await r.json(); } catch { /* empty body */ }
  if (r.status === 401 && !url.startsWith('/api/auth')) { showAuth(); throw new Error('auth'); }
  if (!r.ok) { const e = new Error(j?.error || 'Terjadi kesalahan'); e.code = j?.code; throw e; }
  return j;
}
const load = async () => { S = await api('GET', '/api/bootstrap'); };
const mem = id => S.members.find(m => m.id === id);
const ini = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const hue = id => (id * 47) % 360;
const AVATAR_PRESETS = [
  ['preset:fox', '🦊', 'Fox'], ['preset:rocket', '🚀', 'Rocket'], ['preset:cat', '🐱', 'Cat'], ['preset:lion', '🦁', 'Lion'],
  ['preset:star', '⭐', 'Star'], ['preset:fire', '🔥', 'Fire'], ['preset:coffee', '☕', 'Coffee'], ['preset:laptop', '💻', 'Tech'],
  ['preset:palette', '🎨', 'Design'], ['preset:crown', '👑', 'Crown'], ['preset:target', '🎯', 'Focus'], ['preset:plant', '🌿', 'Growth']
];
const DIVISIONS = [
  'Engineering & IT', 'Product & UI/UX', 'Marketing & Komunikasi', 'Sales & Business Dev',
  'Keuangan & Akuntansi', 'Human Resources (HR)', 'Operasional & Logistik', 'Customer Support',
  'Legal & Kepatuhan', 'Manajemen & Eksekutif'
];
const av = (m, c = '') => {
  if (!m) return '';
  if (m.avatar?.startsWith('preset:')) {
    const p = AVATAR_PRESETS.find(x => x[0] === m.avatar);
    return `<span class="av ${c} av-preset" title="${esc(m.name)}">${p ? p[1] : '👤'}</span>`;
  }
  if (m.avatar) {
    return `<span class="av ${c} av-img" title="${esc(m.name)}"><img src="${m.avatar}" alt="${esc(m.name)}"></span>`;
  }
  return `<span class="av ${c}" style="--h:${hue(m.id)}" title="${esc(m.name)}">${esc(ini(m.name))}</span>`;
};
const ph = n => (n.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 7) % 360;
const openTasks = id => S.tasks.filter(t => t.stage !== 'done' && t.who.includes(id));
const STAGES = [['todo', 'To do'], ['progress', 'In progress'], ['review', 'In review'], ['done', 'Done']];
const PROG = { todo: 0, progress: 50, review: 90, done: 100 };
const allEvents = () => [...S.events.map(e => ({ ...e, own: true })),
  ...S.tasks.filter(t => t.stage !== 'done').map(t => ({ id: 't' + t.id, title: 'Due: ' + t.title, date: t.due, time: 'All day', type: 'deadline' })),
  ...S.projects.filter(p => p.status !== 'ended').map(p => ({ id: 'p' + p.id, title: 'Project due: ' + p.name, date: p.due, time: 'All day', type: 'deadline' }))];

/* ---------- ui state ---------- */
let cur = 'dashboard', Q = '', TF = 'all', TD = 'All', AR = 30, ST = 'security', PV = {}, tok = 0, AD = null, dragId = null, chat = null, dirty = false;
let CV = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: off(0) };
const view = $('#view');
const hasQ = s => !Q || s.toLowerCase().includes(Q);

/* ---------- toast, layers, popovers ---------- */
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
}
let lastFocus = null;
function layer(kind, html) {
  closeLayer(true); closePop(); lastFocus = document.activeElement;
  const o = document.createElement('div'); o.className = 'ov ' + kind;
  o.innerHTML = `<div role="dialog" aria-modal="true">${html}</div>`;
  o.addEventListener('mousedown', e => { if (e.target === o) closeLayer(); });
  document.body.appendChild(o); $('.app').inert = true;
  requestAnimationFrame(() => o.classList.add('in'));
  setTimeout(() => (o.querySelector('input:not([type=hidden]):not([type=file]),select,textarea,.primary') || o).focus(), 60);
  return o;
}
function closeLayer(now) {
  const o = $('.ov'); if (!o) return;
  chat = null; $('.app').inert = false; o.classList.remove('in');
  if (now) o.remove(); else setTimeout(() => o.remove(), 260);
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  if (dirty && !now) setTimeout(refresh, 300);
}
let popEl = null;
function closePop() { popEl?.remove(); popEl = null; }
function pop(anchor, html, cls = '') {
  closePop(); popEl = document.createElement('div'); popEl.className = 'pop ' + cls; popEl.innerHTML = html; document.body.appendChild(popEl);
  const r = anchor.getBoundingClientRect(), w = popEl.offsetWidth, h = popEl.offsetHeight;
  popEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  popEl.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
}
const field = (label, inner, w) => `<label class="fl ${w ? 'w' : ''}">${label}${inner}</label>`;
const modalHead = t => `<div class="mh"><h3>${t}</h3><button class="x" type="button" data-act="close" aria-label="Tutup">${ic('x')}</button></div>`;
function form(html, onSubmit) {
  const o = layer('modal', html), f = $('form', o);
  f.addEventListener('submit', async e => {
    e.preventDefault(); const b = $('.primary', f); if (b) b.disabled = true;
    try { await onSubmit(new FormData(f), f); } finally { if (b) b.disabled = false; }
  });
  return o;
}
/* run a mutation, refresh state, repaint. Returns null on failure (error already toasted). */
async function mut(method, url, body, okMsg, closeIt = true) {
  try {
    const r = await api(method, url, body); await load();
    if (closeIt) closeLayer(); paint(false); if (okMsg) toast(okMsg); return r || {};
  } catch (e) { if (e.message !== 'auth') toast(e.message); return null; }
}

/* ---------- charts ---------- */
function spark(arr, id) {
  const mx = Math.max(...arr), mn = Math.min(...arr), W = 120, H = 34, n = arr.length;
  const pts = arr.map((v, i) => [n > 1 ? i / (n - 1) * W : W / 2, H - 4 - (v - mn) / ((mx - mn) || 1) * (H - 10)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="sg${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--ac)" stop-opacity=".25"/><stop offset="1" stop-color="var(--ac)" stop-opacity="0"/></linearGradient></defs><path d="${d}L${W} ${H}L0 ${H}Z" fill="url(#sg${id})"/><path class="draw" pathLength="1" d="${d}" fill="none" stroke="var(--ac)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

/* ---------- views ---------- */
const head = (t, sub, acts = '') => `<div class="head"><div><h1>${t}</h1><p>${sub}</p></div><div class="acts">${acts}</div></div>`;
const num = (k, v, d = 0, s = '') => `<span class="num" data-k="${k}" data-v="${v}" data-d="${d}" data-s="${s}">${fmtN(v, d)}${s}</span>`;

function vDash() {
  const P = S.projects, tot = P.length, c = s => P.filter(p => p.status === s).length, me = S.me.id;
  const end = c('ended'), run = c('running'), pen = c('pending'), pct = tot ? Math.round(end / tot * 100) : 0;
  const stat = (k, t, v, sub, on) => `<div class="card stat ${on ? 'on' : ''}"><span class="go">${ic('arrow')}</span><h4>${t}</h4><div class="n">${num(k, v)}</div><small>${sub}</small></div>`;
  const list = P.filter(p => hasQ(p.name)).slice(-6).reverse();
  const nxt = allEvents().filter(e => e.date >= off(0) && hasQ(e.title.toLowerCase())).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0];
  const days = Array.from({ length: 7 }, (_, i) => off(i - 6)), cnt = days.map(d => S.tasks.filter(t => t.completedAt && iso(new Date(t.completedAt)) === d).length), mx = Math.max(1, ...cnt);
  const bars = days.map((d, i) => { const r = cnt[i] / mx; return `<div class="bar"><em ${cnt[i] === mx && mx > 1 ? 'class="show"' : ''}>${cnt[i]}</em><i class="${cnt[i] && r >= .75 ? 'b-hi' : cnt[i] && r >= .4 ? 'b-md' : 'b-lo'}" style="height:${Math.max(10, r * 100)}%"></i><span>${DOW[parse(d).getDay()][0]}</span></div>`; }).join('');
  const team = S.members.filter(m => hasQ(m.name)).slice(0, 4).map(m => {
    const o = openTasks(m.id).sort((a, b) => b.prog - a.prog)[0], t = o || S.tasks.filter(t => t.who.includes(m.id))[0];
    const st = !t ? 'Pending' : t.stage === 'done' ? 'Completed' : t.stage === 'todo' ? 'Pending' : 'InProgress';
    return `<div class="crow">${av(m)}<div><b>${esc(m.name)}</b><small>Working on ${esc(t ? t.title : '—')}</small></div><span class="pill s-${st}">${st === 'InProgress' ? 'In Progress' : st}</span></div>`;
  }).join('') || '<p class="mut">Tidak ada hasil.</p>';
  const row = p => `<div class="prow"><span class="pico" style="--h:${ph(p.name)}">${esc(p.name[0])}</span><div style="flex:1;min-width:0"><b>${esc(p.name)}</b><small>Due date: ${short(p.due)}</small></div>${p.status === 'ended' ? `<a class="pill rep" href="/api/projects/${p.id}/report" title="Unduh laporan PDF">${ic('file')}PDF</a>` : ''}${p.ownerId === me || S.me.admin ? `<button class="pill s-${p.status}" data-act="cycle" data-id="${p.id}" title="Klik untuk ganti status">${p.status}</button><button class="ibtn sm" data-act="edit-proj" data-id="${p.id}" title="Edit project">${ic('edit')}</button><button class="ibtn sm" data-act="del-proj" data-id="${p.id}" title="Hapus project" style="color:var(--bad)">${ic('trash')}</button>` : `<span class="pill s-${p.status}" title="Hanya owner yang bisa mengubah">${p.status}</span>`}</div>`;
  const opts = P.filter(p => p.status !== 'ended').map(p => `<option value="${p.id}" ${TT.pid === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  return head('Dashboard', 'Everything your team is shipping, in one calm place.', `<button class="btn primary" data-act="add-project">${ic('plus')}Add Project</button><button class="btn" data-act="import">${ic('upload')}Import Data</button>`) +
  `<div class="grid g4" style="margin-bottom:14px">${stat('total', 'Total Projects', tot, 'All projects', 1)}${stat('end', 'Ended Projects', end, 'Completed, report ready')}${stat('run', 'Running Projects', run, 'In progress')}${stat('pen', 'Pending Projects', pen, 'Awaiting review')}</div>
  <div class="grid g3" style="margin-bottom:14px">
    <div class="card"><h3>Tasks completed <small class="mut">last 7 days</small></h3><div class="bars">${bars}</div></div>
    <div class="card remind"><h3>Reminders</h3>${nxt ? `<h2>${esc(nxt.title)}</h2><small class="mut">${nxt.date === off(0) ? 'Today' : short(nxt.date)} · ${esc(nxt.time)}</small>${nxt.type === 'meeting' ? `<button class="btn primary" data-act="start-meeting" data-t="${esc(nxt.title)}">${ic('video')}Start Meeting</button>` : ''}` : '<p class="mut">Tidak ada agenda mendatang.</p>'}</div>
    <div class="card"><h3>Project <button class="btn sm" data-act="add-project">${ic('plus')}New</button></h3><div class="plist">${list.map(row).join('') || '<p class="mut">Belum ada project.</p>'}</div></div>
  </div>
  <div class="grid g3">
    <div class="card"><h3>Team Collaboration <button class="btn sm" data-act="invite">${ic('plus')}Add Member</button></h3><div class="collab">${team}</div></div>
    <div class="card"><h3>Project Progress</h3><div class="gauge"><svg viewBox="0 0 180 100"><path d="M15 90A75 75 0 0 1 165 90" fill="none" stroke="#e9edf5" stroke-width="18" stroke-linecap="round" pathLength="100"/><path class="gauge-arc" data-v="${pct}" d="M15 90A75 75 0 0 1 165 90" fill="none" stroke="var(--ac)" stroke-width="18" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/></svg><div class="pc"><b>${num('pct', pct, 0, '%')}</b><small>Project Ended</small></div></div>
      <div class="legend"><span><i style="background:var(--ac)"></i>Ended</span><span><i style="background:var(--ac-mid)"></i>Running</span><span><i style="background:#cbd5e1"></i>Pending</span></div></div>
    <div class="card tt"><h3>Time Tracker</h3><select class="tt-sel" data-act-change="tt-proj" aria-label="Project untuk waktu kerja"><option value="0">No project</option>${opts}</select><div class="tt-time" aria-live="off">00:00:00</div><div class="tt-b"><button data-act="tt-toggle" aria-label="Mulai atau jeda"></button><button data-act="tt-stop" aria-label="Stop dan simpan">${ic('stop')}</button></div></div>
  </div>`;
}

const dueLab = t => { if (t.stage === 'done') return short(t.due); const d = diff(t.due); return d < 0 ? `<span class="od">${-d}d overdue</span>` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`; };
function vTasks() {
  const wk = off(7);
  const ts = S.tasks.filter(t => hasQ((t.title + ' ' + t.tag).toLowerCase()) && (TF === 'all' || (TF === 'mine' && t.who.includes(S.me.id)) || (TF === 'high' && t.prio === 'High') || (TF === 'week' && t.stage !== 'done' && t.due <= wk)));
  const card = (t, i) => { const pj = S.projects.find(p => p.id === t.projectId); return `<div class="tcard" draggable="true" data-id="${t.id}" data-act="task-detail" style="animation-delay:${i * 40}ms;cursor:pointer"><div class="tmeta"><span class="tag ${esc((t.tag || '').replace(/\s+/g, '-'))}">${esc(t.tag || 'General')}</span><span class="pr ${t.prio}">${ic('flag')}${t.prio}</span><button class="mn" data-act="menu" data-id="${t.id}" aria-label="Menu tugas">${ic('more')}</button></div><h5>${esc(t.title)}</h5><div class="prog"><i style="width:${t.prog}%"></i></div><div class="tfoot"><span>${ic('clock')}</span><span>${dueLab(t)}</span>${pj ? `<span class="pj" title="${esc(pj.name)}">${esc(pj.name)}</span>` : ''}<span class="stack">${t.who.map(mem).map(m => av(m, 'sm')).join('')}</span></div></div>`; };
  const cols = STAGES.map(([k, l]) => { const c = ts.filter(t => t.stage === k); return `<div class="col" data-stage="${k}"><h4><i></i>${l}<span>${c.length}</span></h4>${c.map(card).join('') || '<div class="empty">Drop a card here</div>'}</div>`; }).join('');
  const tabs = [['all', 'All'], ['mine', 'My tasks'], ['high', 'High priority'], ['week', 'Due this week']].map(([k, l]) => `<button class="tab ${TF === k ? 'on' : ''}" data-act="tf" data-k="${k}">${l}</button>`).join('');
  return head('Tasks', 'Drag a card to another stage, or use its menu to move it.', `<button class="btn primary" data-act="new-task">${ic('plus')}New Task</button>`) + `<div class="tabs">${tabs}<span class="cnt">${ts.length} tasks shown</span></div><div class="board">${cols}</div>`;
}

let activeTeamId = null;
let teamMembersCache = {};
function vTeam() {
  const me = S.me.id;
  const teams = S.teams && S.teams.length ? S.teams : [{ id: 1, name: 'Luki Core Team', logo: 'preset:lion', description: 'Tim Utama Luki Management', myRole: 'Ketua Tim', memberCount: S.members.length }];
  if (!activeTeamId || !teams.find(t => t.id === activeTeamId)) activeTeamId = teams[0].id;
  const curTeam = teams.find(t => t.id === activeTeamId) || teams[0];
  const myRoleInTeam = curTeam.myRole || (S.me.admin ? 'Ketua Tim' : 'Member');
  const isLead = S.me.admin || myRoleInTeam === 'Ketua Tim';

  const teamOpts = teams.map(t => `<option value="${t.id}" ${t.id === curTeam.id ? 'selected' : ''}>${esc(t.name)} (${esc(t.myRole || 'Member')})</option>`).join('');
  const logoP = curTeam.logo?.startsWith('preset:') ? (AVATAR_PRESETS.find(x => x[0] === curTeam.logo)?.[1] || '👥') : (curTeam.logo ? `<img src="${curTeam.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : '👥');

  if (!teamMembersCache[curTeam.id]) {
    api('GET', `/api/teams/${curTeam.id}/members`).then(list => {
      teamMembersCache[curTeam.id] = list;
      if (cur === 'team') paint(false);
    }).catch(() => {});
  }
  const curMembers = teamMembersCache[curTeam.id] || S.members;
  const ms = curMembers.filter(m => (TD === 'All' || m.div === TD) && hasQ((m.name + ' ' + (m.username || '') + ' ' + (m.teamRole || m.role)).toLowerCase()));
  const cards = ms.map((m, i) => {
    const o = typeof m.openTasks === 'number' ? m.openTasks : openTasks(m.id).length;
    const dn = typeof m.doneTasks === 'number' ? m.doneTasks : S.tasks.filter(t => t.stage === 'done' && t.who.includes(m.id)).length;
    const wl = Math.min(95, o * 20), un = S.unread[m.id] || 0;
    const memberRole = m.teamRole || m.role || 'Member';
    const roleCls = { 'Ketua Tim': 'role-lead', 'Project Manager': 'role-pm', 'Member': 'role-member', 'Viewer': 'role-viewer' }[memberRole] || 'role-member';
    const roleIcon = { 'Ketua Tim': '👑', 'Project Manager': '💼', 'Member': '👤', 'Viewer': '👁️' }[memberRole] || '👤';
    const bday = m.birthDate ? `<span class="bday-pill" title="Ulang tahun: ${m.birthDate}">🎂 ${m.birthDate.slice(5)}</span>` : '';

    return `<div class="card mcard" style="--i:${i}">
      <span class="avw">${av(m, 'lg')}<i class="st ${m.on ? 'on' : ''}" title="${m.on ? 'Online' : 'Offline'}"></i></span>
      <h4 style="font-size:15px;font-weight:700;margin:6px 0 2px">${esc(m.name)}${m.id === me ? ' <small class="mut">(kamu)</small>' : ''}</h4>
      <small class="mut" style="font-size:12px">@${esc(m.username || 'user' + m.id)}</small>
      <div class="mcard-badges">
        <span class="role-badge ${roleCls}">${roleIcon} ${esc(memberRole)}</span>
        <span class="div-badge">${esc(m.div)}</span>
        ${bday}
      </div>
      <div class="mstats"><div><b>${o}</b><small class="mut">Tugas Berjalan</small></div><div><b>${dn}</b><small class="mut">Selesai</small></div></div>
      <div class="wl"><div><span>Beban Kerja</span><span>${wl}%</span></div><div class="prog"><i style="width:${wl}%"></i></div></div>
      <div class="mbtn">
        ${m.id === me ? '<button class="btn sm" disabled>Kamu</button><button class="btn sm" data-act="go" data-k="profile">Profil</button>' : `<button class="btn sm chatbtn" data-act="chat" data-id="${m.id}">${ic('chat')}Chat${un ? `<em class="badge">${un}</em>` : ''}</button>`}
        ${isLead && m.id !== me ? `<button class="btn sm primary" data-act="set-team-role" data-id="${m.id}" data-team="${curTeam.id}" title="Ubah role di tim">${ic('shield')}Atur Role</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const allDivs = ['All', ...new Set(curMembers.map(m => m.div).filter(Boolean))];
  return head('Team', 'Kelola multi-tim, anggota, peran spesifik tiap tim, dan status online.',
    `<div class="fa" style="margin:0">
      <button class="btn" data-act="new-team">${ic('plus')} Buat Tim Baru</button>
      <button class="btn primary" data-act="invite-team" data-team="${curTeam.id}">${ic('mail')} Undang ke Tim</button>
    </div>`) +
    `<div class="team-hero">
      <div class="team-hero-info">
        <div class="team-logo">${logoP}</div>
        <div class="team-hero-t">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <h2>${esc(curTeam.name)}</h2>
            <span class="role-badge role-lead">👑 Peranmu: ${esc(myRoleInTeam)}</span>
            <span class="div-badge" style="background:var(--line);color:var(--txt);border:none">${curTeam.memberCount || S.members.length} Anggota</span>
          </div>
          <p>${esc(curTeam.description || 'Ruang kerja kolaborasi tim.')}</p>
        </div>
      </div>
      <div class="team-hero-actions">
        <div class="team-select-wrap">
          <label class="mut" style="font-size:12px;font-weight:600">Ganti Tim:</label>
          <select class="in sm" id="teamSwitcher" data-act="switch-team" style="font-weight:600;min-width:180px">${teamOpts}</select>
        </div>
        ${isLead ? `<button class="btn sm" data-act="edit-team" data-id="${curTeam.id}">${ic('edit')} Edit Tim</button>` : ''}
        ${isLead && teams.length > 1 ? `<button class="btn sm danger" data-act="del-team" data-id="${curTeam.id}">${ic('trash')}</button>` : ''}
      </div>
    </div>
    <div class="tabs">${allDivs.map(d => `<button class="tab ${TD === d ? 'on' : ''}" data-act="td" data-k="${d}">${d}</button>`).join('')}<span class="cnt">${S.members.filter(m => m.on).length} online now</span></div>
    <div class="tgrid">${cards || '<div class="empty" style="grid-column:1/-1">Tidak ada anggota di divisi ini.</div>'}</div>`;
}

function vCal() {
  const { y, m, sel } = CV, ws = S.me.week, lead = (new Date(y, m, 1).getDay() - ws + 7) % 7, dim = new Date(y, m + 1, 0).getDate(), n = Math.ceil((lead + dim) / 7) * 7, AE = allEvents();
  const evs = d => AE.filter(e => e.date === d && hasQ(e.title.toLowerCase())).sort((a, b) => a.time.localeCompare(b.time));
  const hdr = Array.from({ length: 7 }, (_, i) => `<div class="dw">${DOW[(i + ws) % 7].slice(0, 3)}</div>`).join('');
  let cells = '';
  for (let i = 0; i < n; i++) {
    const d = new Date(y, m, 1 - lead + i), s = iso(d), e = evs(s);
    cells += `<button class="cd ${e.length ? 'has' : ''} ${d.getMonth() !== m ? 'out' : ''} ${s === off(0) ? 'today' : ''} ${s === sel ? 'sel' : ''}" data-act="pick" data-d="${s}" style="animation-delay:${i * 8}ms"><b>${d.getDate()}</b>${e.slice(0, 2).map(x => `<i class="ev t-${x.type}">${esc(x.title)}</i>`).join('')}${e.length > 2 ? `<span class="more">+${e.length - 2} more</span>` : ''}</button>`;
  }
  const sd = parse(sel), day = evs(sel);
  const coming = AE.filter(e => e.date >= off(0)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 5);
  const col = { meeting: 'var(--ac)', team: '#15803d', review: '#d97706', deadline: '#dc2626', social: '#7c3aed' };
  return head('Calendar', 'Meetings, reviews and deadlines across the team.', `<button class="btn" data-act="add-event">${ic('plus')}New event</button><button class="btn" data-act="today">${ic('cal')}Today</button>`) +
  `<div class="calw"><div class="card"><div class="cal-h"><h3>${MON[m]} ${y}</h3><div class="cal-n"><button data-act="mon" data-k="-1" aria-label="Bulan sebelumnya">${ic('chevL')}</button><button data-act="mon" data-k="1" aria-label="Bulan berikutnya">${ic('chevR')}</button></div></div><div class="cg">${hdr}${cells}</div><div class="clg">${Object.entries(col).map(([k, c]) => `<span><i style="background:${c}"></i>${k[0].toUpperCase() + k.slice(1)}</span>`).join('')}</div></div>
  <div class="side-c"><div class="card agenda"><p class="lab">${sel === off(0) ? 'Today · ' : ''}${DOW[sd.getDay()]}</p><h2>${MON[sd.getMonth()]} ${sd.getDate()}</h2>${day.map(e => `<div class="aev" style="border-color:${col[e.type]}"><div><b>${esc(e.title)}</b><small>${esc(e.time)} · ${e.type}</small></div><div style="display:flex;align-items:center;gap:4px"><button class="x" data-act="ev-edit" data-id="${e.id}" aria-label="Edit event">${ic('edit')}</button><button class="x" data-act="ev-del" data-id="${e.id}" aria-label="Hapus event">${ic('trash')}</button></div></div>`).join('') || '<div class="empty">Nothing scheduled</div>'}</div>
  <div class="card"><h3>Coming up</h3>${coming.map(e => { const d = parse(e.date); return `<div class="up"><span class="dt">${MON[d.getMonth()].slice(0, 3).toUpperCase()}<b>${d.getDate()}</b></span><div><b>${esc(e.title)}</b><small>${e.date === off(0) ? 'Today' : diff(e.date) === 1 ? 'Tomorrow' : DOW[d.getDay()]} · ${esc(e.time)}</small></div><button class="x" data-act="ev-edit" data-id="${e.id}" style="margin-left:auto">${ic('edit')}</button></div>`; }).join('') || '<p class="mut">Kosong.</p>'}</div></div></div>`;
}

function vProf() {
  const m = S.me;
  const isCustomDiv = m.div && !DIVISIONS.includes(m.div);
  const divOpts = DIVISIONS.map(d => `<option value="${d}" ${d === m.div ? 'selected' : ''}>${d}</option>`).join('') +
    `<option value="_custom" ${isCustomDiv ? 'selected' : ''}>Lainnya (Isi sendiri)...</option>`;
  const curAv = m.avatar?.startsWith('preset:') ? (AVATAR_PRESETS.find(x => x[0] === m.avatar)?.[1] || '👤') : m.avatar ? `<img src="${m.avatar}">` : ini(m.name);
  const curAvCls = m.avatar?.startsWith('preset:') ? 'av-preset' : m.avatar ? 'av-img' : '';
  const avPresetsHtml = AVATAR_PRESETS.map(([id, emoji, label]) => `<button type="button" class="av-pbtn ${m.avatar === id ? 'on' : ''}" data-act="pick-av" data-id="${id}" title="${label}">${emoji}</button>`).join('');
  const roleCls = { 'Ketua Tim': 'role-lead', 'Project Manager': 'role-pm', 'Member': 'role-member', 'Viewer': 'role-viewer' }[m.teamRole] || 'role-member';

  return head('Profile Saya', 'Kelola identitas, foto profil, domisili, dan data pribadimu.') +
    `<div class="prof-hero">
      <div class="av-preview-wrap" style="margin:0;padding:6px">
        <span class="av lg ${curAvCls}" style="width:72px;height:72px;font-size:32px">${curAv}</span>
      </div>
      <div class="prof-info" style="flex:1">
        <h2>${esc(m.name)}</h2>
        <div class="prof-meta">
          <span style="font-weight:700;color:var(--txt)">@${esc(m.username || 'user' + m.id)}</span> · 
          <span class="role-badge ${roleCls}">👑 ${esc(m.teamRole || 'Member')}</span> · 
          <span class="div-badge">${esc(m.div)}</span>
        </div>
        <p class="mut" style="font-size:12px;margin:4px 0 0">${esc(m.email)} · <span style="color:#15803d;font-weight:600">✓ Akun Terverifikasi</span></p>
      </div>
    </div>
    <div class="prof-grid">
      <div class="card panel">
        <h3>Edit Informasi Profil</h3>
        <p class="mut" style="font-size:12px;margin:-4px 0 16px">Perubahan data diri akan langsung diperbarui di semua tim kamu.</p>
        <form id="pf" class="f">
          <div class="field">
            <label class="lab">Foto Profil / Avatar</label>
            <div class="av-preview-wrap">
              <span class="av lg ${curAvCls}" id="setAvPrev">${curAv}</span>
              <div>
                <div class="fa" style="margin:0 0 6px">
                  <input type="file" id="avFile" accept="image/*" style="display:none">
                  <button type="button" class="btn sm" data-act="trigger-av-file">${ic('upload')} Upload Foto</button>
                  <button type="button" class="btn sm" data-act="reset-av">Reset Inisial</button>
                </div>
                <small class="mut">Pilih ikon preset di bawah atau upload foto sendiri (otomatis dipotong 128x128).</small>
              </div>
            </div>
            <div class="av-preset-grid">${avPresetsHtml}</div>
          </div>
          <div class="two">
            ${field('Nama Lengkap', `<input class="in" name="name" required minlength="2" maxlength="50" value="${esc(m.name)}">`)}
            ${field('Username <small class="mut">(unik)</small>', `<div style="display:flex;align-items:center"><span style="padding:0 8px;font-weight:700;color:var(--mut)">@</span><input class="in" name="username" required minlength="3" maxlength="30" value="${esc(m.username || '')}" placeholder="username"></div>`)}
          </div>
          <div class="two">
            ${field('Email Akun', `<input class="in" type="email" value="${esc(m.email)}" readonly aria-readonly="true">`)}
            ${field('Peran Utama', `<div style="display:flex;align-items:center;height:42px"><span class="role-badge ${roleCls}">${esc(m.teamRole || 'Member')}</span></div>`)}
          </div>
          ${field('Divisi', `<select class="in" name="division_sel" id="pfDivSel">${divOpts}</select>`)}
          <div class="field" id="pfCustomDivWrap" ${isCustomDiv ? '' : 'hidden'}>
            <label class="lab">Nama Divisi Kustom</label>
            <input class="in" name="division_custom" maxlength="50" value="${isCustomDiv ? esc(m.div) : ''}" placeholder="Tuliskan nama divisimu">
          </div>
          ${field('Alamat Tinggal / Domisili', `<input class="in" name="address" maxlength="150" value="${esc(m.address || '')}" placeholder="Contoh: Jl. Sudirman No. 12, Jakarta">`)}
          <div class="two">
            ${field('Tempat Lahir', `<input class="in" name="birthPlace" maxlength="50" value="${esc(m.birthPlace || '')}" placeholder="Kota tempat lahir">`)}
            ${field('Tanggal Lahir', `<input class="in" type="date" name="birthDate" value="${esc(m.birthDate || '')}">`)}
          </div>
          <div class="tg" style="margin:8px 0 16px">
            <div><b>Bagikan tanggal lahir ke tim</b><small>Anggota tim lain akan menerima notifikasi ucapan selamat saat hari ulang tahunmu tiba 🎉</small></div>
            <input type="checkbox" name="shareBirthday" class="sw2-chk" ${m.shareBirthday ? 'checked' : ''} style="width:20px;height:20px">
          </div>
          ${field('Bio / Catatan', `<textarea class="in" name="bio" maxlength="200" placeholder="Ceritakan sedikit tentang dirimu...">${esc(m.bio)}</textarea>`, 1)}
          <div class="fa w"><button class="btn primary">Simpan Perubahan Profil</button></div>
        </form>
      </div>
      <div>
        <div class="card" style="margin-bottom:14px">
          <h3>Keamanan Akun</h3>
          <p class="mut" style="font-size:12px;margin:4px 0 14px">Ubah kata sandi akunmu untuk menjaga keamanan workspace.</p>
          <button class="btn wide" data-act="go-pwd">${ic('shield')} Ubah Kata Sandi</button>
        </div>
        <div class="card">
          <h3>Tampilan &amp; Preferensi</h3>
          <p class="mut" style="font-size:12px;margin:4px 0 14px">Sesuaikan tema warna aksen dan permulaan hari kerja.</p>
          <button class="btn wide" data-act="go-look">${ic('palette')} Pengaturan Tampilan</button>
        </div>
      </div>
    </div>`;
}

function vAna() {
  const A = AN, { n, cur, prev, series, heat, byProject, top, kpi } = A, L = 34, R = 10, T = 14, B = 24, W = 600, H = 220;
  const avg = a => a.map((_, i) => { const s = a.slice(Math.max(0, i - 6), i + 1); return s.reduce((x, y) => x + y, 0) / s.length; });
  const ac = avg(cur), ap = avg(prev), mx = Math.max(6, Math.ceil(Math.max(...ac, ...ap, ...cur) / 3) * 3 + 3);
  AD = { n, cur, prev, ac, ap, L, R, T, B, mx };
  const dl = (c, p, inv) => { if (!p) return '<small class="mut">No previous data</small>'; const v = (c - p) / p * 100, good = inv ? v < 0 : v >= 0; return `<small class="${good ? 'up-c' : 'dn-c'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}% <span class="mut">vs previous ${AR}d</span></small>`; };
  const bucket = (a, sum) => { const k = Math.max(1, Math.ceil(a.length / 12)), o = []; for (let i = 0; i < a.length; i += k) { const s = a.slice(i, i + k), t = s.reduce((x, y) => x + y, 0); o.push(sum ? t : t / s.length); } return o.length > 1 ? o : [0, ...o]; };
  const X = i => L + i * (W - L - R) / (n - 1), Y = v => T + (H - T - B) * (1 - v / mx);
  const path = a => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const grid = [0, 1, 2, 3, 4].map(i => { const v = mx / 4 * i; return `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef1f7"/><text x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${Math.round(v)}</text>`; }).join('');
  const lbl = [0, 1, 2, 3, 4].map(k => { const i = Math.round(k * (n - 1) / 4); return `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${short(off(i - n + 1))}</text>`; }).join('');
  const cols = ['var(--ac)', 'var(--ac-mid)', '#e9a319', '#94a3b8', '#cfd6e4'], tot = byProject.reduce((a, p) => a + p.h, 0);
  let acc = 0; const arcs = tot ? byProject.map((p, i) => { const s = p.h / tot * 100, a = `<circle cx="50" cy="50" r="38" fill="none" stroke="${cols[i]}" stroke-width="13" pathLength="100" stroke-dasharray="${Math.max(0.5, s - 1.2)} ${101.2 - s}" stroke-dashoffset="${-acc}"/>`; acc += s; return a; }).join('') : '<circle cx="50" cy="50" r="38" fill="none" stroke="#e9edf5" stroke-width="13"/>';
  const hm = Math.max(1, ...heat), hcells = heat.map((c, i) => `<i style="--l:${c ? Math.min(4, Math.ceil(c / hm * 4)) : 0};--d:${i}" title="${c} activities"></i>`).join('');
  const tm = Math.max(1, ...top.map(t => t.c));
  const k = [['Tasks completed', kpi.tasks[0], 0, '', dl(...kpi.tasks), bucket(series.tasks, true)], ['Hours tracked', kpi.hours[0], 0, '', dl(...kpi.hours), bucket(series.hours, true)], ['On-time delivery', kpi.ontime[0], 0, '%', dl(...kpi.ontime), bucket(series.ontime)], ['Avg. cycle time', kpi.cycle[0], 1, 'd', dl(...kpi.cycle, 1), bucket(series.cycle)]];
  return head('Analytics', 'How the team is shipping, and where the time goes.', `<div class="seg" role="group" aria-label="Rentang">${[7, 30, 90].map(r => `<button class="${AR === r ? 'on' : ''}" data-act="range" data-k="${r}">${r}D</button>`).join('')}</div><button class="btn" data-act="csv">${ic('download')}Export CSV</button>`) +
  `<div class="grid g4" style="margin-bottom:14px">${k.map(([t, v, d, s, dd, sp], i) => `<div class="card kpi"><h4>${t}</h4><div class="n">${num('k' + i, v, d, s)}</div>${dd}${spark(sp, i)}</div>`).join('')}</div>
  <div class="grid g21 mb"><div class="card"><h3>Throughput <span class="lg2"><span><i></i>This period</span><span><i class="d"></i>Previous</span></span></h3><p class="mut" style="font-size:11px;margin:-6px 0 6px">Tasks completed per day, 7-day average, against the previous period</p>
    <div class="lc-wrap"><svg viewBox="0 0 ${W} ${H}"><defs><linearGradient id="ar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--ac)" stop-opacity=".3"/><stop offset="1" stop-color="var(--ac)" stop-opacity="0"/></linearGradient></defs>${grid}${lbl}<path d="${path(ac)}L${X(n - 1)} ${Y(0)}L${X(0)} ${Y(0)}Z" fill="url(#ar)"/><path d="${path(ap)}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3"/><path class="draw" pathLength="1" d="${path(ac)}" fill="none" stroke="var(--ac)" stroke-width="2.2" stroke-linejoin="round"/><line id="xh" y1="${T}" y2="${H - B}" stroke="#94a3b8" stroke-dasharray="3 3" opacity="0"/><circle id="xd" r="4.5" fill="#fff" stroke="var(--ac)" stroke-width="2.2" opacity="0"/></svg><div class="tip" id="tip"></div></div></div>
    <div class="card"><h3>Time by project</h3><div class="donut"><svg viewBox="0 0 100 100">${arcs}</svg><div class="c"><b>${num('hrs', Math.round(tot))}h</b><small>tracked ${AR}d</small></div></div><div class="dl">${byProject.map((p, i) => `<div><i style="background:${cols[i]}"></i>${esc(p.name)}<b>${fmtN(p.h, 1)}h</b></div>`).join('') || '<p class="mut">Belum ada waktu tercatat. Gunakan Time Tracker di Dashboard.</p>'}</div></div></div>
  <div class="grid g21"><div class="card"><h3>Activity <span class="hl">Less ${[0, 1, 2, 3, 4].map(l => `<i style="--l:${l}"></i>`).join('')} More</span></h3><p class="mut" style="font-size:11px;margin:-6px 0 8px">Task, project and time-log activity, last 20 weeks</p><div class="heat">${hcells}</div></div>
    <div class="card"><h3>Top contributors</h3><div class="contrib">${top.map(t => `<div class="r">${av(mem(t.id))}<span style="min-width:92px">${esc(t.name)}</span><div class="bb"><i style="width:${t.c / tm * 100}%"></i></div><b>${t.c}</b></div>`).join('') || '<p class="mut">Belum ada task selesai pada periode ini.</p>'}</div></div></div>`;
}

function vSet() {
  const nav = [['security', 'shield', 'Kata Sandi'], ['notif', 'bellS', 'Notifications'], ['look', 'palette', 'Appearance']].map(([k, i, l]) => `<button class="${ST === k ? 'on' : ''}" data-act="st" data-k="${k}">${ic(i)}${l}</button>`).join('');
  let p; const m = S.me;
  if (ST === 'notif') {
    const n = m.notif, rows = [['assign', 'Task assignments', 'Saat kamu ditugaskan ke task baru'], ['due', 'Deadline reminders', 'Pengingat H-7, H-3, H-2 dan H-1 untuk task dan project'], ['chat', 'Chat messages', 'Teruskan pesan baru ke Telegram saat kamu offline'], ['report', 'Project reports', 'Laporan PDF saat project selesai'], ['personal', 'Pengingat pribadi', 'Catatan, tugas pribadi, tagihan, wishlist, dan travel']];
    const tgc = !S.tg.enabled ? `<p class="mut" style="font-size:12px">Bot Telegram belum dikonfigurasi di server. Isi <code>TELEGRAM_BOT_TOKEN</code> di file <code>.env</code> lalu restart server.</p>`
      : m.tg ? `<div class="tg-st"><span class="pill s-ended">Connected</span><div class="fa" style="margin:0"><button class="btn sm" data-act="tg-test">Send test</button><button class="btn sm danger" data-act="tg-unlink">Disconnect</button></div></div>`
      : `<div class="tg-st"><span class="pill s-pending">Not connected</span><button class="btn sm primary" data-act="tg-link">${ic('send')}Connect Telegram</button></div>`;
    p = `<h2>Notifications</h2><p>Pilih kabar apa yang ingin kamu terima.</p>${rows.map(([k, t, d]) => `<div class="tg"><div><b>${t}</b><small>${d}</small></div><button class="sw2" role="switch" aria-checked="${n[k] !== false}" aria-label="${t}" data-act="tog" data-k="${k}"></button></div>`).join('')}<p class="lab2">Telegram</p><div class="tgcard"><p style="font-size:12.5px;margin-bottom:10px">Hubungkan akunmu ke bot Telegram untuk menerima notifikasi deadline, penugasan, dan laporan project langsung di ponsel.</p>${tgc}</div>`;
  } else if (ST === 'look') {
    const groups = [
      {
        title: 'Nuansa Biru',
        items: [
          ['ocean', 'Ocean Blue (Default)', '#2563eb'],
          ['navy', 'Biru Navy', '#1e3a8a'],
          ['slate-blue', 'Biru + Abu (Denim)', '#3b6084'],
          ['sky', 'Biru Langit (Sky)', '#0284c7']
        ]
      },
      {
        title: 'Nuansa Kuning & Emas',
        items: [
          ['soft-yellow', 'Kuning Lembut (Honey)', '#d97706'],
          ['sunshine', 'Kuning Nyala (Canary)', '#eab308']
        ]
      },
      {
        title: 'Nuansa Hijau & Alami',
        items: [
          ['forest', 'Hijau Forest', '#16a34a'],
          ['sage', 'Hijau Sage / Mint', '#059669'],
          ['olive', 'Hijau Zaitun (Olive)', '#65a30d']
        ]
      },
      {
        title: 'Nuansa Ungu & Berry',
        items: [
          ['plum', 'Ungu Plum', '#7c3aed'],
          ['lavender', 'Lavender Lembut', '#9333ea'],
          ['rose', 'Merah Mawar (Rose)', '#e11d48']
        ]
      },
      {
        title: 'Nuansa Hangat, Tanah & Tinta',
        items: [
          ['ember', 'Jingga Bara (Ember)', '#ea580c'],
          ['terracotta', 'Merah Bata (Terracotta)', '#c2410c'],
          ['mocha', 'Moka Kertas (Mocha)', '#78350f'],
          ['ink', 'Tinta Arang (Charcoal)', '#1e293b']
        ]
      }
    ];
    const groupHtml = groups.map(g => `
      <div class="acc-group">
        <div class="acc-group-title">${g.title}</div>
        <div class="acc">${g.items.map(([k, l, c]) => `
          <button class="acb ${(m.accent || 'ocean') === k ? 'on' : ''}" data-act="accent" data-k="${k}" title="${l}">
            <i style="background:${c}"></i><span>${l}</span>
          </button>`).join('')}
        </div>
      </div>`).join('');
    p = `<h2>Warna &amp; Tampilan</h2>
      <p>Pilih tema aksen warna untuk ruang kerja kamu. Seluruh tombol, highlight teks, indikator navigasi, dan elemen visual akan menyesuaikan secara harmonis dengan warna yang kamu pilih.</p>
      <p class="lab2" style="margin-top:0">Pilihan Aksen Warna Tema</p>
      ${groupHtml}
      <p class="lab2">Awal Minggu</p>
      <div class="pillb">${['Sunday', 'Monday'].map((l, i) => `<button class="${m.week === i ? 'on' : ''}" data-act="week" data-k="${i}">${l}</button>`).join('')}</div>`;
  } else {
    // default to 'security' (Kata Sandi)
    const pwForm = m.hasPassword ? `
      ${field('Kata Sandi Saat Ini', `<input class="in" type="password" name="oldPassword" required placeholder="Masukkan kata sandi lama">`)}
      ${field('Kata Sandi Baru', `<input class="in" type="password" name="newPassword" required minlength="8" placeholder="Minimal 8 karakter">`)}
      ${field('Konfirmasi Kata Sandi Baru', `<input class="in" type="password" name="confirmPassword" required placeholder="Ulangi kata sandi baru">`)}
    ` : `
      <p class="mut" style="font-size:12.5px;margin-bottom:12px">Akunmu terhubung via Google dan belum memiliki kata sandi mandiri. Kamu dapat membuat kata sandi untuk login alternatif.</p>
      ${field('Kata Sandi Baru', `<input class="in" type="password" name="newPassword" required minlength="8" placeholder="Minimal 8 karakter">`)}
      ${field('Konfirmasi Kata Sandi Baru', `<input class="in" type="password" name="confirmPassword" required placeholder="Ulangi kata sandi baru">`)}
    `;
    p = `<h2>Kata Sandi &amp; Keamanan</h2><p>Kelola kata sandi akunmu untuk keamanan akun.</p><form id="pwf" class="f">${pwForm}<div class="fa w"><button class="btn primary">Perbarui Kata Sandi</button></div></form>`;
  }
  return head('Settings', 'Keamanan kata sandi, notifikasi, dan preferensi tampilan.') + `<div class="sw"><div class="card snav">${nav}</div><div class="card panel">${p}</div></div>`;
}

const ROUTES = { dashboard: [vDash, 'Dashboard', 'Search projects & people'], tasks: [vTasks, 'Tasks', 'Search tasks'], calendar: [vCal, 'Calendar', 'Search events'], analytics: [vAna, 'Analytics', 'Search'], team: [vTeam, 'Team', 'Search people'], profile: [vProf, 'Profile', 'Search profile'], settings: [vSet, 'Settings', 'Search'] };

/* ---------- time tracker (local, logged to the DB on stop) ---------- */
const TT = { sec: 0, run: false, pid: 0 };
const tkey = () => 'luki-timer-' + S.me.id;
function ttLoad() {
  Object.assign(TT, { sec: 0, run: false, pid: 0 });
  try { const j = JSON.parse(localStorage.getItem(tkey())); if (j) { TT.sec = j.sec | 0; TT.run = !!j.run; TT.pid = j.pid | 0; if (TT.run) TT.sec += Math.max(0, Math.floor((Date.now() - j.ts) / 1000)); } } catch { /* fresh timer */ }
}
function ttSave() { try { localStorage.setItem(tkey(), JSON.stringify({ sec: TT.sec, run: TT.run, ts: Date.now(), pid: TT.pid })); } catch { /* storage blocked */ } }
const ttFmt = s => [s / 3600 | 0, s / 60 % 60 | 0, s % 60].map(v => String(v).padStart(2, '0')).join(':');
function syncTT() {
  $$('.tt-time').forEach(e => e.textContent = ttFmt(TT.sec));
  $$('[data-act=tt-toggle]').forEach(b => b.innerHTML = ic(TT.run ? 'pause' : 'play'));
  $$('.tt').forEach(e => e.classList.toggle('run', TT.run));
}

/* ---------- render pipeline ---------- */
function tween(el, from, to) {
  const d = +el.dataset.d || 0, s = el.dataset.s || '';
  if (reduce || from === to) { el.textContent = fmtN(to, d) + s; return; }
  const t0 = performance.now();
  (function f(t) { const p = Math.min(1, (t - t0) / 700), e = 1 - (1 - p) ** 3; el.textContent = fmtN(from + (to - from) * e, d) + s; if (p < 1) requestAnimationFrame(f); })(t0);
}
function post() {
  $$('.num').forEach(el => { const k = el.dataset.k, to = +el.dataset.v; tween(el, PV[k] ?? 0, to); PV[k] = to; });
  $$('.gauge-arc').forEach(el => { const to = el.dataset.v; el.style.strokeDasharray = `${PV.g ?? 0} 100`; el.getBoundingClientRect(); el.style.strokeDasharray = `${to} 100`; PV.g = +to; });
  syncTT();
  if (!S) return;
  $('#badge').textContent = S.tasks.filter(t => t.stage !== 'done').length;
  const un = Object.values(S.unread).reduce((a, b) => a + b, 0), tb = $('#tbadge'); tb.hidden = !un; tb.textContent = un;
  $('#dot').classList.toggle('on', S.notifs.some(n => n.unread));
  $('#meName').textContent = S.me.name;
  $('#meMail').textContent = S.me.username ? '@' + S.me.username : S.me.email;
  const a = $('#meAv');
  if (S.me.avatar?.startsWith('preset:')) {
    const p = AVATAR_PRESETS.find(x => x[0] === S.me.avatar);
    a.className = 'av av-preset'; a.innerHTML = p ? p[1] : '👤'; a.style.removeProperty('--h');
  } else if (S.me.avatar) {
    a.className = 'av av-img'; a.innerHTML = `<img src="${S.me.avatar}">`; a.style.removeProperty('--h');
  } else {
    a.className = 'av'; a.textContent = ini(S.me.name); a.style.setProperty('--h', hue(S.me.id));
  }
  $$('.nav a[data-r]').forEach(a => a.dataset.r === cur ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
}
/* per-route data loaders (analytics, personal, admin). READY[k] false => fetch before painting. */
const LOADERS = { analytics: async () => { AN = await api('GET', '/api/analytics?days=' + AR); } };
let READY = {};
function paint(enter) {
  if (!S) return;
  const k = cur;
  if (LOADERS[k] && !READY[k]) { LOADERS[k]().then(() => { READY[k] = true; if (cur === k) paint(enter); }).catch(e => e.message !== 'auth' && toast(e.message)); return; }
  const [fn, title, ph2] = ROUTES[cur];
  document.title = title + ' · LUKI MANAGEMENT'; $('#q').placeholder = ph2;
  document.documentElement.dataset.accent = S.me.accent || 'ocean';
  const sy = view.scrollTop; view.innerHTML = fn(); view.className = 'view' + (enter ? ' enter' : ''); view.scrollTop = enter ? 0 : sy; post();
}
function route() {
  if (!S) return;
  const r = location.hash.replace(/^#\/?/, '') || 'dashboard'; cur = ROUTES[r] ? r : 'dashboard'; PV = {}; Q = ''; $('#q').value = '';
  const t = ++tok; closePop(); document.body.classList.remove('nav-open');
  view.className = 'view'; view.innerHTML = '<div class="skel"><i></i><i></i><i></i></div>'; post();
  setTimeout(() => { if (t === tok) paint(true); }, reduce ? 0 : 160);
}
const busy = () => $('.ov') || popEl || dragId || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && view.contains(document.activeElement);
async function refresh() {
  if (!S) return; if (busy()) { dirty = true; return; }
  dirty = false; try { await load(); READY = {}; paint(false); } catch (e) { /* offline or logged out: ignore */ }
}

/* ---------- auth ---------- */
function showAuth() {
  closeLayer(true); closePop(); es?.close(); es = null; S = null; AN = null; READY = {};
  document.body.className = 'auth'; document.documentElement.dataset.accent = 'ocean';
}
let vMail = '';
const card = () => $('.a-card');
function setTab(t) {
  $$('.a-tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', b.dataset.tab === t); });
  $('.a-tabs').dataset.t = t; $('#fLogin').hidden = t !== 'login'; $('#fReg').hidden = t !== 'register';
  $('#vPanel').hidden = true; $('#forgotPanel').hidden = true; $('#resetPanel').hidden = true; card().classList.remove('verifying');
  $$('.a-err').forEach(e => e.textContent = ''); $('#fLogin [data-resend]').hidden = true;
  const fm = $('#forgotMsg'), rm = $('#resetMsg');
  if (fm) { fm.hidden = true; fm.textContent = ''; }
  if (rm) { rm.hidden = true; rm.textContent = ''; }
}
function showVerify(email, sent) {
  vMail = email; $('#vEmail').textContent = email; $('#vNote').hidden = sent !== false;
  $('#fLogin').hidden = $('#fReg').hidden = true; $('#vPanel').hidden = false; card().classList.add('verifying');
}
function authErr(f, msg) { const e = $('.a-err', f); e.textContent = msg; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); }
async function authSubmit(f, url, body) {
  const b = $('.primary', f); b.disabled = true;
  try {
    const r = await api('POST', url, body);
    if (r?.verify) { f.reset(); showVerify(r.email, r.sent); return; }
    f.reset(); await enter();
  } catch (e) {
    authErr(f, e.message);
    if (e.code === 'unverified') { vMail = body.email.trim(); $('[data-resend]', f).hidden = false; }
  } finally { b.disabled = false; }
}
let resendAt = 0;
async function resend() {
  if (!vMail) return;
  const wait = Math.ceil((resendAt - Date.now()) / 1000); if (wait > 0) return toast(`Tunggu ${wait} detik sebelum kirim ulang`);
  resendAt = Date.now() + 60000;
  try { await api('POST', '/api/auth/resend', { email: vMail }); toast('Email verifikasi dikirim ulang. Cek inbox/spam.'); } catch (e) { toast(e.message); }
}
$$('[data-resend]').forEach(b => b.addEventListener('click', resend));
$$('[data-tab-back]').forEach(b => b.addEventListener('click', () => setTab('login')));
$$('[data-go]').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.go); document.documentElement.classList.remove('lp-open'); $('#masuk').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); setTimeout(() => $(`#${b.dataset.go === 'login' ? 'fLogin' : 'fReg'} input`)?.focus({ preventScroll: true }), 450); }));
$('[data-lp-menu]').addEventListener('click', e => { const o = document.documentElement.classList.toggle('lp-open'); e.currentTarget.setAttribute('aria-expanded', o); });
$$('#lpNav a').forEach(a => a.addEventListener('click', () => document.documentElement.classList.remove('lp-open')));
$('#fLogin').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, d = Object.fromEntries(new FormData(f));
  if (!d.email.trim() || !d.password) return authErr(f, 'Isi email dan password');
  authSubmit(f, '/api/auth/login', d);
});
$('[data-act="forgot-link"]')?.addEventListener('click', e => {
  e.preventDefault();
  card().classList.add('verifying');
  $('#fLogin').hidden = true; $('#fReg').hidden = true; $('#vPanel').hidden = true; $('#resetPanel').hidden = true;
  $('#forgotPanel').hidden = false;
  $('#forgotEmailIn').value = $('#fLogin [name=email]')?.value || '';
  const msgEl = $('#forgotMsg'); if (msgEl) { msgEl.hidden = true; msgEl.textContent = ''; }
  $('#forgotEmailIn')?.focus();
});
$('#fForgot')?.addEventListener('submit', async e => {
  e.preventDefault();
  const email = ($('#forgotEmailIn')?.value || '').trim();
  const msgEl = $('#forgotMsg');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !EMAIL_RE.test(email)) {
    if (msgEl) {
      msgEl.className = 'vmsg error';
      msgEl.hidden = false;
      msgEl.innerHTML = '⚠️ Masukkan alamat email yang valid.';
    }
    return;
  }
  const btn = $('#fForgot .primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }
  try {
    const res = await api('POST', '/api/auth/forgot-password', { email });
    toast('Tautan pemulihan terkirim!');
    if (msgEl) {
      msgEl.className = 'vmsg success';
      msgEl.hidden = false;
      msgEl.innerHTML = `✅ ${esc(res.message)}`;
    }
  } catch (err) {
    if (msgEl) {
      msgEl.className = 'vmsg error';
      msgEl.hidden = false;
      const isUnregistered = err.message && err.message.toLowerCase().includes('belum terdaftar');
      if (isUnregistered) {
        msgEl.innerHTML = `⚠️ <b>Email belum terdaftar.</b> Akun dengan email <i>${esc(email)}</i> tidak ditemukan.<br><button type="button" class="btn sm primary" data-act="go-reg" style="margin-top:10px">Daftar Akun Baru Sekarang</button>`;
      } else {
        msgEl.innerHTML = `⚠️ ${esc(err.message)}`;
      }
    }
    toast(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Kirim Tautan'; }
  }
});
$('#fReset')?.addEventListener('submit', async e => {
  e.preventDefault();
  const tok = $('#resetTokenIn')?.value;
  const pw = $('#resetPwIn')?.value || '';
  const conf = $('#resetPwConf')?.value || '';
  const msgEl = $('#resetMsg');
  if (pw.length < 8) {
    if (msgEl) { msgEl.className = 'vmsg error'; msgEl.hidden = false; msgEl.innerHTML = '⚠️ Kata sandi baru minimal 8 karakter'; }
    return;
  }
  if (pw !== conf) {
    if (msgEl) { msgEl.className = 'vmsg error'; msgEl.hidden = false; msgEl.innerHTML = '⚠️ Konfirmasi kata sandi tidak cocok'; }
    return;
  }
  const btn = $('#fReset .primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
  try {
    await api('POST', '/api/auth/reset-password', { token: tok, password: pw });
    toast('Kata sandi berhasil diperbarui! Silakan login.');
    const u = new URL(location); u.searchParams.delete('resetToken');
    history.replaceState(null, '', u.pathname + u.hash);
    setTab('login');
  } catch (err) {
    if (msgEl) { msgEl.className = 'vmsg error'; msgEl.hidden = false; msgEl.innerHTML = `⚠️ ${esc(err.message)}`; }
    toast(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Sandi Baru'; }
  }
});
$('#fReg').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, d = Object.fromEntries(new FormData(f));
  if (d.name.trim().length < 2) return authErr(f, 'Nama minimal 2 karakter');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) return authErr(f, 'Email tidak valid');
  const un = (d.username || '').trim().toLowerCase();
  if (!un) return authErr(f, 'Username unik wajib diisi');
  if (!/^[a-z0-9_.]{3,30}$/.test(un)) return authErr(f, 'Username hanya boleh huruf kecil, angka, titik, atau garis bawah (3-30 karakter)');
  if (d.password.length < 8) return authErr(f, 'Password minimal 8 karakter');
  if (d.password !== d.confirm) return authErr(f, 'Konfirmasi password tidak sama');
  const div = d.division_sel === '_custom' ? (d.division_custom || '').trim() : d.division_sel;
  if (!div) return authErr(f, 'Tentukan divisi kamu');
  const payload = {
    name: d.name.trim(),
    email: d.email.trim().toLowerCase(),
    password: d.password,
    username: un,
    division: div
  };
  authSubmit(f, '/api/auth/register', payload);
});
$$('.a-tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$$('[data-eye]').forEach(b => b.addEventListener('click', () => { const i = b.previousElementSibling, show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Sembunyi' : 'Lihat'; b.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password'); }));

let inited = false;
async function enter() {
  await load(); ttLoad();
  document.documentElement.dataset.accent = S.me.accent || 'ocean';
  document.body.className = 'in';
  $('.admin-only').hidden = !S.me.admin;
  connect(); route();
}

/* ---------- realtime (SSE) ---------- */
let es = null;
function connect() {
  es?.close(); es = new EventSource('/api/stream');
  es.onmessage = e => {
    let d; try { d = JSON.parse(e.data); } catch { return; }
    if (!S) return;
    if (d.type === 'data') refresh();
    else if (d.type === 'presence') { const m = mem(d.id); if (m) { m.on = d.on; if (cur === 'team' && !busy()) paint(false); } }
    else if (d.type === 'notif') { toast(d.text); load().then(post).catch(() => {}); }
    else if (d.type === 'tg') { load().then(() => { if ($('.ov.modal')) closeLayer(); if (cur === 'settings') paint(false); toast(d.linked ? 'Telegram terhubung' : 'Telegram terputus'); }); }
    else if (d.type === 'message') onMessage(d.message);
    else if (d.type === 'task_comment') { if (activeDetailTaskId === d.taskId) refreshTaskDetail(d.taskId); }
    else if (d.type === 'logout') { showAuth(); toast('Sesi kamu diakhiri oleh admin'); }
    else if (d.type === 'personal') { READY.personal = false; if (cur === 'personal' && !busy()) paint(false); }
  };
}

/* ---------- chat ---------- */
function onMessage(m) {
  const mine = m.from_id === S.me.id, peer = mine ? m.to_id : m.from_id;
  if (chat && chat.id === peer) { addMsg(m); if (!mine) api('GET', '/api/messages/' + peer).catch(() => {}); return; }
  if (mine) return;
  S.unread[peer] = (S.unread[peer] || 0) + 1; post();
  toast(`${mem(peer)?.name || 'Pesan baru'}: ${m.body.slice(0, 60)}`);
  if (cur === 'team' && !busy()) paint(false);
}
function msgHtml(m, prev) {
  const mine = m.from_id === S.me.id, d = iso(new Date(m.created_at));
  const sep = !prev || iso(new Date(prev.created_at)) !== d ? `<div class="msep">${d === off(0) ? 'Today' : short(d)}</div>` : '';
  return `${sep}<div class="msg ${mine ? 'me' : ''}" data-id="${m.id}"><p>${esc(m.body)}</p><small>${hhmm(m.created_at)}</small></div>`;
}
function addMsg(m) {
  if (!chat || chat.msgs.some(x => x.id === m.id)) return;
  const box = $('#msgs'); const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || m.from_id === S.me.id;
  box.querySelector('.empty')?.remove(); box.insertAdjacentHTML('beforeend', msgHtml(m, chat.msgs[chat.msgs.length - 1])); chat.msgs.push(m);
  if (near) box.scrollTop = box.scrollHeight;
}
async function openChat(id) {
  const m = mem(id); if (!m) return;
  const o = layer('drawer', `<div class="chat"><div class="chat-h">${av(m, 'lg')}<div><h3>${esc(m.name)}</h3><small class="mut"><i class="st-d ${m.on ? 'on' : ''}"></i>${m.on ? 'Online' : 'Offline'} · ${esc(m.role)}</small></div><button class="x" data-act="close" aria-label="Tutup chat">${ic('x')}</button></div><div class="msgs" id="msgs"><div class="empty">Memuat…</div></div><form class="chat-f" id="cf" autocomplete="off"><textarea class="in" rows="1" maxlength="2000" placeholder="Tulis pesan untuk ${esc(m.name.split(' ')[0])}…" aria-label="Pesan"></textarea><button class="btn primary" aria-label="Kirim">${ic('send')}</button></form></div>`);
  chat = { id, msgs: [] }; S.unread[id] = 0; post();
  const box = $('#msgs', o), ta = $('textarea', o);
  try { chat.msgs = await api('GET', '/api/messages/' + id); } catch (e) { if (e.message !== 'auth') toast(e.message); return; }
  if (!chat || chat.id !== id) return;
  box.innerHTML = chat.msgs.map((x, i) => msgHtml(x, chat.msgs[i - 1])).join('') || '<div class="empty">Belum ada pesan. Sapa dulu!</div>'; box.scrollTop = box.scrollHeight;
  const send = async () => { const body = ta.value.trim(); if (!body) return; ta.value = ''; ta.style.height = ''; try { addMsg(await api('POST', '/api/messages', { to: id, body })); } catch (e) { if (e.message !== 'auth') toast(e.message); ta.value = body; } };
  $('#cf', o).addEventListener('submit', e => { e.preventDefault(); send(); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  ta.focus();
}

/* ---------- actions ---------- */
function moveTask(id, stage) {
  const t = S.tasks.find(x => x.id === id); if (!t || t.stage === stage) return;
  const old = { stage: t.stage, prog: t.prog, completedAt: t.completedAt };
  Object.assign(t, { stage, prog: PROG[stage], completedAt: stage === 'done' ? Date.now() : null });
  paint(false); post();
  const el = $(`.tcard[data-id="${id}"]`); if (el) { el.classList.add('pop'); el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true }); }
  toast(`Moved to ${STAGES.find(s => s[0] === stage)[1]}`);
  api('PATCH', '/api/tasks/' + id, { stage }).then(load).catch(e => { Object.assign(t, old); paint(false); if (e.message !== 'auth') toast(e.message); });
}
const projOpts = sel => '<option value="">No project</option>' + S.projects.filter(p => p.status !== 'ended').map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
const memberChecks = (sel = []) => `<div class="chips">${S.members.map(m => `<label class="chk"><input type="checkbox" name="who" value="${m.id}" ${sel.includes(m.id) ? 'checked' : ''}><span>${av(m)}${esc(m.name.split(' ')[0])}</span></label>`).join('')}</div>`;
function dlFile(name, text, type = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }
const ago = t => { const m = (Date.now() - t) / 6e4 | 0; return m < 1 ? 'Just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${m / 60 | 0}h ago` : `${m / 1440 | 0}d ago`; };

let activeDetailTaskId = null;
async function openTaskDetail(taskId) {
  activeDetailTaskId = taskId;
  layer('drawer', `<div class="td-drawer" id="tdWrap"><div class="empty">Memuat detail task…</div></div>`);
  await refreshTaskDetail(taskId);
}

async function refreshTaskDetail(taskId) {
  const wrap = $('#tdWrap');
  if (!wrap || activeDetailTaskId !== taskId) return;
  try {
    const data = await api('GET', `/api/tasks/${taskId}/details`);
    const { task, checklists, comments } = data;
    const totalChk = checklists.length;
    const doneChk = checklists.filter(c => c.done).length;
    const pctChk = totalChk ? Math.round((doneChk / totalChk) * 100) : 0;
    const assigneesHtml = task.assignees.map(a => `<span class="td-assignee-pill">${av(a, 'sm')} ${esc(a.name.split(' ')[0])}</span>`).join('') || '<span class="mut" style="font-size:12px">Belum ada anggota ditugaskan</span>';

    wrap.innerHTML = `
      <div class="td-head">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="tag ${task.tag}">${task.tag}</span>
          <span class="pr ${task.prio}">${ic('flag')}${task.prio}</span>
          <span class="pill" style="font-size:11px;font-weight:700">${STAGES.find(s => s[0] === task.stage)?.[1] || task.stage}</span>
          ${task.projectName ? `<span class="pj" style="font-size:11px">📁 ${esc(task.projectName)}</span>` : ''}
        </div>
        <button class="x" data-act="close" aria-label="Tutup detail">${ic('x')}</button>
      </div>
      <div class="td-body" style="padding:16px 20px;overflow-y:auto;flex:1">
        <h2 style="font-size:20px;margin:0 0 8px;line-height:1.3">${esc(task.title)}</h2>
        <div style="display:flex;gap:12px;font-size:12.5px;color:var(--mut);margin-bottom:16px;flex-wrap:wrap">
          <span>📅 Jatuh tempo: <b style="color:var(--txt)">${short(task.due)}</b> (${dueLab(task)})</span>
        </div>
        <div class="td-sec">
          <label class="lab">Anggota Bertugas</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px">${assigneesHtml}</div>
        </div>
        <div class="td-sec">
          <label class="lab" style="display:flex;justify-content:space-between">
            <span>Deskripsi Task</span>
            <small class="mut">Tersimpan otomatis saat disimpan</small>
          </label>
          <form id="fTdDesc" style="margin-top:6px" data-id="${task.id}">
            <textarea class="in" name="description" rows="3" placeholder="Tambahkan penjelasan rinci mengenai task ini...">${esc(task.description || '')}</textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:6px">
              <button class="btn sm primary">Simpan Deskripsi</button>
            </div>
          </form>
        </div>
        <div class="td-sec">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h4 style="font-size:14px;margin:0">Sub-task &amp; Checklist (${doneChk}/${totalChk})</h4>
            <span style="font-size:12px;font-weight:700;color:var(--ac)">${pctChk}% Selesai</span>
          </div>
          <div class="prog" style="height:6px;margin-bottom:12px"><i style="width:${pctChk}%;background:var(--ac)"></i></div>
          <div class="td-chk-list">
            ${checklists.map(c => `
              <div class="td-chk-item ${c.done ? 'is-done' : ''}">
                <input type="checkbox" class="td-chk-box" data-act="td-chk-tog" data-id="${c.id}" data-tid="${task.id}" ${c.done ? 'checked' : ''}>
                <span class="td-chk-title">${esc(c.title)}</span>
                <button type="button" class="x sm td-chk-del" data-act="td-chk-del" data-id="${c.id}" data-tid="${task.id}" aria-label="Hapus checklist">${ic('trash')}</button>
              </div>
            `).join('') || '<p class="mut" style="font-size:12px;margin:6px 0">Belum ada sub-task. Tambahkan di bawah.</p>'}
          </div>
          <form id="fTdAddChk" data-id="${task.id}" style="display:flex;gap:6px;margin-top:10px">
            <input class="in sm" name="title" required maxlength="120" placeholder="Tambah sub-task / checklist baru..." style="flex:1">
            <button class="btn sm primary">${ic('plus')} Tambah</button>
          </form>
        </div>
        <div class="td-sec" style="margin-top:24px">
          <h4 style="font-size:14px;margin:0 0 12px">Diskusi &amp; Catatan (${comments.length})</h4>
          <div class="td-comments">
            ${comments.map(c => {
              const cUser = { id: c.userId, name: c.userName, username: c.userUsername, avatar: c.userAvatar };
              const isMine = c.userId === S.me.id || S.me.admin;
              return `
                <div class="td-comm">
                  ${av(cUser, 'sm')}
                  <div class="td-comm-body">
                    <div class="td-comm-meta">
                      <b>${esc(c.userName)}</b>
                      <small class="mut">@${esc(c.userUsername || 'user' + c.userId)} · ${ago(c.createdAt)}</small>
                      ${isMine ? `<button type="button" class="x sm" data-act="td-comm-del" data-id="${c.id}" data-tid="${task.id}" title="Hapus komentar" style="margin-left:auto">${ic('trash')}</button>` : ''}
                    </div>
                    <p class="td-comm-txt">${esc(c.content)}</p>
                  </div>
                </div>
              `;
            }).join('') || '<p class="mut" style="font-size:12px;margin:8px 0">Belum ada diskusi untuk task ini. Mulai percakapan di bawah!</p>'}
          </div>
          <form id="fTdAddComm" data-id="${task.id}" style="margin-top:14px">
            <textarea class="in sm" name="content" required maxlength="1000" rows="2" placeholder="Tulis komentar atau progress task..."></textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:6px">
              <button class="btn sm primary">${ic('send')} Kirim</button>
            </div>
          </form>
        </div>
      </div>
    `;
  } catch (e) {
    wrap.innerHTML = `<div class="empty" style="color:var(--bad)">Gagal memuat task: ${esc(e.message)}</div>`;
  }
}

const ACT = {
  close: () => closeLayer(),
  'nav-open': () => document.body.classList.add('nav-open'),
  'nav-close': () => document.body.classList.remove('nav-open'),
  'task-detail': b => { closePop(); openTaskDetail(+b.dataset.id); },
  'td-chk-tog': async b => {
    const cid = +b.dataset.id, tid = +b.dataset.tid, done = b.checked ? 1 : 0;
    try {
      await api('PATCH', `/api/checklists/${cid}`, { done });
      await refreshTaskDetail(tid);
    } catch (e) {
      b.checked = !done;
      if (e.message !== 'auth') toast(e.message);
    }
  },
  'td-chk-del': async b => {
    const cid = +b.dataset.id, tid = +b.dataset.tid;
    try {
      await api('DELETE', `/api/checklists/${cid}`);
      await refreshTaskDetail(tid);
    } catch (e) {
      if (e.message !== 'auth') toast(e.message);
    }
  },
  'td-comm-del': async b => {
    const cid = +b.dataset.id, tid = +b.dataset.tid;
    try {
      await api('DELETE', `/api/comments/${cid}`);
      await refreshTaskDetail(tid);
    } catch (e) {
      if (e.message !== 'auth') toast(e.message);
    }
  },
  'add-project': () => form(`${modalHead('New project')}<form class="f">${field('Project name', '<input class="in" name="name" required maxlength="60" placeholder="e.g. Payment Gateway">', 1)}${field('Due date', `<input class="in" type="date" name="due" required value="${off(14)}">`, 1)}<div class="fa w"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Add project</button></div></form>`,
    async fd => { const n = fd.get('name').trim(); if (n) await mut('POST', '/api/projects', { name: n, due: fd.get('due') }, `"${n}" added to projects`); }),
  import: () => form(`${modalHead('Import projects')}<form><p class="mut" style="font-size:12px;margin-bottom:12px">File CSV dengan kolom <b>name,due,status</b> (due: YYYY-MM-DD; status: pending/running, opsional). Maks 200 baris.</p><label class="drop"><input type="file" name="f" accept=".csv,text/csv" required><span id="fn">Pilih file .csv</span></label><div class="fa"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Import</button></div></form>`,
    async fd => {
      const f = fd.get('f'); if (!f || !f.size) return; if (f.size > 2e5) return toast('File terlalu besar (maks 200 KB)');
      const lines = (await f.text()).split(/\r?\n/).filter(Boolean); if (/^name/i.test(lines[0])) lines.shift();
      const rows = lines.slice(0, 200).map(l => { const [name, due, status] = l.split(',').map(x => x.trim()); return { name, due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : off(14), status: ['pending', 'running'].includes(status) ? status : 'pending' }; });
      const r = await mut('POST', '/api/projects/import', { rows }, null); if (r) toast(r.imported ? `Imported ${r.imported} projects` : 'Tidak ada baris valid');
    }),
  cycle: b => {
    const p = S.projects.find(x => x.id === +b.dataset.id), o = ['pending', 'running', 'ended'], next = o[(o.indexOf(p.status) + 1) % 3];
    if (next !== 'ended') return mut('PATCH', '/api/projects/' + p.id, { status: next }, null);
    const open = S.tasks.filter(t => t.projectId === p.id && t.stage !== 'done').length;
    layer('modal', `${modalHead('Tandai project selesai?')}<p style="font-size:13px;line-height:1.5">Project <b>${esc(p.name)}</b> akan ditandai selesai. Laporan PDF lengkap dibuat otomatis dan dikirim ke semua anggota project${open ? `.<br><br><span style="color:var(--warn)"><b>${open}</b> task masih belum selesai dan akan dicatat di laporan.</span>` : '.'}</p><div class="fa"><button class="btn" data-act="close">Batal</button><button class="btn primary" data-act="finish" data-id="${p.id}">Tandai selesai</button></div>`);
  },
  finish: async b => { const r = await mut('PATCH', '/api/projects/' + b.dataset.id, { status: 'ended' }, null); if (r) toast('Project selesai. Laporan PDF dibuat dan dikirim ke tim'); },
  'start-meeting': b => toast(`Meeting "${b.dataset.t}" dimulai`),
  'tt-toggle': () => { TT.run = !TT.run; syncTT(); ttSave(); },
  'tt-stop': async () => {
    const sec = TT.sec; TT.run = false; TT.sec = 0; syncTT(); ttSave(); if (!sec) return;
    try { await api('POST', '/api/time', { seconds: Math.min(sec, 86400), projectId: TT.pid || null }); toast(`Logged ${sec / 3600 | 0}h ${sec / 60 % 60 | 0}m`); await load(); } catch (e) { if (e.message !== 'auth') toast(e.message); }
  },
  tf: b => { TF = b.dataset.k; paint(false); },
  td: b => { TD = b.dataset.k; paint(false); },
  'new-task': () => form(`${modalHead('New task')}<form class="f">${field('Title', '<input class="in" name="title" required maxlength="80" placeholder="Judul task">', 1)}${field('Tag', `<input class="in" name="tag" list="tagList" required maxlength="30" placeholder="e.g. Frontend, DevOps, Marketing" value="Frontend"><datalist id="tagList"><option value="Frontend"><option value="Backend"><option value="Design"><option value="QA"><option value="Marketing"><option value="DevOps"><option value="Mobile"><option value="Research"></datalist>`)}${field('Priority', '<select class="in" name="prio"><option>High</option><option selected>Medium</option><option>Low</option></select>')}${field('Project', `<select class="in" name="projectId">${projOpts()}</select>`)}${field('Due date', `<input class="in" type="date" name="due" required value="${off(7)}">`)}${field('Assignees', memberChecks([S.me.id]), 1)}<div class="fa w"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Create task</button></div></form>`,
    async fd => { const t = fd.get('title').trim(), tag = (fd.get('tag') || 'General').trim(); if (t) await mut('POST', '/api/tasks', { title: t, tag, prio: fd.get('prio'), due: fd.get('due'), projectId: fd.get('projectId') || null, who: fd.getAll('who').map(Number) }, 'Task created'); }),
  menu: b => {
    const id = +b.dataset.id, t = S.tasks.find(x => x.id === id);
    pop(b, `<p class="cap">Aksi Task</p><button data-act="task-detail" data-id="${id}">${ic('eye')}Detail &amp; Diskusi</button><button data-act="edit-task" data-id="${id}">${ic('edit')}Edit task</button><p class="cap">Move to</p>${STAGES.filter(s => s[0] !== t.stage).map(([k, l]) => `<button data-act="mv" data-id="${id}" data-k="${k}">${l}</button>`).join('')}<hr><button data-act="del-task" data-id="${id}" style="color:var(--bad)">${ic('trash')}Delete</button>`);
  },
  'edit-task': b => {
    closePop();
    const id = +b.dataset.id, t = S.tasks.find(x => x.id === id); if (!t) return;
    form(`${modalHead('Edit task')}<form class="f">
      ${field('Title', `<input class="in" name="title" required maxlength="80" value="${esc(t.title)}">`, 1)}
      ${field('Tag', `<input class="in" name="tag" list="tagList" required maxlength="30" value="${esc(t.tag)}"><datalist id="tagList"><option value="Frontend"><option value="Backend"><option value="Design"><option value="QA"><option value="Marketing"><option value="DevOps"><option value="Mobile"><option value="Research"></datalist>`)}
      ${field('Priority', `<select class="in" name="prio">${['High', 'Medium', 'Low'].map(x => `<option ${x === t.prio ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
      ${field('Project', `<select class="in" name="projectId">${projOpts(t.projectId)}</select>`)}
      ${field('Due date', `<input class="in" type="date" name="due" required value="${t.due}">`)}
      ${field('Assignees', memberChecks(t.who), 1)}
      <div class="fa w"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Save changes</button></div>
    </form>`,
    async fd => {
      const title = (fd.get('title') || '').trim(), tag = (fd.get('tag') || 'General').trim();
      if (!title) return;
      await mut('PATCH', '/api/tasks/' + id, {
        title, tag, prio: fd.get('prio'), due: fd.get('due'),
        projectId: fd.get('projectId') || null, who: fd.getAll('who').map(Number)
      }, 'Task diperbarui');
    });
  },
  'edit-proj': b => {
    const p = S.projects.find(x => x.id === +b.dataset.id); if (!p) return;
    form(`${modalHead('Edit project')}<form class="f">
      ${field('Project name', `<input class="in" name="name" required maxlength="60" value="${esc(p.name)}">`, 1)}
      ${field('Due date', `<input class="in" type="date" name="due" required value="${p.due}">`, 1)}
      <div class="fa w"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Save changes</button></div>
    </form>`,
    async fd => {
      const n = (fd.get('name') || '').trim();
      if (n) await mut('PATCH', '/api/projects/' + p.id, { name: n, due: fd.get('due') }, `Project "${n}" diperbarui`);
    });
  },
  'del-proj': b => {
    const p = S.projects.find(x => x.id === +b.dataset.id); if (!p) return;
    layer('modal', `${modalHead('Hapus project?')}<p style="font-size:13px;line-height:1.5">Project <b>${esc(p.name)}</b> beserta seluruh task di dalamnya akan dihapus. Tindakan ini tidak dapat dibatalkan.</p><div class="fa"><button class="btn" data-act="close">Batal</button><button class="btn primary danger-bg" data-act="del-proj-ok" data-id="${p.id}">Hapus project</button></div>`);
  },
  'del-proj-ok': async b => {
    closeLayer();
    await mut('DELETE', '/api/projects/' + b.dataset.id, null, 'Project dihapus');
  },
  'pick-av': async b => {
    const id = b.dataset.id;
    S.me.avatar = id;
    await mut('PATCH', '/api/me', { avatar: id }, 'Avatar diperbarui', false);
    paint(false); post();
  },
  'trigger-av-file': () => { $('#avFile')?.click(); },
  'reset-av': async () => {
    S.me.avatar = '';
    await mut('PATCH', '/api/me', { avatar: '' }, 'Avatar direset ke inisial', false);
    paint(false); post();
  },
  'set-role': b => {
    const m = mem(+b.dataset.id); if (!m) return;
    const roles = [
      ['Ketua Tim', 'Ketua Tim — Akses penuh & mengatur role tim'],
      ['Project Manager', 'Project Manager — Membuat & mengelola project dan task'],
      ['Member', 'Member — Mengerjakan task, kalender, chat, dan analitik'],
      ['Viewer', 'Viewer — Pengamat dengan hak akses hanya lihat (read-only)']
    ];
    form(`${modalHead('Atur Role: ' + esc(m.name))}<form class="f">
      <p class="mut" style="font-size:12.5px;margin-bottom:12px">Tetapkan hak akses (RBAC) untuk <b>${esc(m.name)}</b> (@${esc(m.username || 'user' + m.id)}).</p>
      ${field('Pilih Role Tim', `<select class="in" name="role">${roles.map(([r, desc]) => `<option value="${r}" ${r === (m.teamRole || 'Member') ? 'selected' : ''}>${desc}</option>`).join('')}</select>`, 1)}
      <div class="fa w"><button type="button" class="btn" data-act="close">Batal</button><button class="btn primary">Simpan Role</button></div>
    </form>`,
    async fd => {
      const role = fd.get('role');
      if (role) {
        try {
          await api('PATCH', `/api/team/members/${m.id}/role`, { role });
          closeLayer(); toast(`Role ${m.name} diubah menjadi ${role}`);
          await load(); paint(false);
        } catch (e) { if (e.message !== 'auth') toast(e.message); }
      }
    });
  },
  'set-team-role': b => {
    const uid = +b.dataset.id;
    const tid = +b.dataset.team;
    const m = mem(uid);
    if (!m) return;
    const roles = [
      ['Ketua Tim', '👑 Ketua Tim — Akses penuh mengelola tim, anggota, dan role'],
      ['Project Manager', '💼 Project Manager — Membuat & mengatur project dan task'],
      ['Member', '👤 Member — Mengerjakan task, kalender, chat, dan analitik'],
      ['Viewer', '👁️ Viewer — Akses hanya lihat (read-only)']
    ];
    form(`${modalHead('Atur Role Tim: ' + esc(m.name))}<form class="f">
      <p class="mut" style="font-size:12.5px;margin-bottom:12px">Tetapkan role khusus untuk <b>${esc(m.name)}</b> di tim ini.</p>
      ${field('Pilih Role', `<select class="in" name="role">${roles.map(([r, desc]) => `<option value="${r}" ${r === (m.teamRole || 'Member') ? 'selected' : ''}>${desc}</option>`).join('')}</select>`, 1)}
      <div class="fa w"><button type="button" class="btn" data-act="close">Batal</button><button class="btn primary">Simpan Role</button></div>
    </form>`,
    async fd => {
      const role = fd.get('role');
      if (!role) return;
      try {
        await api('PATCH', `/api/teams/${tid}/members/${uid}/role`, { role });
        closeLayer();
        toast(`Role ${m.name} diubah menjadi ${role}`);
        delete teamMembersCache[tid];
        await load();
        paint(false);
      } catch (e) {
        if (e.message !== 'auth') toast(e.message);
      }
    });
  },
  'new-team': () => {
    const presets = ['👥', '🚀', '⚡', '🎯', '💡', '🛡️', '🌐', '💼', '🔥', '🏆'];
    form(`${modalHead('Buat Tim Baru')}<form class="f">
      <p class="mut" style="font-size:12.5px;margin-bottom:12px">Buat ruang kerja tim baru. Kamu akan otomatis menjadi <b>Ketua Tim</b> di tim ini.</p>
      ${field('Nama Tim', '<input class="in" name="name" required maxlength="60" placeholder="Contoh: Digital Marketing, DevOps Core">', 1)}
      <div class="field">
        <label class="lab">Pilih Ikon / Logo Tim</label>
        <input type="hidden" name="logo" id="newTeamLogoIn" value="👥">
        <div class="team-logo-picker" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          ${presets.map(p => `<button type="button" class="av-pbtn ${p === '👥' ? 'on' : ''}" data-act="pick-tlogo" data-val="${p}">${p}</button>`).join('')}
        </div>
      </div>
      ${field('Deskripsi Tim', '<textarea class="in" name="description" maxlength="200" rows="3" placeholder="Jelaskan fokus, objektif, atau divisi tim ini..."></textarea>', 1)}
      <div class="fa w"><button type="button" class="btn" data-act="close">Batal</button><button class="btn primary">Buat Tim</button></div>
    </form>`,
    async fd => {
      const name = (fd.get('name') || '').trim();
      if (!name) return toast('Nama tim tidak boleh kosong');
      const logo = fd.get('logo') || '👥';
      const description = (fd.get('description') || '').trim();
      try {
        const newT = await api('POST', '/api/teams', { name, logo, description });
        closeLayer();
        toast(`Tim "${name}" berhasil dibuat!`);
        await load();
        activeTeamId = newT.id;
        delete teamMembersCache[activeTeamId];
        paint(false);
      } catch (e) {
        if (e.message !== 'auth') toast(e.message);
      }
    });
  },
  'pick-tlogo': b => {
    $$('.team-logo-picker button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const inp = $('#newTeamLogoIn');
    if (inp) inp.value = b.dataset.val;
  },
  'edit-team': b => {
    const tid = +b.dataset.id;
    const t = (S.teams || []).find(x => x.id === tid);
    if (!t) return;
    const presets = ['👥', '🚀', '⚡', '🎯', '💡', '🛡️', '🌐', '💼', '🔥', '🏆'];
    const curLogo = t.logo || '👥';
    form(`${modalHead('Edit Informasi Tim')}<form class="f">
      ${field('Nama Tim', `<input class="in" name="name" required maxlength="60" value="${esc(t.name)}">`, 1)}
      <div class="field">
        <label class="lab">Pilih Ikon / Logo Tim</label>
        <input type="hidden" name="logo" id="newTeamLogoIn" value="${esc(curLogo)}">
        <div class="team-logo-picker" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          ${presets.map(p => `<button type="button" class="av-pbtn ${p === curLogo ? 'on' : ''}" data-act="pick-tlogo" data-val="${p}">${p}</button>`).join('')}
        </div>
      </div>
      ${field('Deskripsi Tim', `<textarea class="in" name="description" maxlength="200" rows="3">${esc(t.description || '')}</textarea>`, 1)}
      <div class="fa w"><button type="button" class="btn" data-act="close">Batal</button><button class="btn primary">Simpan Perubahan</button></div>
    </form>`,
    async fd => {
      const name = (fd.get('name') || '').trim();
      if (!name) return toast('Nama tim tidak boleh kosong');
      const logo = fd.get('logo') || curLogo;
      const description = (fd.get('description') || '').trim();
      try {
        await api('PATCH', `/api/teams/${tid}`, { name, logo, description });
        closeLayer();
        toast(`Tim "${name}" berhasil diperbarui!`);
        await load();
        delete teamMembersCache[tid];
        paint(false);
      } catch (e) {
        if (e.message !== 'auth') toast(e.message);
      }
    });
  },
  'del-team': b => {
    const tid = +b.dataset.id;
    const t = (S.teams || []).find(x => x.id === tid);
    if (!t) return;
    layer('modal', `${modalHead('Hapus Tim?')}<p style="font-size:13px;line-height:1.5">Tim <b>${esc(t.name)}</b> akan dihapus dari workspace. Tindakan ini tidak dapat dibatalkan.</p><div class="fa"><button class="btn" data-act="close">Batal</button><button class="btn primary danger-bg" data-act="del-team-ok" data-id="${tid}">Hapus Tim</button></div>`);
  },
  'del-team-ok': async b => {
    closeLayer();
    const tid = +b.dataset.id;
    try {
      await api('DELETE', `/api/teams/${tid}`);
      toast('Tim berhasil dihapus');
      await load();
      activeTeamId = S.teams?.[0]?.id || 1;
      delete teamMembersCache[tid];
      paint(false);
    } catch (e) {
      if (e.message !== 'auth') toast(e.message);
    }
  },
  'invite-team': b => {
    const tid = +b.dataset.team;
    const curTeam = (S.teams || []).find(t => t.id === tid) || { name: 'Tim' };
    const regUrl = `${location.origin}/?tab=register`;
    form(`${modalHead('Undang Anggota ke ' + esc(curTeam.name))}<form class="f">
      <p class="mut" style="font-size:12.5px;line-height:1.5;margin-bottom:12px">Kirim email undangan resmi bergabung ke <b>${esc(curTeam.name)}</b>, atau bagikan tautan pendaftaran langsung.</p>
      ${field('Email Rekan Tim', '<input class="in" type="email" name="email" required placeholder="rekan@email.com">', 1)}
      <div class="field" style="margin-top:8px">
        <label class="lab">Tautan Pendaftaran Cepat</label>
        <div style="display:flex;gap:6px">
          <input class="in" id="invLink" value="${regUrl}" readonly style="background:var(--bg);font-size:12px">
          <button type="button" class="btn sm" data-act="copy-inv">${ic('link')} Salin</button>
        </div>
      </div>
      <div class="fa w" style="margin-top:14px">
        <button type="button" class="btn" data-act="close">Batal</button>
        <button class="btn primary">${ic('send')} Kirim Undangan Email</button>
      </div>
    </form>`,
    async fd => {
      const email = (fd.get('email') || '').trim();
      if (!email) return;
      try {
        const r = await api('POST', '/api/team/invite', { email, teamId: tid });
        closeLayer();
        if (r.sent) toast(`Undangan ke ${curTeam.name} berhasil dikirim ke ${email}!`);
        else toast('Tautan pendaftaran siap dibagikan');
      } catch (e) {
        if (e.message !== 'auth') toast(e.message);
      }
    });
  },
  mv: b => { closePop(); moveTask(+b.dataset.id, b.dataset.k); },
  'del-task': b => { closePop(); mut('DELETE', '/api/tasks/' + b.dataset.id, null, 'Task deleted', false); },
  invite: () => {
    const regUrl = `${location.origin}/?tab=register`;
    form(`${modalHead('Undang Anggota Tim')}<form class="f">
      <p class="mut" style="font-size:12.5px;line-height:1.5;margin-bottom:12px">Kirim undangan pendaftaran langsung ke email rekan tim Anda, atau salin tautan pendaftaran di bawah.</p>
      ${field('Email rekan tim', '<input class="in" type="email" name="email" required placeholder="rekan@email.com">', 1)}
      <div class="field" style="margin-top:8px">
        <label class="lab">Atau bagikan tautan pendaftaran</label>
        <div style="display:flex;gap:6px">
          <input class="in" id="invLink" value="${regUrl}" readonly style="background:var(--bg);font-size:12px">
          <button type="button" class="btn sm" data-act="copy-inv">${ic('link')}Salin</button>
        </div>
      </div>
      <div class="fa w" style="margin-top:14px">
        <button type="button" class="btn" data-act="close">Batal</button>
        <button class="btn primary">${ic('send')}Kirim Undangan Email</button>
      </div>
    </form>`,
    async fd => {
      const email = (fd.get('email') || '').trim();
      if (!email) return;
      try {
        const r = await api('POST', '/api/team/invite', { email });
        closeLayer();
        if (r.sent) toast(`Undangan berhasil dikirim ke ${email}!`);
        else toast('Tautan pendaftaran siap dibagikan');
      } catch (e) {
        if (e.message !== 'auth') toast(e.message);
      }
    });
  },
  'copy-inv': () => {
    const el = $('#invLink');
    if (el) {
      (navigator.clipboard?.writeText(el.value) || Promise.reject()).then(
        () => toast('Tautan pendaftaran berhasil disalin!'),
        () => toast('Salin tautan: ' + el.value)
      );
    }
  },
  chat: b => openChat(+b.dataset.id),
  profile: b => {
    const m = mem(+b.dataset.id), ts = S.tasks.filter(t => t.who.includes(m.id)), o = ts.filter(t => t.stage !== 'done');
    const roleCls = { 'Ketua Tim': 'role-lead', 'Project Manager': 'role-pm', 'Member': 'role-member', 'Viewer': 'role-viewer' }[m.teamRole] || 'role-member';
    const bdayInfo = m.birthDate ? `<small style="display:block;margin-top:4px">🎂 Lahir: ${esc(m.birthPlace ? m.birthPlace + ', ' : '')}${short(m.birthDate)}</small>` : '';
    const addrInfo = m.address ? `<small style="display:block">📍 ${esc(m.address)}</small>` : '';
    layer('drawer', `<div class="mh"><span></span><button class="x" data-act="close" aria-label="Tutup">${ic('x')}</button></div>
      <div class="dr-top">${av(m, 'lg')}
        <h3>${esc(m.name)}</h3>
        <small class="mut">@${esc(m.username || 'user' + m.id)}</small><br>
        <div style="display:flex;gap:6px;justify-content:center;margin:6px 0">
          <span class="pill ${roleCls}">${esc(m.teamRole || 'Member')}</span>
          <span class="tag">${esc(m.div)}</span>
        </div>
        <small class="mut"><i class="st-d ${m.on ? 'on' : ''}"></i>${m.on ? 'Online' : 'Offline'}</small>
        ${bdayInfo}
        ${addrInfo}
      </div>
      <div class="dr-st"><div><b>${o.length}</b><small>Open</small></div><div><b>${ts.length - o.length}</b><small>Done</small></div><div><b>${Math.min(95, o.length * 20)}%</b><small>Load</small></div></div>
      <p class="lab2" style="margin-top:0">Assigned tasks</p>${ts.map(t => `<div class="dr-t"><i></i>${esc(t.title)}<small>${STAGES.find(s => s[0] === t.stage)[1]}</small></div>`).join('') || '<p class="mut">Belum ada tugas.</p>'}
      <div class="fa" style="margin-top:20px">${m.id !== S.me.id ? `<button class="btn" data-act="chat" data-id="${m.id}">${ic('chat')}Chat</button>` : ''}<button class="btn primary" data-act="assign" data-id="${m.id}">${ic('plus')}Assign task</button></div>`);
  },
  assign: b => { const m = mem(+b.dataset.id), av2 = S.tasks.filter(t => t.stage !== 'done' && !t.who.includes(m.id)); if (!av2.length) return toast('Semua tugas sudah ditugaskan');
    form(`${modalHead('Assign task')}<form class="f">${field('Task', `<select class="in" name="t">${av2.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>`, 1)}<div class="fa w"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Assign to ${esc(m.name.split(' ')[0])}</button></div></form>`,
      async fd => { const t = S.tasks.find(x => x.id === +fd.get('t')); await mut('PATCH', '/api/tasks/' + t.id, { who: [...t.who, m.id] }, 'Task assigned'); }); },
  pick: b => { CV.sel = b.dataset.d; const d = parse(b.dataset.d); CV.y = d.getFullYear(); CV.m = d.getMonth(); paint(false); },
  mon: b => { const d = new Date(CV.y, CV.m + +b.dataset.k, 1); CV.y = d.getFullYear(); CV.m = d.getMonth(); paint(false); },
  today: () => { const d = new Date(); CV = { y: d.getFullYear(), m: d.getMonth(), sel: off(0) }; paint(false); },
  'add-event': () => form(`${modalHead('New event')}<form class="f">${field('Title', '<input class="in" name="title" required maxlength="60">', 1)}${field('Date', `<input class="in" type="date" name="date" required value="${CV.sel}">`)}${field('Time', '<input class="in" type="time" name="time" required value="10:00">')}${field('Type', '<select class="in" name="type"><option>meeting</option><option>team</option><option>review</option><option>deadline</option><option>social</option></select>', 1)}<div class="fa w"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Add event</button></div></form>`,
    async fd => { const t = fd.get('title').trim(); if (t) await mut('POST', '/api/events', { title: t, date: fd.get('date'), time: fd.get('time'), type: fd.get('type') }, 'Event added'); }),
  'ev-edit': b => {
    const eid = +b.dataset.id;
    const ev = S.events.find(x => x.id === eid); if (!ev) return;
    const types = ['meeting', 'team', 'review', 'deadline', 'social'];
    form(`${modalHead('Edit Jadwal / Event')}<form class="f">
      ${field('Judul Event', `<input class="in" name="title" required maxlength="60" value="${esc(ev.title)}">`, 1)}
      ${field('Tanggal', `<input class="in" type="date" name="date" required value="${ev.date}">`)}
      ${field('Jam', `<input class="in" type="time" name="time" required value="${ev.time}">`)}
      ${field('Kategori Event', `<select class="in" name="type">${types.map(t => `<option value="${t}" ${t === ev.type ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>`, 1)}
      <div class="fa w"><button type="button" class="btn" data-act="close">Batal</button><button class="btn primary">Simpan Perubahan</button></div>
    </form>`,
    async fd => {
      const title = (fd.get('title') || '').trim();
      if (!title) return toast('Judul event tidak boleh kosong');
      try {
        await api('PATCH', `/api/events/${eid}`, {
          title,
          date: fd.get('date'),
          time: fd.get('time'),
          type: fd.get('type')
        });
        closeLayer();
        toast('Jadwal event berhasil diperbarui');
        await load();
        paint(false);
      } catch (e) {
        if (e.message !== 'auth') toast(e.message);
      }
    });
  },
  'ev-del': b => mut('DELETE', '/api/events/' + b.dataset.id, null, 'Event dihapus', false),
  range: b => { AR = +b.dataset.k; PV = {}; READY.analytics = false; paint(true); },
  csv: () => { const A = AD; if (!A) return; dlFile(`luki-throughput-${A.n}d.csv`, 'date,completed,previous_period\n' + A.cur.map((v, i) => `${off(i - A.n + 1)},${v},${A.prev[i]}`).join('\n')); toast('CSV diunduh'); },
  st: b => { ST = b.dataset.k; paint(true); },
  discard: () => { paint(false); toast('Perubahan dibuang'); },
  tog: async b => { const k = b.dataset.k, v = S.me.notif[k] === false; b.setAttribute('aria-checked', v); try { await api('PATCH', '/api/me', { notif: { [k]: v } }); S.me.notif[k] = v; toast('Saved'); } catch (e) { b.setAttribute('aria-checked', !v); if (e.message !== 'auth') toast(e.message); } },
  accent: b => {
    const k = b.dataset.k;
    document.documentElement.dataset.accent = k;
    const title = b.getAttribute('title') || b.textContent.trim();
    mut('PATCH', '/api/me', { accent: k }, `Warna tema diubah ke ${title}`, false);
  },
  week: b => mut('PATCH', '/api/me', { week: +b.dataset.k }, `Week starts on ${b.textContent}`, false),
  'tg-link': async () => {
    try {
      const r = await api('POST', '/api/telegram/link');
      layer('modal', `${modalHead('Hubungkan Telegram')}<ol class="steps"><li>Klik tombol di bawah untuk membuka bot <b>@${esc(r.bot)}</b> di Telegram.</li><li>Tekan <b>Start</b> di Telegram.</li><li>Jendela ini akan tertutup otomatis saat terhubung.</li></ol><p class="mut" style="font-size:11.5px">Tautan berlaku 15 menit dan hanya untuk akunmu.</p><div class="fa"><button class="btn" data-act="close">Batal</button><a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${ic('send')}Buka Telegram</a></div>`);
    } catch (e) { if (e.message !== 'auth') toast(e.message); }
  },
  'tg-unlink': () => mut('POST', '/api/telegram/unlink', null, 'Telegram diputus', false),
  'tg-test': async () => { try { await api('POST', '/api/telegram/test'); toast('Tes terkirim ke Telegram'); } catch (e) { if (e.message !== 'auth') toast(e.message); } },
  refresh: async b => { b.classList.add('spin'); setTimeout(() => b.classList.remove('spin'), 700); try { await load(); READY = {}; PV = {}; paint(true); toast('Workspace refreshed'); } catch (e) { if (e.message !== 'auth') toast(e.message); } },
  bell: b => {
    const items = S.notifs.slice(0, 8);
    pop(b, `<p class="cap">Notifications</p>${items.map(a => `<div class="ni ${a.unread ? 'un' : ''}">${esc(a.text)}<small>${ago(a.at)}</small></div>`).join('') || '<div class="ni">Belum ada notifikasi</div>'}`, 'notif');
    if (S.notifs.some(n => n.unread)) api('POST', '/api/notifications/read').then(() => { S.notifs.forEach(n => n.unread = 0); $('#dot').classList.remove('on'); }).catch(() => {});
  },
  avatar: () => { closePop(); location.hash = '#/profile'; },
  'go-pwd': () => { ST = 'security'; location.hash = '#/settings'; if (cur === 'settings') paint(false); },
  'go-look': () => { ST = 'look'; location.hash = '#/settings'; if (cur === 'settings') paint(false); },
  'go-reg': () => {
    card().classList.remove('verifying');
    setTab('register');
    const emailVal = ($('#forgotEmailIn')?.value || '').trim();
    if (emailVal) {
      const regEmailIn = $('#fReg input[name=email]');
      if (regEmailIn) regEmailIn.value = emailVal;
    }
    setTimeout(() => $('#masuk')?.scrollIntoView({ behavior: 'smooth' }), 100);
  },
  go: b => { closePop(); location.hash = '#/' + b.dataset.k; },
  help: () => {
    const html = `
      ${modalHead('Pusat Bantuan & Panduan')}
      <div class="help-body">
        <div class="help-contact">
          <h4>${ic('mail')} Butuh Bantuan Langsung?</h4>
          <p>Jika ada pertanyaan, kendala teknis, atau membutuhkan panduan khusus yang belum jelas, Anda dapat langsung menghubungi Admin / Pengembang:</p>
          <div class="help-contact-bar">
            <span class="help-contact-email">${ic('mail')} lukitafalensiamarjan@gmail.com</span>
            <div class="help-contact-acts">
              <button type="button" class="btn sm" data-act="copy-help-email" data-email="lukitafalensiamarjan@gmail.com">${ic('check')} Salin Email</button>
              <a href="mailto:lukitafalensiamarjan@gmail.com?subject=Tanya%20LUKI%20MANAGEMENT" class="btn sm primary" target="_blank" rel="noopener noreferrer">${ic('send')} Kirim Pesan</a>
            </div>
          </div>
        </div>

        <div class="help-sec">
          <h4>${ic('dash')} Pintasan Keyboard &amp; Navigasi Cepat</h4>
          <div class="help-card">
            <div class="help-row"><b>Pencarian Cepat Global</b><kbd>⌘ / Ctrl + K</kbd></div>
            <div class="help-row"><b>Tutup Jendela Dialog</b><kbd>Esc</kbd></div>
            <div class="help-row"><b>Pindah Status Tugas</b><span class="desc">Drag &amp; drop kartu atau menu titik tiga (⋯)</span></div>
            <div class="help-row"><b>Detail &amp; Diskusi Tugas</b><span class="desc">Klik kartu tugas untuk melihat sub-task &amp; chat</span></div>
          </div>
        </div>

        <div class="help-sec">
          <h4>${ic('tasks')} Manajemen Proyek &amp; Tugas (Tasks)</h4>
          <div class="help-card">
            <ul class="help-list">
              <li><b>Project Baru:</b> Tentukan nama project dan tenggat waktu (due date). Menandai proyek selesai akan otomatis membuat laporan ringkasan <b>PDF resmi</b>.</li>
              <li><b>Tugas &amp; Custom Tag:</b> Tentukan judul tugas, prioritas (High, Medium, Low), serta Tag kustom bebas (misal: Frontend, Backend, UI/UX, Marketing).</li>
              <li><b>Sub-Task &amp; Diskusi Tim:</b> Di dalam modal Detail Tugas, Anda bisa menambahkan checklist sub-task dan berdiskusi langsung di kolom komentar real-time.</li>
            </ul>
          </div>
        </div>

        <div class="help-sec">
          <h4>${ic('team')} Kolaborasi Multi-Team &amp; Hak Akses (RBAC)</h4>
          <div class="help-card">
            <ul class="help-list">
              <li><b>Multi-Team:</b> Pengguna dapat membuat lebih dari satu tim (nama, logo emoji/icon, dan deskripsi khusus).</li>
              <li><b>Ketua Tim &amp; Hak Akses:</b> Pembuat tim menjadi Ketua Tim dan berwenang menetapkan role anggota (Ketua Tim, Anggota, atau Viewer) khusus untuk tim tersebut.</li>
              <li><b>Undang Anggota:</b> Tambahkan anggota ke dalam tim menggunakan username (@username) atau email terdaftar.</li>
              <li><b>Chat Tim:</b> Fitur obrolan pesan langsung (direct message) antar anggota tim tersedia di menu <b>Team → Chat</b>.</li>
            </ul>
          </div>
        </div>

        <div class="help-sec">
          <h4>${ic('heart')} Ruang Pribadi (Catatan &amp; Keuangan)</h4>
          <div class="help-card">
            <ul class="help-list">
              <li><b>Pencatatan Keuangan:</b> Kelola catatan pemasukan dan pengeluaran pribadi serta pantau target anggaran bulanan Anda.</li>
              <li><b>Catatan Rahasia:</b> Simpan ide atau catatan pribadi penting. Seluruh data di Ruang Pribadi 100% aman dan terisolasi, tidak dapat dilihat anggota tim lain.</li>
            </ul>
          </div>
        </div>

        <div class="help-sec">
          <h4>${ic('cal')} Kalender &amp; Jadwal Event</h4>
          <div class="help-card">
            <ul class="help-list">
              <li><b>Jadwal &amp; Agenda:</b> Tandai agenda meeting, review, deadline tugas, dan kegiatan sosial tim.</li>
              <li><b>Edit Jadwal:</b> Klik jadwal pada kalender untuk mengubah judul, jam, tanggal, atau kategori kegiatan secara langsung.</li>
            </ul>
          </div>
        </div>

        <div class="help-sec">
          <h4>${ic('send')} Pengingat Bot Telegram (@LukiManagementBot)</h4>
          <div class="help-card">
            <ul class="help-list">
              <li><b>Notifikasi Otomatis:</b> Bot Telegram akan mengirimkan pesan pengingat tenggat waktu (H-7, H-3, H-2, dan H-1) otomatis ke ponsel Anda.</li>
              <li><b>Cara Menghubungkan:</b> Buka menu <b>Settings → Notifications</b>, klik tombol <b>Connect Telegram</b> dan tekan <b>Start</b> di bot Telegram.</li>
              <li><b>Perintah Telegram:</b> Ketik <code>/deadline</code> untuk cek tugas 14 hari ke depan, atau <code>/catat 25000 makan</code> untuk catat pengeluaran langsung dari Telegram!</li>
            </ul>
          </div>
        </div>

        <div class="help-sec">
          <h4>${ic('user')} Profil Pengguna &amp; Keamanan Akun</h4>
          <div class="help-card">
            <ul class="help-list">
              <li><b>Edit Profil:</b> Klik avatar profil Anda untuk mengubah nama, username unik (@username), foto profil / icon avatar, dan divisi.</li>
              <li><b>Tempat Tanggal Lahir:</b> Anda dapat mengisi data TTL dan mengaktifkan opsi berbagi ulang tahun agar rekan tim mendapatkan notifikasi saat Anda ultah.</li>
              <li><b>Ubah Kata Sandi:</b> Ganti kata sandi secara berkala di menu <b>Settings → Kata Sandi</b>.</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="fa" style="margin-top:6px">
        <button class="btn primary" data-act="close" style="width:100%">Tutup Panduan</button>
      </div>
    `;
    layer('modal help-modal', html);
  },
  'copy-help-email': b => {
    const email = b.dataset.email || 'lukitafalensiamarjan@gmail.com';
    navigator.clipboard?.writeText(email);
    toast('Alamat email disalin: ' + email);
  },
  logout: () => layer('modal', `${modalHead('Logout')}<p class="mut" style="font-size:13px">Keluar dari LUKI MANAGEMENT?</p><div class="fa"><button class="btn" data-act="close">Batal</button><button class="btn primary" data-act="do-logout">Logout</button></div>`),
  'do-logout': async () => { try { await api('POST', '/api/auth/logout'); } catch { /* already out */ } showAuth(); setTab('login'); toast('Kamu sudah logout'); },
  download: () => toast('Aplikasi mobile segera hadir'),
};

/* ---------- events ---------- */
document.addEventListener('click', e => {
  if (popEl && !popEl.contains(e.target)) closePop();
  const nv = e.target.closest('.nav a,.navbtn');
  if (nv) { if (nv.tagName === 'BUTTON') document.body.classList.remove('nav-open'); const r = nv.getBoundingClientRect(), s = document.createElement('span'); s.className = 'ripple'; s.style.left = e.clientX - r.left + 'px'; s.style.top = e.clientY - r.top + 'px'; nv.appendChild(s); setTimeout(() => s.remove(), 600); }
  const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b, e);
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'pf') {
    e.preventDefault();
    const f = e.target, fd = new FormData(f), n = (fd.get('name') || '').trim();
    if (!n) return toast('Nama tidak boleh kosong');
    const divSel = fd.get('division_sel');
    const div = divSel === '_custom' ? (fd.get('division_custom') || '').trim() : divSel;
    const username = (fd.get('username') || '').trim().toLowerCase();
    const payload = {
      name: n,
      username,
      division: div || S.me.div,
      address: (fd.get('address') || '').trim(),
      birthPlace: (fd.get('birthPlace') || '').trim(),
      birthDate: fd.get('birthDate') || null,
      shareBirthday: !!f.querySelector('[name=shareBirthday]')?.checked,
      tz: fd.get('tz'),
      bio: (fd.get('bio') || '').trim()
    };
    try {
      await mut('PATCH', '/api/me', payload, 'Profil berhasil disimpan', false);
      await load();
      paint(false);
      post();
    } catch (err) {
      if (err.message !== 'auth') toast(err.message);
    }
  } else if (e.target.id === 'pwf') {
    e.preventDefault();
    const f = e.target, fd = new FormData(f);
    const newPw = fd.get('newPassword') || '';
    const confirmPw = fd.get('confirmPassword') || '';
    if (newPw.length < 8) return toast('Kata sandi baru minimal 8 karakter');
    if (newPw !== confirmPw) return toast('Konfirmasi kata sandi tidak cocok');
    try {
      await api('POST', '/api/me/password', {
        oldPassword: fd.get('oldPassword') || '',
        newPassword: newPw
      });
      f.reset();
      toast('Kata sandi berhasil diperbarui!');
    } catch (err) {
      if (err.message !== 'auth') toast(err.message);
    }
  } else if (e.target.id === 'fTdDesc') {
    e.preventDefault();
    const tid = +e.target.dataset.id;
    const desc = (new FormData(e.target).get('description') || '').trim();
    try {
      await api('PATCH', `/api/tasks/${tid}`, { description: desc });
      toast('Deskripsi task berhasil disimpan');
      await load();
      await refreshTaskDetail(tid);
    } catch (err) {
      if (err.message !== 'auth') toast(err.message);
    }
  } else if (e.target.id === 'fTdAddChk') {
    e.preventDefault();
    const tid = +e.target.dataset.id;
    const fd = new FormData(e.target);
    const title = (fd.get('title') || '').trim();
    if (!title) return;
    try {
      await api('POST', `/api/tasks/${tid}/checklists`, { title });
      e.target.reset();
      await refreshTaskDetail(tid);
    } catch (err) {
      if (err.message !== 'auth') toast(err.message);
    }
  } else if (e.target.id === 'fTdAddComm') {
    e.preventDefault();
    const tid = +e.target.dataset.id;
    const fd = new FormData(e.target);
    const content = (fd.get('content') || '').trim();
    if (!content) return;
    try {
      await api('POST', `/api/tasks/${tid}/comments`, { content });
      e.target.reset();
      await refreshTaskDetail(tid);
    } catch (err) {
      if (err.message !== 'auth') toast(err.message);
    }
  }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'teamSwitcher' || e.target.dataset.act === 'switch-team') {
    activeTeamId = +e.target.value;
    delete teamMembersCache[activeTeamId];
    paint(false);
  }
  if (e.target.id === 'pfDivSel') {
    const w = $('#pfCustomDivWrap');
    if (w) w.hidden = e.target.value !== '_custom';
  }
  if (e.target.id === 'regDivSel') {
    const w = $('#regCustomDivWrap');
    if (w) w.hidden = e.target.value !== '_custom';
  }
  if (e.target.id === 'avFile') {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Pilih file gambar (PNG, JPG, dll.)');
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = async () => {
        const cvs = document.createElement('canvas');
        cvs.width = cvs.height = 128;
        const ctx = cvs.getContext('2d');
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2, sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 128, 128);
        const dataUrl = cvs.toDataURL('image/jpeg', 0.85);
        S.me.avatar = dataUrl;
        await mut('PATCH', '/api/me', { avatar: dataUrl }, 'Foto profil berhasil diunggah', false);
        paint(false); post();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  }
  if (e.target.type === 'file' && e.target.id !== 'avFile') {
    const s = $('#fn'); if (s) s.textContent = e.target.files[0]?.name || 'Pilih file .csv';
  }
  if (e.target.dataset.actChange === 'tt-proj') { TT.pid = +e.target.value; ttSave(); }
});
$('#q').addEventListener('input', e => { Q = e.target.value.trim().toLowerCase(); if (S && cur !== 'analytics' && cur !== 'settings') paint(false); });
document.addEventListener('keydown', e => {
  if (!S) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
  if (e.key === 'Escape') { if (document.body.classList.contains('nav-open')) document.body.classList.remove('nav-open'); else if (popEl) closePop(); else if ($('.ov')) closeLayer(); else if (document.activeElement === $('#q')) { $('#q').value = ''; Q = ''; $('#q').blur(); paint(false); } }
});
/* drag & drop (kanban) */
document.addEventListener('dragstart', e => { const c = e.target.closest?.('.tcard'); if (!c) return; dragId = +c.dataset.id; c.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.dataset.id); });
document.addEventListener('dragend', () => { $$('.drag,.over').forEach(x => x.classList.remove('drag', 'over')); dragId = null; if (dirty) setTimeout(refresh, 200); });
document.addEventListener('dragover', e => { const c = e.target.closest?.('.col'); if (!c || !dragId) return; e.preventDefault(); $$('.col.over').forEach(x => x !== c && x.classList.remove('over')); c.classList.add('over'); });
document.addEventListener('drop', e => { const c = e.target.closest?.('.col'); if (!c || !dragId) return; e.preventDefault(); const id = dragId; dragId = null; $$('.drag,.over').forEach(x => x.classList.remove('drag', 'over')); moveTask(id, c.dataset.stage); });
/* analytics chart hover */
document.addEventListener('pointermove', e => {
  const w = e.target.closest?.('.lc-wrap'); if (!w || !AD) return;
  const A = AD, r = w.getBoundingClientRect(), W = 600, H = 220, fx = (e.clientX - r.left) / r.width * W;
  const i = Math.max(0, Math.min(A.n - 1, Math.round((fx - A.L) / ((W - A.L - A.R) / (A.n - 1)))));
  const x = A.L + i * (W - A.L - A.R) / (A.n - 1), y = A.T + (H - A.T - A.B) * (1 - A.ac[i] / A.mx);
  const xh = $('#xh'), xd = $('#xd'), tip = $('#tip'); xh.setAttribute('x1', x); xh.setAttribute('x2', x); xd.setAttribute('cx', x); xd.setAttribute('cy', y); xh.style.opacity = xd.style.opacity = 1;
  tip.innerHTML = `${short(off(i - A.n + 1))}<b>${A.cur[i]} tasks</b>7-day avg ${A.ac[i].toFixed(1)} · prev. ${A.prev[i]}`; tip.style.left = x / W * 100 + '%'; tip.style.top = y / H * r.height + 'px'; tip.classList.add('on');
});
document.addEventListener('pointerout', e => { const w = e.target.closest?.('.lc-wrap'); if (w && !w.contains(e.relatedTarget)) { $('#xh').style.opacity = $('#xd').style.opacity = 0; $('#tip').classList.remove('on'); } });
setInterval(() => { if (S && TT.run) { TT.sec++; $$('.tt-time').forEach(e => e.textContent = ttFmt(TT.sec)); if (TT.sec % 5 === 0) ttSave(); } }, 1000);
addEventListener('beforeunload', () => { if (S) ttSave(); });
addEventListener('hashchange', route);

/* init: runs after personal.js/admin.js registered their routes */
const AUTH_MSG = { verified: 'Email terverifikasi. Selamat datang!', invalid: 'Tautan verifikasi tidak valid atau kedaluwarsa. Login lalu kirim ulang email verifikasi.', disabled: 'Akun kamu dinonaktifkan admin.',
  google_off: 'Login Google belum diaktifkan di server.', google_fail: 'Login Google gagal, coba lagi.', google_unverified: 'Email Google kamu belum terverifikasi oleh Google.', closed: 'Pendaftaran akun baru sedang ditutup.' };
document.addEventListener('DOMContentLoaded', async () => {
  $$('[data-i]').forEach(e => e.innerHTML = ic(e.dataset.i));
  const params = new URLSearchParams(location.search);
  const q = params.get('auth');
  const tab = params.get('tab');
  const emailParam = params.get('email');
  const resetToken = params.get('resetToken') || params.get('reset');
  if (q) history.replaceState(null, '', location.pathname + location.hash);
  api('GET', '/api/auth/config').then(c => { document.documentElement.classList.toggle('no-google', !c.google); $('[data-tab=register]').hidden = !c.register; }).catch(() => {});
  try { await enter(); } catch {
    showAuth();
    if (resetToken) {
      card().classList.add('verifying');
      $('#fLogin').hidden = true;
      $('#fReg').hidden = true;
      $('#vPanel').hidden = true;
      $('#forgotPanel').hidden = true;
      $('#resetPanel').hidden = false;
      $('#resetTokenIn').value = resetToken;
      setTimeout(() => $('#masuk')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else if (tab === 'register') {
      setTab('register');
      if (emailParam) {
        const inp = $('#fReg input[name="email"]');
        if (inp) inp.value = emailParam;
      }
      setTimeout(() => $('#masuk')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else if (q && q !== 'verified') {
      setTab('login');
      $('#masuk').scrollIntoView();
    }
  }
  if (q && AUTH_MSG[q]) toast(AUTH_MSG[q]);
});
