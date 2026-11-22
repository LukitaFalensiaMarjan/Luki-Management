'use strict';
/* Personal space API. Every query is scoped to req.user.id: items are private to their owner (admins included). */
const { all, one, run, now } = require('./core');
const { E, s, D, en, int, money, PRIO } = require('./http');

const COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'gray'];
const opt = (v, f) => v == null || v === '' ? null : f(v);
const url = u => { u = s(u, 500); if (!/^https?:\/\//i.test(u)) throw E(400, 'Link harus diawali http:// atau https://'); return u; };
// kind -> validator returning DB columns
const SPEC = {
  tx: b => ({
    title: s(b.title, 120),
    status: en(b.status, ['income', 'expense']),
    amount: money(b.amount),
    category: s(b.category, 30),
    wallet: en(b.wallet || 'cash', ['cash', 'bank', 'ewallet']),
    recurring: opt(b.recurring, v => en(v, ['daily', 'weekly', 'monthly', 'yearly'])),
    date: D(b.date),
    body: s(b.body ?? '', 500, 0)
  }),
  note: b => ({ title: s(b.title, 120), body: s(b.body ?? '', 5000, 0), color: en(b.color || 'yellow', COLORS), pinned: b.pinned ? 1 : 0 }),
  ptask: b => ({ title: s(b.title, 120), body: s(b.body ?? '', 2000, 0), date: opt(b.date, D), status: en(b.status || 'todo', ['todo', 'done']), priority: en(b.priority || 'Medium', PRIO), category: s(b.category ?? '', 30, 0) }),
  wish: b => ({ title: s(b.title, 120), amount: opt(b.amount, money), url: opt(b.url, url), priority: en(b.priority || 'Medium', PRIO), date: opt(b.date, D), status: en(b.status || 'want', ['want', 'bought']), body: s(b.body ?? '', 1000, 0) }),
  trip: b => {
    let bodyObj = null;
    if (typeof b.body === 'object' && b.body !== null) {
      bodyObj = b.body;
    } else if (typeof b.body === 'string' && b.body) {
      try { bodyObj = JSON.parse(b.body); } catch { bodyObj = { note: b.body }; }
    } else {
      bodyObj = {};
    }
    if (Array.isArray(b.packingList)) bodyObj.packingList = b.packingList;
    if (Array.isArray(b.itinerary)) bodyObj.itinerary = b.itinerary;
    if (b.notes && !bodyObj.note) bodyObj.note = b.notes;
    if (b.note && !bodyObj.note) bodyObj.note = b.note;

    const bodyStr = JSON.stringify(bodyObj);
    const date2Val = b.date2 || b.date_end || b.date;
    const o = { title: s(b.title, 120), date: D(b.date), date2: D(date2Val), amount: opt(b.amount, money), body: bodyStr, status: en(b.status || 'planned', ['planned', 'done']) };
    if (o.date2 < o.date) throw E(400, 'Tanggal pulang harus sama atau setelah tanggal berangkat');
    return o;
  },
};

const parseTrip = b => {
  if (!b) return { note: '', packingList: [], itinerary: [] };
  try {
    const o = JSON.parse(b);
    if (typeof o === 'object' && o !== null) {
      return {
        note: o.note || '',
        packingList: Array.isArray(o.packingList) ? o.packingList : [],
        itinerary: Array.isArray(o.itinerary) ? o.itinerary : []
      };
    }
  } catch {}
  return { note: b, packingList: [], itinerary: [] };
};

const out = r => {
  const base = {
    id: r.id, kind: r.kind, title: r.title, body: r.body, amount: r.amount, category: r.category,
    date: r.date, date2: r.date2, url: r.url, status: r.status, priority: r.priority, color: r.color,
    pinned: !!r.pinned, remindAt: r.remind_at, reminded: !!r.reminded_at, createdAt: r.created_at,
    wallet: r.wallet || 'cash', recurring: r.recurring || null
  };
  if (r.kind === 'trip') {
    base.tripData = parseTrip(r.body);
  }
  return base;
};
function remindAt(v, old) {
  if (v == null || v === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) throw E(400, 'Waktu pengingat tidak valid');
  if (n !== old && n < now() - 60000) throw E(400, 'Waktu pengingat sudah lewat');
  if (n > now() + 5 * 365 * 864e5) throw E(400, 'Waktu pengingat terlalu jauh');
  return n;
}
const get = (id, uid) => one('SELECT * FROM personal WHERE id=? AND user_id=?', id, uid);

module.exports = app => {
  app.get('/api/personal', (req, res) => res.json(all('SELECT * FROM personal WHERE user_id=? ORDER BY id DESC LIMIT 5000', req.user.id).map(out)));
  app.post('/api/personal', (req, res) => {
    const b = req.body || {}, kind = en(b.kind, Object.keys(SPEC));
    if (one('SELECT COUNT(*) n FROM personal WHERE user_id=?', req.user.id).n >= 5000) throw E(400, 'Batas 5000 item tercapai');
    const f = { ...SPEC[kind](b), remind_at: remindAt(b.remindAt) }, k = Object.keys(f);
    const r = run(`INSERT INTO personal(user_id,kind,created_at,${k.join(',')}) VALUES(?,?,?,${k.map(() => '?').join(',')})`, req.user.id, kind, now(), ...k.map(x => f[x]));
    res.status(201).json(out(get(r.lastInsertRowid, req.user.id)));
  });
  app.patch('/api/personal/:id', (req, res) => {
    const r = get(int(req.params.id), req.user.id); if (!r) throw E(404, 'Item tidak ditemukan');
    const b = { ...out(r), ...(req.body || {}) }, f = SPEC[r.kind](b);
    f.remind_at = remindAt(b.remindAt, r.remind_at);
    if (f.remind_at !== r.remind_at) f.reminded_at = null;
    const k = Object.keys(f);
    run(`UPDATE personal SET ${k.map(x => x + '=?').join(',')} WHERE id=?`, ...k.map(x => f[x]), r.id);
    res.json(out(get(r.id, req.user.id)));
  });
  app.delete('/api/personal/:id', (req, res) => {
    if (!run('DELETE FROM personal WHERE id=? AND user_id=?', int(req.params.id), req.user.id).changes) throw E(404, 'Item tidak ditemukan');
    res.json({ ok: true });
  });

  app.post('/api/personal/transfer', (req, res) => {
    const b = req.body || {};
    const fromW = en(b.fromWallet, ['cash', 'bank', 'ewallet']);
    const toW = en(b.toWallet, ['cash', 'bank', 'ewallet']);
    if (fromW === toW) throw E(400, 'Dompet asal dan tujuan tidak boleh sama');
    const amt = money(b.amount);
    const d = D(b.date || (new Date().toISOString().slice(0, 10)));
    const note = s(b.body || '', 300, 0);

    const wNames = { cash: 'Kas Tunai', bank: 'Rekening Bank', ewallet: 'E-Wallet' };
    const outTitle = `Transfer ke ${wNames[toW]}`;
    const inTitle = `Transfer dari ${wNames[fromW]}`;

    const tOut = run("INSERT INTO personal(user_id,kind,title,amount,category,date,wallet,status,body,created_at) VALUES(?, 'tx', ?, ?, 'Transfer Dompet', ?, ?, 'expense', ?, ?)",
      req.user.id, outTitle, amt, d, fromW, note, now());
    const tIn = run("INSERT INTO personal(user_id,kind,title,amount,category,date,wallet,status,body,created_at) VALUES(?, 'tx', ?, ?, 'Transfer Dompet', ?, ?, 'income', ?, ?)",
      req.user.id, inTitle, amt, d, toW, note, now());

    res.status(201).json({
      ok: true,
      outId: tOut.lastInsertRowid,
      inId: tIn.lastInsertRowid,
      message: `Berhasil transfer Rp${Math.round(amt).toLocaleString('id-ID')} dari ${wNames[fromW]} ke ${wNames[toW]}`
    });
  });

  app.get('/api/personal/export', (req, res) => {
    const format = req.query.format === 'pdf' ? 'pdf' : 'csv';
    const month = req.query.month ? String(req.query.month).slice(0, 7) : null;
    let q = "SELECT * FROM personal WHERE user_id=? AND kind='tx'";
    const params = [req.user.id];
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      q += ' AND date LIKE ?';
      params.push(month + '%');
    }
    q += ' ORDER BY date DESC, id DESC';
    const rows = all(q, ...params);

    const wNames = { cash: 'Kas Tunai', bank: 'Rekening Bank', ewallet: 'E-Wallet' };
    const clean = s => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

    if (format === 'csv') {
      const header = 'Tanggal,Judul,Kategori,Dompet,Jenis,Jumlah (Rp),Rutin,Catatan\r\n';
      const csvLines = rows.map(r => [
        r.date,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${wNames[r.wallet] || r.wallet || 'Kas'}"`,
        r.status === 'income' ? 'Pemasukan' : 'Pengeluaran',
        Math.round(r.amount || 0),
        r.recurring || 'Tidak',
        `"${(r.body || '').replace(/"/g, '""')}"`
      ].join(',')).join('\r\n');

      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="laporan-keuangan-${month || 'semua'}.csv"`
      }).send('\uFEFF' + header + csvLines);
      return;
    }

    // PDF Generation
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      const buf = Buffer.concat(chunks);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="laporan-keuangan-${month || 'semua'}.pdf"`,
        'Content-Length': buf.length
      }).end(buf);
    });

    const inc = rows.filter(r => r.status === 'income').reduce((a, r) => a + (r.amount || 0), 0);
    const exp = rows.filter(r => r.status === 'expense').reduce((a, r) => a + (r.amount || 0), 0);
    const net = inc - exp;
    const idrFmt = n => (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n || 0)).toLocaleString('id-ID');

    // Header
    doc.rect(0, 0, doc.page.width, 95).fill('#0f172a');
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text('LUKI MANAGEMENT', 48, 24);
    doc.font('Helvetica').fontSize(11).fillColor('#94a3b8').text(`Laporan Keuangan Pribadi · Periode: ${month || 'Semua Waktu'}`, 48, 48);
    doc.font('Helvetica').fontSize(9).fillColor('#cbd5e1').text(`Dibuat untuk: ${clean(req.user.name)} (${clean(req.user.email)}) pada ${new Date().toLocaleDateString('id-ID')}`, 48, 66);

    doc.y = 115;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text('Ringkasan Finansial', 48, doc.y);
    doc.moveDown(0.4);

    const boxY = doc.y;
    doc.roundedRect(48, boxY, 155, 55, 6).fillAndStroke('#ecfdf5', '#10b981');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#047857').text('TOTAL PEMASUKAN', 58, boxY + 10);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#065f46').text(idrFmt(inc), 58, boxY + 28);

    doc.roundedRect(218, boxY, 155, 55, 6).fillAndStroke('#fef2f2', '#ef4444');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#b91c1c').text('TOTAL PENGELUARAN', 228, boxY + 10);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#991b1b').text(idrFmt(exp), 228, boxY + 28);

    doc.roundedRect(388, boxY, 155, 55, 6).fillAndStroke('#f0f9ff', '#0284c7');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0369a1').text('SALDO BERSIH', 398, boxY + 10);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#075985').text(idrFmt(net), 398, boxY + 28);

    doc.y = boxY + 70;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Saldo Berjalan per Dompet', 48, doc.y);
    doc.moveDown(0.3);
    const wY = doc.y;
    const calcW = w => rows.filter(r => (r.wallet || 'cash') === w).reduce((a, r) => a + (r.status === 'income' ? r.amount : -r.amount), 0);
    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    doc.text(`Kas Tunai: ${idrFmt(calcW('cash'))}`, 48, wY);
    doc.text(`Rekening Bank: ${idrFmt(calcW('bank'))}`, 218, wY);
    doc.text(`E-Wallet: ${idrFmt(calcW('ewallet'))}`, 388, wY);

    doc.y = wY + 25;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Rincian Transaksi', 48, doc.y);
    doc.moveDown(0.3);

    const thY = doc.y;
    doc.rect(48, thY, 500, 18).fill('#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569');
    doc.text('Tanggal', 56, thY + 4, { width: 65 });
    doc.text('Keterangan', 125, thY + 4, { width: 170 });
    doc.text('Kategori', 300, thY + 4, { width: 90 });
    doc.text('Dompet', 395, thY + 4, { width: 65 });
    doc.text('Jumlah', 465, thY + 4, { width: 75, align: 'right' });

    let curY = thY + 22;
    for (const r of rows.slice(0, 150)) {
      if (curY > doc.page.height - 50) {
        doc.addPage();
        curY = 48;
      }
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
      doc.text(r.date, 56, curY, { width: 65 });
      doc.text(clean(r.title), 125, curY, { width: 170, ellipsis: true });
      doc.text(clean(r.category || '-'), 300, curY, { width: 90, ellipsis: true });
      doc.text(wNames[r.wallet] || r.wallet || 'Kas', 395, curY, { width: 65 });
      const isInc = r.status === 'income';
      doc.fillColor(isInc ? '#059669' : '#dc2626');
      doc.text((isInc ? '+' : '-') + idrFmt(r.amount), 465, curY, { width: 75, align: 'right' });
      curY += 16;
    }

    doc.end();
  });
};
