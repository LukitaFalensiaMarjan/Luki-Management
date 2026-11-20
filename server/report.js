'use strict';
/* PDF completion report for a project (pdfkit, built-in Helvetica). */
const PDFDocument = require('pdfkit');
const { all, one, dayOf } = require('./core');

const NAVY = '#0b1f5c', AC = '#1e47b8', MUT = '#64748b', LINE = '#e2e8f0', BG = '#f1f5f9';
const clean = s => String(s ?? '').replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, '?');
const dt = ms => ms ? new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const dd = s => { if (!s) return '-'; const [y, m, d] = s.split('-').map(Number); return dt(new Date(y, m - 1, d).getTime()); };
const STAGE = { todo: 'To do', progress: 'In progress', review: 'In review', done: 'Done' };

function gather(pid) {
  const p = one('SELECT p.*,u.name owner FROM projects p LEFT JOIN users u ON u.id=p.owner_id WHERE p.id=?', pid);
  if (!p) return null;
  const tasks = all('SELECT * FROM tasks WHERE project_id=? ORDER BY id', pid).map(t => ({
    ...t, who: all('SELECT u.id,u.name FROM task_assignees a JOIN users u ON u.id=a.user_id WHERE a.task_id=?', t.id),
  }));
  const hours = all('SELECT user_id,SUM(seconds) s FROM time_entries WHERE project_id=? GROUP BY user_id', pid);
  const people = new Map();
  for (const t of tasks) for (const w of t.who) {
    const x = people.get(w.id) || { name: w.name, assigned: 0, done: 0, hours: 0 };
    x.assigned++; if (t.stage === 'done') x.done++; people.set(w.id, x);
  }
  for (const h of hours) { const u = one('SELECT name FROM users WHERE id=?', h.user_id); const x = people.get(h.user_id) || { name: u?.name || 'Unknown', assigned: 0, done: 0, hours: 0 }; x.hours = h.s / 3600; people.set(h.user_id, x); }
  const logs = all('SELECT a.text,a.created_at,u.name FROM activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.project_id=? ORDER BY a.created_at DESC LIMIT 40', pid).reverse();
  return { p, tasks, people: [...people.values()], logs, totalHours: hours.reduce((a, h) => a + h.s, 0) / 3600 };
}

