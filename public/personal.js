'use strict';
/* Ruang Pribadi: keuangan, catatan, tugas pribadi, wishlist, travel. The server scopes every item to the logged-in user.
   Loaded after app.js and uses its globals (S, api, ROUTES, ACT, LOADERS, READY, paint, ...). */
let PD = [], PT = 'overview', PM = off(0).slice(0, 7), PTF = 'todo', pEditing = false;
LOADERS.personal = async () => { PD = await api('GET', '/api/personal'); };

const idr = n => (n < 0 ? '-' : '') + 'Rp' + Math.round(Math.abs(n || 0)).toLocaleString('id-ID');
const PK = k => PD.filter(x => x.kind === k);
const sumAmt = a => a.reduce((x, t) => x + (t.amount || 0), 0);
const CAT = { expense: ['Makan & Minum', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'], income: ['Gaji', 'Bonus', 'Freelance', 'Investasi', 'Hadiah', 'Lainnya'] };
const NCOL = { yellow: '#fef3c7', blue: '#dbeafe', green: '#dcfce7', pink: '#fce7f3', purple: '#ede9fe', gray: '#f1f5f9' };
const PTABS = [['overview', 'Ringkasan', 'heart'], ['finance', 'Keuangan', 'wallet'], ['notes', 'Catatan', 'note'], ['ptasks', 'Tugas', 'tasks'], ['wish', 'Wishlist', 'gift'], ['trip', 'Travel', 'plane']];
const KIND = { tx: 'Transaksi', note: 'Catatan', ptask: 'Tugas pribadi', wish: 'Wishlist', trip: 'Rencana perjalanan' };
const KIC = { tx: 'wallet', note: 'note', ptask: 'tasks', wish: 'gift', trip: 'plane' };
const ADD = { finance: 'tx', notes: 'note', ptasks: 'ptask', wish: 'wish', trip: 'trip' };
const DCOL = ['var(--ac)', 'var(--ac-mid)', '#e9a319', '#ef6b6b', '#94a3b8', '#cfd6e4'];
const dtLocal = ms => ms ? `${iso(new Date(ms))}T${new Date(ms).toTimeString().slice(0, 5)}` : '';
const fmtDT = ms => new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const cd = d => { const n = diff(d); return n > 0 ? `H-${n}` : n === 0 ? 'Hari ini' : `${-n} hari lalu`; };
const rchip = it => it.remindAt && !it.reminded ? `<span class="rchip" title="Pengingat">${ic('alarm')}${fmtDT(it.remindAt)}</span>` : '';
const q = it => hasQ(`${it.title} ${it.body || ''} ${it.category || ''}`.toLowerCase());
const empty = (t, k) => `<div class="pempty"><p>${t}</p>${k ? `<button class="btn primary sm" data-act="p-new" data-k="${k}">${ic('plus')}Tambah</button>` : ''}</div>`;

function vPersonal() {
  const tabs = `<div class="tabs ptabs">${PTABS.map(([k, l, i]) => `<button class="tab ${PT === k ? 'on' : ''}" data-act="pt" data-k="${k}">${ic(i)}${l}</button>`).join('')}</div>`;
  const add = PT === 'overview' ? `<button class="btn primary" data-act="p-quick">${ic('plus')}Tambah</button>` : `<button class="btn primary" data-act="p-new" data-k="${ADD[PT]}">${ic('plus')}${KIND[ADD[PT]]}</button>`;
  return head('Ruang Pribadi', 'Hanya kamu yang bisa melihat bagian ini.', add) + tabs + ({ overview: pOverview, finance: pFinance, notes: pNotes, ptasks: pTasks, wish: pWish, trip: pTrip }[PT])();
}
ROUTES.personal = [vPersonal, 'Ruang Pribadi', 'Cari di ruang pribadi'];

function donut(rows, total, label, sub) {
  let acc = 0;
  const arcs = total ? rows.map((r, i) => { const s = r.v / total * 100, a = `<circle cx="50" cy="50" r="38" fill="none" stroke="${DCOL[i % DCOL.length]}" stroke-width="13" pathLength="100" stroke-dasharray="${Math.max(.5, s - 1)} ${101 - s}" stroke-dashoffset="${-acc}"/>`; acc += s; return a; }).join('')
    : '<circle cx="50" cy="50" r="38" fill="none" stroke="#e9edf5" stroke-width="13"/>';
  return `<div class="donut"><svg viewBox="0 0 100 100">${arcs}</svg><div class="c"><b>${label}</b><small>${sub}</small></div></div>`;
}
const stat = (t, v, s, on, tab, cls = '') => `<div class="card stat ${on ? 'on' : ''}" ${tab ? `data-act="pt" data-k="${tab}" role="button" tabindex="0"` : ''}>${tab ? `<span class="go">${ic('arrow')}</span>` : ''}<h4>${t}</h4><div class="n sm ${cls}">${v}</div><small>${s}</small></div>`;

function pOverview() {
  const m = off(0).slice(0, 7), tx = PK('tx').filter(t => t.date.startsWith(m));
  const inc = sumAmt(tx.filter(t => t.status === 'income')), exp = sumAmt(tx.filter(t => t.status === 'expense')), bud = S.me.budget;
  const tasks = PK('ptask').filter(t => t.status === 'todo'), wish = PK('wish').filter(w => w.status === 'want');
  const trip = PK('trip').filter(t => t.status === 'planned' && t.date2 >= off(0)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const now = Date.now();
  const up = [
    ...PD.filter(x => x.remindAt > now && !x.reminded).map(x => ({ at: x.remindAt, t: x.title, k: x.kind, s: `Pengingat ${fmtDT(x.remindAt)}`, id: x.id })),
    ...tasks.filter(t => t.date && t.date >= off(0)).map(t => ({ at: parse(t.date).getTime() + 1, t: t.title, k: 'ptask', s: `Tenggat ${cd(t.date)}`, id: t.id })),
    ...PK('trip').filter(t => t.status === 'planned' && t.date >= off(0)).map(t => ({ at: parse(t.date).getTime() + 2, t: t.title, k: 'trip', s: `Berangkat ${cd(t.date)}`, id: t.id })),
  ].sort((a, b) => a.at - b.at).slice(0, 6);
  const pinned = PK('note').filter(n => n.pinned).slice(0, 3), bpct = bud ? Math.round(exp / bud * 100) : 0;
  return `<div class="grid g4 mb">${stat('Saldo bulan ini', idr(inc - exp), MON[+m.slice(5) - 1], 1, 'finance')}${stat('Pengeluaran', idr(exp), bud ? `${bpct}% dari budget ${idr(bud)}` : 'Budget belum diatur', 0, 'finance')}${stat('Tugas aktif', tasks.length, `${PK('ptask').length - tasks.length} selesai`, 0, 'ptasks')}${stat('Wishlist', idr(sumAmt(wish)), `${wish.length} barang diinginkan`, 0, 'wish')}</div>
  <div class="grid g21 mb"><div class="card"><h3>Pengingat &amp; tenggat mendatang</h3>${up.map(u => `<button class="uprow" data-act="p-edit" data-k="${u.k}" data-id="${u.id}"><span class="ub">${ic(KIC[u.k])}</span><span class="ut"><b>${esc(u.t)}</b><small>${esc(u.s)}</small></span></button>`).join('') || '<p class="mut">Belum ada pengingat. Tambahkan pengingat pada catatan, tugas, atau tagihan.</p>'}</div>
  <div class="card trip-next"><h3>Perjalanan berikutnya</h3>${trip ? `<p class="tn-cd">${cd(trip.date)}</p><h2>${esc(trip.title)}</h2><small class="mut">${short(trip.date)} – ${short(trip.date2)}${trip.amount ? ` · Budget ${idr(trip.amount)}` : ''}</small>` : empty('Belum ada rencana perjalanan.', 'trip')}</div></div>
  ${pinned.length ? `<h3 class="sec-h">${ic('pin')} Catatan tersemat</h3><div class="ngrid">${pinned.map(noteCard).join('')}</div>` : ''}`;
}

function pFinance() {
  const [y, mo] = PM.split('-').map(Number), all = PK('tx').filter(t => t.date.startsWith(PM));
  const tx = all.filter(q).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const ins = all.filter(t => t.status === 'income'), outs = all.filter(t => t.status === 'expense');
  const inc = sumAmt(ins), exp = sumAmt(outs), bud = S.me.budget, bpct = bud ? Math.round(exp / bud * 100) : 0;
  const cats = Object.entries(outs.reduce((a, t) => (a[t.category] = (a[t.category] || 0) + t.amount, a), {})).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const top = cats.slice(0, 5); if (cats.length > 5) top.push({ k: 'Kategori lain', v: cats.slice(5).reduce((a, c) => a + c.v, 0) });

  const allTx = PK('tx');
  const calcW = w => allTx.filter(t => (t.wallet || 'cash') === w).reduce((a, t) => a + (t.status === 'income' ? t.amount : -t.amount), 0);
  const wCash = calcW('cash'), wBank = calcW('bank'), wEwallet = calcW('ewallet');
  const wLabels = { cash: '💵 Kas', bank: '🏦 Bank', ewallet: '📱 E-Wallet' };

  const list = [...new Set(tx.map(t => t.date))].map(d => {
    const r = tx.filter(t => t.date === d), net = r.reduce((a, t) => a + (t.status === 'income' ? t.amount : -t.amount), 0);
    return `<div class="txd"><p class="txh"><span>${DOW[parse(d).getDay()].slice(0, 3)}, ${short(d)}</span><b class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${idr(net)}</b></p>${r.map(t => `<button class="txr" data-act="p-edit" data-k="tx" data-id="${t.id}"><span class="txi ${t.status}">${esc((t.category || '?')[0])}</span><span class="ut"><b>${esc(t.title)}</b><small><span class="pill" style="font-size:10px;padding:1px 5px;background:#f1f5f9;border:1px solid #0f172a">${wLabels[t.wallet] || '💵 Kas'}</span> ${t.recurring ? `<span class="pill" style="font-size:10px;padding:1px 5px;background:#fef3c7;border:1px solid #0f172a">🔄 ${t.recurring}</span>` : ''} ${esc(t.category)} ${rchip(t)}</small></span><b class="amt ${t.status === 'income' ? 'pos' : 'neg'}">${t.status === 'income' ? '+' : '-'}${idr(t.amount)}</b></button>`).join('')}</div>`;
  }).join('');

  return `<div class="mbar" style="flex-wrap:wrap;gap:8px">
    <div style="display:flex;align-items:center;gap:4px">
      <button class="ibtn" data-act="pm" data-k="-1" aria-label="Bulan sebelumnya">${ic('chevL')}</button>
      <b>${MON[mo - 1]} ${y}</b>
      <button class="ibtn" data-act="pm" data-k="1" aria-label="Bulan berikutnya">${ic('chevR')}</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn sm" data-act="p-budget">${ic('wallet')}Atur budget</button>
      <button class="btn sm" data-act="p-transfer">🔄 Transfer Dompet</button>
      <button class="btn sm" data-act="p-export-csv">${ic('download')}CSV</button>
      <button class="btn sm primary" data-act="p-export-pdf">${ic('file')}PDF</button>
    </div>
  </div>

  <div class="grid g3 mb" style="margin-top:12px">
    <div class="card" style="padding:14px;background:#fefce8;border:2px solid #0f172a;box-shadow:2px 2px 0 #0f172a">
      <div style="font-size:12px;font-weight:700;color:#854d0e">💵 Kas Tunai (Cash)</div>
      <div style="font-size:18px;font-weight:800;font-family:'Patrick Hand',sans-serif;margin-top:4px">${idr(wCash)}</div>
    </div>
    <div class="card" style="padding:14px;background:#eff6ff;border:2px solid #0f172a;box-shadow:2px 2px 0 #0f172a">
      <div style="font-size:12px;font-weight:700;color:#1e40af">🏦 Rekening Bank</div>
      <div style="font-size:18px;font-weight:800;font-family:'Patrick Hand',sans-serif;margin-top:4px">${idr(wBank)}</div>
    </div>
    <div class="card" style="padding:14px;background:#f0fdf4;border:2px solid #0f172a;box-shadow:2px 2px 0 #0f172a">
      <div style="font-size:12px;font-weight:700;color:#166534">📱 E-Wallet</div>
      <div style="font-size:18px;font-weight:800;font-family:'Patrick Hand',sans-serif;margin-top:4px">${idr(wEwallet)}</div>
    </div>
  </div>

  <div class="grid g4 mb">${stat('Saldo', idr(inc - exp), 'Pemasukan − pengeluaran', 1)}${stat('Pemasukan', idr(inc), `${ins.length} transaksi`, 0, '', 'pos')}${stat('Pengeluaran', idr(exp), `${outs.length} transaksi`, 0, '', 'neg')}
  <div class="card stat"><h4>Sisa budget</h4><div class="n sm">${bud ? idr(Math.max(0, bud - exp)) : '—'}</div><small>${bud ? `terpakai ${bpct}% dari ${idr(bud)}` : 'Belum diatur'}</small>${bud ? `<div class="prog ${bpct >= 100 ? 'over' : bpct >= 80 ? 'warn' : ''}"><i style="width:${Math.min(100, bpct)}%"></i></div>` : ''}</div></div>
  <div class="grid g21"><div class="card"><h3>Transaksi</h3>${list || empty(Q ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi bulan ini.', 'tx')}</div>
  <div class="card"><h3>Pengeluaran per kategori</h3>${donut(top, exp, idr(exp), 'bulan ini')}<div class="dl">${top.map((c, i) => `<div><i style="background:${DCOL[i % DCOL.length]}"></i><span class="dl-n">${esc(c.k)}</span><b>${idr(c.v)}</b></div>`).join('') || '<p class="mut">Belum ada pengeluaran.</p>'}</div></div></div>`;
}

const noteCard = n => `<button class="ncard" style="--nc:${NCOL[n.color] || NCOL.yellow}" data-act="p-edit" data-k="note" data-id="${n.id}">${n.pinned ? `<span class="npin">${ic('pin')}</span>` : ''}<b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${short(iso(new Date(n.createdAt)))} ${rchip(n)}</small></button>`;
function pNotes() {
  const ns = PK('note').filter(q).sort((a, b) => b.pinned - a.pinned || b.id - a.id);
  return ns.length ? `<div class="ngrid">${ns.map(noteCard).join('')}</div>` : empty(Q ? 'Tidak ada catatan yang cocok.' : 'Belum ada catatan.', 'note');
}

function pTasks() {
  const all = PK('ptask').filter(q), ts = all.filter(t => PTF === 'all' || t.status === PTF).sort((a, b) => (a.status > b.status) - (a.status < b.status) || (a.date || '9').localeCompare(b.date || '9'));
  const f = [['todo', 'Aktif'], ['done', 'Selesai'], ['all', 'Semua']].map(([k, l]) => `<button class="tab ${PTF === k ? 'on' : ''}" data-act="ptf" data-k="${k}">${l} ${k === 'all' ? all.length : all.filter(t => t.status === k).length}</button>`).join('');
  const due = t => { if (!t.date) return ''; const n = diff(t.date); return `<span class="${t.status === 'todo' && n < 0 ? 'od' : ''}">${ic('clock')}${t.status === 'todo' ? cd(t.date) : short(t.date)}</span>`; };
  return `<div class="tabs">${f}</div><div class="card plist2">${ts.map(t => `<div class="ptr ${t.status}"><button class="ck" data-act="p-done" data-id="${t.id}" aria-label="${t.status === 'done' ? 'Tandai belum selesai' : 'Tandai selesai'}" aria-pressed="${t.status === 'done'}">${ic('check')}</button><button class="ptm" data-act="p-edit" data-k="ptask" data-id="${t.id}"><b>${esc(t.title)}</b><small><span class="pr ${t.priority}">${ic('flag')}${t.priority}</span>${due(t)}${t.category ? `<span class="lbl">${esc(t.category)}</span>` : ''}${rchip(t)}</small></button></div>`).join('') || empty(PTF === 'done' ? 'Belum ada tugas selesai.' : 'Tidak ada tugas. Santai dulu!', PTF === 'done' ? '' : 'ptask')}</div>`;
}

function pWish() {
  const P = ['High', 'Medium', 'Low'];
  const ws = PK('wish').filter(q).sort((a, b) => (a.status > b.status) - (a.status < b.status) || P.indexOf(a.priority) - P.indexOf(b.priority));
  const want = PK('wish').filter(w => w.status === 'want');
  return `<div class="grid g3x mb">${stat('Total diinginkan', idr(sumAmt(want)), `${want.length} barang`, 1)}${stat('Sudah dibeli', PK('wish').length - want.length, 'barang tercapai')}${stat('Prioritas tinggi', want.filter(w => w.priority === 'High').length, 'barang')}</div>
  ${ws.length ? `<div class="wgrid">${ws.map(w => `<div class="card wcard ${w.status}"><div class="wtop"><span class="pr ${w.priority}">${ic('flag')}${w.priority}</span>${w.status === 'bought' ? '<span class="pill s-ended">Dibeli</span>' : w.date ? `<span class="pill s-running">${cd(w.date)}</span>` : ''}</div><h4>${esc(w.title)}</h4><p class="wprice">${w.amount != null ? idr(w.amount) : 'Harga belum diisi'}</p>${w.body ? `<p class="wnote">${esc(w.body)}</p>` : ''}${rchip(w)}<div class="wact">${w.url ? `<a class="btn sm" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">${ic('link')}Link</a>` : ''}<button class="btn sm" data-act="p-edit" data-k="wish" data-id="${w.id}">${ic('edit')}Edit</button><button class="btn sm ${w.status === 'want' ? 'primary' : ''}" data-act="p-bought" data-id="${w.id}">${w.status === 'want' ? `${ic('check')}Dibeli` : 'Batal'}</button></div></div>`).join('')}</div>` : empty(Q ? 'Tidak ada yang cocok.' : 'Wishlist masih kosong.', 'wish')}`;
}

function pTrip() {
  const ts = PK('trip').filter(q).sort((a, b) => (a.status > b.status) - (a.status < b.status) || a.date.localeCompare(b.date));
  return ts.length ? `<div class="wgrid">${ts.map(t => {
    const n = diff(t.date), on = n <= 0 && diff(t.date2) >= 0, len = diff(t.date2) - n + 1;
    const td = t.tripData || parseTrip(t.body);
    const pDone = (td.packingList || []).filter(x => x.done || x.packed).length;
    const pTotal = (td.packingList || []).length;
    const itinCount = (td.itinerary || []).length;

    return `<div class="card tcard2 ${t.status}" style="text-align:left">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="tbadge ${on ? 'on' : ''}">${t.status === 'done' ? 'Selesai' : on ? 'Sedang berlangsung' : cd(t.date)}</span>
        <button class="ibtn sm" data-act="p-edit" data-k="trip" data-id="${t.id}" title="Edit trip">${ic('edit')}</button>
      </div>
      <h4>${ic('plane')}<span>${esc(t.title)}</span></h4>
      <p class="mut" style="font-size:12px;margin:4px 0">${short(t.date)} – ${short(t.date2)} · ${len} hari</p>
      ${t.amount != null ? `<p class="tb">Budget <b>${idr(t.amount)}</b></p>` : ''}
      ${td.note ? `<p class="wnote" style="font-size:12px;margin:6px 0">${esc(td.note)}</p>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${pTotal ? `<span class="pill" style="font-size:11px;background:#fef3c7;border:1px solid #0f172a">🎒 Packing: ${pDone}/${pTotal}</span>` : ''}
        ${itinCount ? `<span class="pill" style="font-size:11px;background:#e0f2fe;border:1px solid #0f172a">🗺️ Itinerary: ${itinCount} agenda</span>` : ''}
      </div>
      <div style="margin-top:10px;display:flex;gap:6px">
        <button class="btn sm" data-act="p-trip-view" data-id="${t.id}">📋 Detail &amp; Checklist</button>
      </div>
    </div>`;
  }).join('')}</div>`
  : empty(Q ? 'Tidak ada yang cocok.' : 'Belum ada rencana perjalanan.', 'trip');
}

/* ---------- forms ---------- */
const catOpts = (st, sel) => CAT[st].map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
const prioSel = v => `<select class="in" name="priority">${['High', 'Medium', 'Low'].map(p => `<option ${p === (v || 'Medium') ? 'selected' : ''}>${p}</option>`).join('')}</select>`;
const remindF = it => field(`Pengingat <small class="mut">(opsional · notifikasi &amp; Telegram)</small>`, `<input class="in" type="datetime-local" name="remindAt" value="${dtLocal(it.remindAt)}">`, 1);
const txt = (n, l, max, it, req, ph = '') => field(l, `<input class="in" name="${n}" maxlength="${max}" ${req ? 'required' : ''} value="${esc(it[n] ?? '')}" placeholder="${ph}">`, 1);
const area = (n, l, max, it, ph = '') => field(l, `<textarea class="in" name="${n}" maxlength="${max}" placeholder="${ph}">${esc(it[n] ?? '')}</textarea>`, 1);
const chk = (n, l, on) => `<label class="cbx w"><input type="checkbox" name="${n}" ${on ? 'checked' : ''}><span>${l}</span></label>`;
const money = (l, it, req) => field(l, `<input class="in" name="amount" type="number" inputmode="decimal" min="${req ? 1 : 0}" step="any" ${req ? 'required' : ''} value="${it.amount ?? ''}" placeholder="0">`);
function pForm(k, it) {
  switch (k) {
    case 'tx': {
      const st = it.status || 'expense';
      return `<div class="seg2 w" role="radiogroup" aria-label="Jenis transaksi">${[['expense', 'Pengeluaran'], ['income', 'Pemasukan']].map(([v, l]) => `<label><input type="radio" name="status" value="${v}" ${st === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`
        + money('Nominal (Rp)', it, 1) + field('Tanggal', `<input class="in" type="date" name="date" required value="${it.date || off(0)}">`)
        + txt('title', 'Keterangan', 120, it, 1, 'mis. Makan siang')
        + field('Kategori', `<select class="in" name="category" data-cat>${catOpts(st, it.category)}</select>`, 1)
        + field('Dompet / Sumber Dana', `<select class="in" name="wallet">
            <option value="cash" ${(it.wallet || 'cash') === 'cash' ? 'selected' : ''}>💵 Kas Tunai (Cash)</option>
            <option value="bank" ${it.wallet === 'bank' ? 'selected' : ''}>🏦 Rekening Bank</option>
            <option value="ewallet" ${it.wallet === 'ewallet' ? 'selected' : ''}>📱 E-Wallet (GoPay/OVO/ShopeePay)</option>
          </select>`, 1)
        + field('Transaksi Berulang (Rutin)', `<select class="in" name="recurring">
            <option value="" ${!it.recurring ? 'selected' : ''}>Bukan Rutin (Sekali Saja)</option>
            <option value="daily" ${it.recurring === 'daily' ? 'selected' : ''}>🔄 Harian</option>
            <option value="weekly" ${it.recurring === 'weekly' ? 'selected' : ''}>🔄 Mingguan</option>
            <option value="monthly" ${it.recurring === 'monthly' ? 'selected' : ''}>🔄 Bulanan (Gaji, Wifi, Tagihan)</option>
            <option value="yearly" ${it.recurring === 'yearly' ? 'selected' : ''}>🔄 Tahunan (Pajak, Asuransi)</option>
          </select>`, 1)
        + remindF(it);
    }
    case 'note': return txt('title', 'Judul', 120, it, 1) + area('body', 'Isi catatan', 5000, it, 'Tulis apa saja…')
      + `<div class="w"><p class="flab">Warna</p><div class="ncols">${Object.entries(NCOL).map(([c, v]) => `<label><input type="radio" name="color" value="${c}" ${(it.color || 'yellow') === c ? 'checked' : ''}><span style="background:${v}" title="${c}"></span></label>`).join('')}</div></div>`
      + chk('pinned', 'Sematkan di atas', it.pinned) + remindF(it);
    case 'ptask': return txt('title', 'Tugas', 120, it, 1, 'mis. Bayar listrik') + field('Tenggat', `<input class="in" type="date" name="date" value="${it.date || ''}">`) + field('Prioritas', prioSel(it.priority))
      + txt('category', 'Label (opsional)', 30, it, 0, 'Rumah, Kuliah, …') + area('body', 'Detail', 2000, it) + (it.id ? chk('done', 'Sudah selesai', it.status === 'done') : '')
      + remindF(it) + '<p class="hint w">Tugas dengan tenggat juga diingatkan otomatis H-7, H-3, H-2, H-1.</p>';
    case 'wish': return txt('title', 'Barang / keinginan', 120, it, 1) + money('Harga (Rp)', it) + field('Prioritas', prioSel(it.priority))
      + field('Link (opsional)', `<input class="in" name="url" type="url" maxlength="500" inputmode="url" value="${esc(it.url || '')}" placeholder="https://…">`, 1)
      + field('Target tanggal', `<input class="in" type="date" name="date" value="${it.date || ''}">`, 1) + area('body', 'Catatan', 1000, it)
      + (it.id ? chk('bought', 'Sudah dibeli', it.status === 'bought') : '') + remindF(it);
    case 'trip': {
      const td = it.tripData || parseTrip(it.body);
      const packLines = (td.packingList || []).map(x => `${(x.done || x.packed) ? '[x]' : '[ ]'} ${x.text || x.item || x.name || x.title || ''}`).join('\n');
      const itinLines = (td.itinerary || []).map(x => `${String(x.day || 1).startsWith('Hari') ? x.day : `Hari ${x.day || 1}`}${x.time ? ` ${x.time}` : ''}: ${x.title || x.agenda || x.text || ''}${x.notes ? ` - ${x.notes}` : ''}`).join('\n');

      return txt('title', 'Tujuan', 120, it, 1, 'mis. Liburan ke Bali')
        + field('Berangkat', `<input class="in" type="date" name="date" required value="${it.date || off(14)}">`)
        + field('Pulang', `<input class="in" type="date" name="date2" required value="${it.date2 || off(17)}">`)
        + money('Budget (Rp)', it)
        + field('Catatan Umum', `<textarea class="in" name="note" maxlength="1000" placeholder="Hotel, akomodasi, catatan penerbangan...">${esc(td.note || '')}</textarea>`, 1)
        + field('Checklist Barang Bawaan (Packing List)', `<textarea class="in" name="packingListRaw" rows="4" placeholder="Satu barang per baris, contoh:&#10;[x] Paspor&#10;[ ] Charger HP&#10;[ ] Baju hangat">${esc(packLines)}</textarea><small class="mut" style="display:block;margin-top:3px;font-size:11px">Gunakan [x] untuk barang yang sudah masuk tas.</small>`, 1)
        + field('Itinerary Harian (Daily Rundown)', `<textarea class="in" name="itineraryRaw" rows="4" placeholder="Satu agenda per baris, contoh:&#10;Hari 1 14:00: Check in hotel&#10;Hari 2 09:00: Wisata pantai Kuta&#10;Hari 3 10:00: Belanja cinderamata">${esc(itinLines)}</textarea>`, 1)
        + (it.id ? chk('done', 'Perjalanan selesai', it.status === 'done') : '') + remindF(it) + '<p class="hint w">Keberangkatan diingatkan otomatis H-7, H-3, H-2, H-1.</p>';
    }
  }
  return '';
}
function pBody(k, fd) {
  const v = n => String(fd.get(n) ?? '').trim(), num2 = n => v(n) === '' ? null : Number(v(n)), on = n => fd.get(n) === 'on';
  const b = {
    tx: () => ({ status: v('status'), amount: num2('amount'), date: v('date'), title: v('title'), category: v('category'), wallet: v('wallet') || 'cash', recurring: v('recurring') || null }),
    note: () => ({ title: v('title'), body: v('body'), color: v('color') || 'yellow', pinned: on('pinned') }),
    ptask: () => ({ title: v('title'), body: v('body'), date: v('date') || null, priority: v('priority'), category: v('category'), ...(pEditing ? { status: on('done') ? 'done' : 'todo' } : {}) }),
    wish: () => ({ title: v('title'), amount: num2('amount'), url: v('url') || null, priority: v('priority'), date: v('date') || null, body: v('body'), ...(pEditing ? { status: on('bought') ? 'bought' : 'want' } : {}) }),
    trip: () => {
      const rawPack = v('packingListRaw').split('\n').map(l => l.trim()).filter(Boolean);
      const packingList = rawPack.map((l, idx) => {
        const done = /^\[x\]/i.test(l);
        const text = l.replace(/^\[(x| )\]\s*/i, '').trim();
        return { id: idx + 1, text, done };
      });
      const rawItin = v('itineraryRaw').split('\n').map(l => l.trim()).filter(Boolean);
      const itinerary = rawItin.map((l, idx) => {
        const m = l.match(/^(?:Hari\s*(\d+))?\s*(?:(\d{1,2}:\d{2}))?\s*:\s*(.*)$/i);
        if (m) {
          return { id: idx + 1, day: m[1] ? +m[1] : 1, time: m[2] || '', title: m[3] || l };
        }
        return { id: idx + 1, day: 1, time: '', title: l };
      });
      const structuredBody = {
        note: v('note'),
        packingList,
        itinerary
      };
      return {
        title: v('title'), date: v('date'), date2: v('date2'), amount: num2('amount'),
        body: JSON.stringify(structuredBody),
        ...(pEditing ? { status: on('done') ? 'done' : 'planned' } : {})
      };
    },
  }[k]();
  b.remindAt = v('remindAt') ? new Date(v('remindAt')).getTime() : null;
  return b;
}
async function psave(method, url, body, msg) {
  try { await api(method, url, body); await LOADERS.personal(); READY.personal = true; closeLayer(); paint(false); if (msg) toast(msg); return true; }
  catch (e) { if (e.message !== 'auth') toast(e.message); return false; }
}
function pOpen(k, id) {
  const it = id ? PD.find(x => x.id === id) : {}; if (!it) return;
  pEditing = !!id;
  form(`${modalHead(`${id ? 'Edit' : 'Tambah'} ${KIND[k].toLowerCase()}`)}<form class="f" novalidate>${pForm(k, it)}<div class="fa w">${id ? `<button type="button" class="btn danger" data-act="p-del" data-id="${id}">${ic('trash')}Hapus</button><span class="sp"></span>` : ''}<button type="button" class="btn" data-act="close">Batal</button><button class="btn primary">Simpan</button></div></form>`,
    async (fd, f) => {
      if (!f.reportValidity()) return;
      const b = pBody(k, fd);
      if (b.remindAt && b.remindAt < Date.now() && b.remindAt !== it.remindAt) return toast('Waktu pengingat sudah lewat');
      await psave(id ? 'PATCH' : 'POST', id ? '/api/personal/' + id : '/api/personal', id ? b : { kind: k, ...b }, id ? 'Perubahan disimpan' : `${KIND[k]} ditambahkan`);
    });
}
const toggle = (id, body, msg) => psave('PATCH', '/api/personal/' + id, body, msg);

Object.assign(ACT, {
  pt: b => { PT = b.dataset.k; paint(true); },
  ptf: b => { PTF = b.dataset.k; paint(false); },
  pm: b => { const [y, m] = PM.split('-').map(Number), d = new Date(y, m - 1 + +b.dataset.k, 1); PM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; paint(false); },
  'p-new': b => pOpen(b.dataset.k),
  'p-edit': b => pOpen(b.dataset.k, +b.dataset.id),
  'p-quick': b => pop(b, `<p class="cap">Tambah baru</p>${Object.entries(KIND).map(([k, l]) => `<button data-act="p-new" data-k="${k}">${ic(KIC[k])}${l}</button>`).join('')}`),
  'p-del': b => { const id = +b.dataset.id; layer('modal', `${modalHead('Hapus item?')}<p class="mut" style="font-size:13px">Item ini akan dihapus permanen.</p><div class="fa"><button class="btn" data-act="close">Batal</button><button class="btn primary danger-bg" data-act="p-del-ok" data-id="${id}">Hapus</button></div>`); },
  'p-del-ok': b => psave('DELETE', '/api/personal/' + b.dataset.id, null, 'Item dihapus'),
  'p-done': b => { const t = PD.find(x => x.id === +b.dataset.id); toggle(t.id, { status: t.status === 'done' ? 'todo' : 'done' }, t.status === 'done' ? 'Tugas dibuka lagi' : 'Tugas selesai'); },
  'p-bought': b => { const w = PD.find(x => x.id === +b.dataset.id); toggle(w.id, { status: w.status === 'want' ? 'bought' : 'want' }, w.status === 'want' ? 'Selamat, keinginan tercapai!' : 'Dikembalikan ke wishlist'); },
  'p-budget': () => form(`${modalHead('Budget pengeluaran bulanan')}<form class="f">${field('Budget per bulan (Rp)', `<input class="in" name="budget" type="number" inputmode="decimal" min="0" step="any" value="${S.me.budget || ''}" placeholder="mis. 3000000">`, 1)}<p class="hint w">Isi 0 untuk mematikan budget.</p><div class="fa w"><button type="button" class="btn" data-act="close">Batal</button><button class="btn primary">Simpan</button></div></form>`,
    async fd => { const r = await mut('PATCH', '/api/me', { budget: Number(fd.get('budget') || 0) }, 'Budget disimpan'); if (r) READY.personal = true; }),
  'p-export-csv': () => {
    window.open(`/api/personal/export?format=csv&month=${PM}`, '_blank');
  },
  'p-export-pdf': () => {
    window.open(`/api/personal/export?format=pdf&month=${PM}`, '_blank');
  },
  'p-transfer': () => {
    form(`${modalHead('Transfer Antar Dompet')}<form class="f">
      ${field('Dompet Asal (Sumber Dana)', `<select class="in" name="fromWallet">
        <option value="bank">🏦 Rekening Bank</option>
        <option value="cash">💵 Kas Tunai</option>
        <option value="ewallet">📱 E-Wallet</option>
      </select>`, 1)}
      ${field('Dompet Tujuan', `<select class="in" name="toWallet">
        <option value="ewallet">📱 E-Wallet</option>
        <option value="cash">💵 Kas Tunai</option>
        <option value="bank">🏦 Rekening Bank</option>
      </select>`, 1)}
      ${money('Jumlah Transfer (Rp)', {}, 1)}
      ${field('Tanggal', `<input class="in" type="date" name="date" required value="${off(0)}">`)}
      ${field('Catatan (opsional)', `<input class="in" name="body" maxlength="300" placeholder="mis. Top up GoPay dari BCA">`, 1)}
      <div class="fa w"><button type="button" class="btn" data-act="close">Batal</button><button class="btn primary">Kirim Transfer</button></div>
    </form>`,
    async (fd, f) => {
      if (!f.reportValidity()) return;
      const fromWallet = fd.get('fromWallet');
      const toWallet = fd.get('toWallet');
      if (fromWallet === toWallet) return toast('Dompet asal dan tujuan tidak boleh sama');
      const amount = Number(fd.get('amount') || 0);
      if (amount <= 0) return toast('Nominal transfer harus lebih dari 0');
      try {
        const r = await api('POST', '/api/personal/transfer', {
          fromWallet, toWallet, amount, date: fd.get('date'), body: fd.get('body')
        });
        await LOADERS.personal();
        READY.personal = true;
        closeLayer();
        paint(false);
        toast(r.message || 'Transfer berhasil dicatat');
      } catch (e) {
        if (e.message !== 'auth') toast(e.message);
      }
    });
  },
  'p-trip-view': b => {
    const id = +b.dataset.id;
    const t = PD.find(x => x.id === id);
    if (!t) return;
    const td = t.tripData || parseTrip(t.body);
    const packs = td.packingList || [];
    const itins = td.itinerary || [];

    const packHtml = packs.length ? packs.map(p => {
      const isDone = !!(p.done || p.packed);
      const name = p.text || p.item || p.name || p.title || 'Barang bawaan';
      return `
      <label class="cbx" style="padding:6px 0;display:flex;align-items:center;gap:8px;border-bottom:1px dashed #cbd5e1">
        <input type="checkbox" data-act="p-trip-toggle-pack" data-tid="${t.id}" data-pid="${p.id}" ${isDone ? 'checked' : ''}>
        <span style="${isDone ? 'text-decoration:line-through;opacity:0.6' : 'font-weight:600'}">${esc(name)}</span>
      </label>`;
    }).join('') : '<p class="mut" style="font-size:12.5px">Belum ada barang di checklist packing. Klik Edit untuk menambah.</p>';

    const itinHtml = itins.length ? itins.map(it => {
      const dayLabel = String(it.day || 1).startsWith('Hari') ? it.day : `Hari ${it.day || 1}`;
      const title = it.title || it.agenda || it.text || 'Agenda';
      return `
      <div style="padding:8px;background:var(--ac-soft);border:1px solid #0f172a;border-radius:10px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700">
          <span>${esc(dayLabel)}</span>
          ${it.time ? `<span style="color:var(--ac)">⏰ ${esc(it.time)}</span>` : ''}
        </div>
        <p style="font-size:13px;margin-top:3px;font-weight:600">${esc(title)}</p>
      </div>`;
    }).join('') : '<p class="mut" style="font-size:12.5px">Belum ada jadwal harian. Klik Edit untuk menambah itinerary.</p>';

    layer('modal', `${modalHead(esc(t.title) + ' · Rincian Travel')}<div class="f" style="max-height:75vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="mut" style="font-size:12.5px">📅 ${short(t.date)} – ${short(t.date2)}</span>
        ${t.amount != null ? `<span class="pill" style="background:#fef3c7;border:1px solid #0f172a">Budget: ${idr(t.amount)}</span>` : ''}
      </div>
      ${td.note ? `<p style="font-size:13px;line-height:1.5;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px;margin-bottom:14px">${esc(td.note)}</p>` : ''}
      
      <h4 style="font-size:14px;font-family:'Patrick Hand',sans-serif;margin-bottom:6px">🎒 Checklist Barang Bawaan (${packs.filter(x => x.done || x.packed).length}/${packs.length})</h4>
      <div style="margin-bottom:16px">${packHtml}</div>

      <h4 style="font-size:14px;font-family:'Patrick Hand',sans-serif;margin-bottom:6px">🗺️ Jadwal Harian (Daily Rundown)</h4>
      <div style="margin-bottom:16px">${itinHtml}</div>

      <div class="fa w">
        <button type="button" class="btn" data-act="close">Tutup</button>
        <button type="button" class="btn primary" data-act="p-edit" data-k="trip" data-id="${t.id}">${ic('edit')} Edit Rencana</button>
      </div>
    </div>`);
  },
  'p-trip-toggle-pack': async b => {
    const tid = +b.dataset.tid, pid = b.dataset.pid;
    const t = PD.find(x => x.id === tid);
    if (!t) return;
    const td = t.tripData || parseTrip(t.body);
    const it = (td.packingList || []).find(x => String(x.id) === String(pid));
    if (!it) return;
    it.done = b.checked;
    it.packed = b.checked;
    const name = it.text || it.item || it.name || it.title || 'Barang';
    await api('PATCH', `/api/personal/${tid}`, { body: JSON.stringify(td) });
    await LOADERS.personal();
    READY.personal = true;
    toast(b.checked ? `"${name}" sudah masuk packing` : `"${name}" belum packing`);
  }
});
// keep category list in sync with income/expense switch
document.addEventListener('change', e => {
  if (e.target.name !== 'status' || e.target.type !== 'radio') return;
  const sel = e.target.form?.querySelector('[data-cat]'); if (sel) sel.innerHTML = catOpts(e.target.value);
});