function buildReport(pid) {
  return new Promise((resolve, reject) => {
    const g = gather(pid); if (!g) return reject(new Error('Project tidak ditemukan'));
    const { p, tasks, people, logs, totalHours } = g;
    const done = tasks.filter(t => t.stage === 'done'), open = tasks.length - done.length;
    const late = done.filter(t => t.completed_at && dayOf(t.completed_at) > t.due).length;
    const end = p.completed_at || Date.now(), days = Math.max(0, Math.round((end - p.created_at) / 864e5));
    const onTime = p.completed_at ? dayOf(p.completed_at) <= p.due : null;
    const lateDays = p.completed_at ? Math.max(1, Math.round((Date.parse(dayOf(p.completed_at)) - Date.parse(p.due)) / 864e5)) : 0;
    const rate = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;

    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: clean(`Laporan Project - ${p.name}`), Author: 'LUKI MANAGEMENT' } });
    const chunks = []; doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const W = doc.page.width - 96, L = 48, bottom = () => doc.page.height - 64;
    const need = h => { if (doc.y + h > bottom()) { doc.addPage(); doc.y = 48; } };
    const h2 = t => { need(60); doc.moveDown(.8); doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text(t, L); const y = doc.y + 3; doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1.5).strokeColor(AC).stroke(); doc.y = y + 8; };

    // header band
    doc.rect(0, 0, doc.page.width, 118).fill(NAVY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#9db4f5').text('LUKI MANAGEMENT  |  PROJECT COMPLETION REPORT', L, 34, { characterSpacing: 1.2 });
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#fff').text(clean(p.name), L, 54, { width: W, height: 34, ellipsis: true });
    doc.font('Helvetica').fontSize(10).fillColor('#c7d4fb').text(`Dibuat ${dt(Date.now())}  |  Status: ${p.status === 'ended' ? 'SELESAI' : p.status.toUpperCase()}`, L, 92);
    doc.y = 138;

    // summary
    h2('Ringkasan');
    const rows = [['Owner', p.owner || '-'], ['Dibuat', dt(p.created_at)], ['Target selesai', dd(p.due)], ['Selesai pada', dt(p.completed_at)], ['Durasi', `${days} hari`],
      ['Ketepatan waktu', onTime === null ? '-' : onTime ? 'Tepat waktu' : `Terlambat ${lateDays} hari`]];
    need(rows.length / 2 * 32 + 10); let ry = doc.y;
    rows.forEach(([k, v], i) => {
      const x = L + (i % 2) * (W / 2);
      doc.font('Helvetica').fontSize(8.5).fillColor(MUT).text(k.toUpperCase(), x, ry, { width: W / 2 - 10, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(clean(v), x, ry + 11, { width: W / 2 - 10, lineBreak: false });
      if (i % 2) ry += 32;
    });
    doc.y = ry + 4;

    // metrics boxes
    need(70); const my = doc.y, bw = (W - 24) / 4;
    [['Total task', tasks.length], ['Selesai', `${done.length} (${rate}%)`], ['Terlambat', late], ['Jam tercatat', totalHours.toFixed(1) + ' h']].forEach(([k, v], i) => {
      const x = L + i * (bw + 8); doc.roundedRect(x, my, bw, 56, 8).fill(BG);
      doc.font('Helvetica-Bold').fontSize(16).fillColor(i === 2 && late ? '#b91c1c' : AC).text(String(v), x + 10, my + 12, { width: bw - 20, lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(MUT).text(k, x + 10, my + 36, { width: bw - 20, lineBreak: false });
    });
    doc.y = my + 70;
    if (open) { doc.roundedRect(L, doc.y, W, 24, 6).fill('#fdf3e2'); doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#b45309').text(`Perhatian: ${open} task belum selesai saat project ditandai selesai.`, L + 10, doc.y + 8, { width: W - 20, lineBreak: false }); doc.y += 34; }

    // table helper
    const table = (cols, data) => {
      const head = () => { need(26); const y = doc.y; doc.rect(L, y, W, 20).fill(NAVY); let x = L; cols.forEach(c => { doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#fff').text(c.h, x + 6, y + 6, { width: c.w - 12, lineBreak: false }); x += c.w; }); doc.y = y + 20; };
      head();
      data.forEach((r, i) => {
        doc.font('Helvetica').fontSize(8.5);
        const h = Math.max(20, ...cols.map((c, j) => doc.heightOfString(clean(r[j]), { width: c.w - 12 }) + 10));
        if (doc.y + h > bottom()) { doc.addPage(); doc.y = 48; head(); }
        const y = doc.y; if (i % 2) doc.rect(L, y, W, h).fill('#f8fafc');
        let x = L; cols.forEach((c, j) => { doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a').text(clean(r[j]), x + 6, y + 5, { width: c.w - 12 }); x += c.w; });
        doc.moveTo(L, y + h).lineTo(L + W, y + h).lineWidth(.5).strokeColor(LINE).stroke(); doc.y = y + h;
      });
    };

    h2('Rincian task');
    if (!tasks.length) doc.font('Helvetica').fontSize(10).fillColor(MUT).text('Belum ada task pada project ini.', L);
    else table([{ h: '#', w: 22 }, { h: 'Task', w: 150 }, { h: 'Assignee', w: 100 }, { h: 'Prioritas', w: 52 }, { h: 'Target', w: 58 }, { h: 'Selesai', w: 58 }, { h: 'Status', w: W - 440 }],
      tasks.map((t, i) => [i + 1, t.title, t.who.map(w => w.name).join(', ') || '-', t.prio, dd(t.due), dt(t.completed_at), STAGE[t.stage]]));

    h2('Kontribusi tim');
    if (!people.length) doc.font('Helvetica').fontSize(10).fillColor(MUT).text('Belum ada kontribusi tercatat.', L);
    else table([{ h: 'Anggota', w: W - 270 }, { h: 'Ditugaskan', w: 90 }, { h: 'Selesai', w: 90 }, { h: 'Jam', w: 90 }], people.sort((a, b) => b.done - a.done).map(x => [x.name, x.assigned, x.done, x.hours.toFixed(1)]));

    h2('Linimasa aktivitas');
    if (!logs.length) doc.font('Helvetica').fontSize(10).fillColor(MUT).text('Tidak ada aktivitas tercatat.', L);
    else logs.forEach(l => { need(18); const y = doc.y; doc.circle(L + 3, y + 5, 2.5).fill(AC); doc.font('Helvetica').fontSize(8.5).fillColor(MUT).text(dt(l.created_at), L + 12, y, { width: 70, lineBreak: false }); doc.fillColor('#0f172a').text(clean(l.text), L + 88, y, { width: W - 88 }); doc.y += 4; });

    // footer on every page
    const n = doc.bufferedPageRange().count;
    for (let i = 0; i < n; i++) {
      doc.switchToPage(i); doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor(MUT).text(`LUKI MANAGEMENT  |  ${clean(p.name)}`, L, doc.page.height - 36, { width: W / 2, lineBreak: false });
      doc.text(`Halaman ${i + 1} dari ${n}`, L + W / 2, doc.page.height - 36, { width: W / 2, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
module.exports = { buildReport };
