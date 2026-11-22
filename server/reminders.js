'use strict';
/* Reminders:
   - Work tasks/projects and personal tasks/trips: H-7, H-3, H-2, H-1 (once per item, due date, step, user).
   - Personal items with an exact reminder time (remind_at): sent once, checked every minute. */
const { all, run, now, daysTo, notify } = require('./core');
const STEPS = [7, 3, 2, 1];
const fmt = s => { const [y, m, d] = s.split('-'); return `${+d} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m - 1]} ${y}`; };
const idr = n => 'Rp' + Math.round(n).toLocaleString('id-ID');

function send(kind, id, due, days, uid, text, pref = 'due') {
  const r = run('INSERT OR IGNORE INTO reminders(kind,ref_id,due,days,user_id,sent_at) VALUES(?,?,?,?,?,?)', kind, id, due, days, uid, now());
  if (r.changes) notify(uid, pref, text);
}
function check() {
  if (new Date().getHours() < (+process.env.REMINDER_HOUR || 8)) return 0;
  let n = 0;
  for (const t of all(`SELECT t.*,p.name pname FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.stage!='done'`)) {
    const d = daysTo(t.due); if (!STEPS.includes(d)) continue;
    for (const a of all('SELECT user_id FROM task_assignees WHERE task_id=?', t.id)) {
      send('task', t.id, t.due, d, a.user_id, `⏰ H-${d}: Task "${t.title}" jatuh tempo ${d === 1 ? 'besok' : 'pada'} ${fmt(t.due)}${t.pname ? ` (project ${t.pname})` : ''}.`); n++;
    }
  }
  for (const p of all(`SELECT * FROM projects WHERE status!='ended'`)) {
    const d = daysTo(p.due); if (!STEPS.includes(d)) continue;
    const who = new Set(all('SELECT DISTINCT a.user_id FROM task_assignees a JOIN tasks t ON t.id=a.task_id WHERE t.project_id=?', p.id).map(r => r.user_id));
    if (p.owner_id) who.add(p.owner_id);
    for (const u of who) { send('project', p.id, p.due, d, u, `⏰ H-${d}: Project "${p.name}" berakhir ${d === 1 ? 'besok' : 'pada'} ${fmt(p.due)}.`); n++; }
  }
  for (const t of all(`SELECT * FROM personal WHERE kind='ptask' AND status='todo' AND date IS NOT NULL`)) {
    const d = daysTo(t.date); if (!STEPS.includes(d)) continue;
    send('ptask', t.id, t.date, d, t.user_id, `H-${d}: Tugas pribadi "${t.title}" jatuh tempo ${d === 1 ? 'besok' : 'pada'} ${fmt(t.date)}.`, 'personal'); n++;
  }
  for (const t of all(`SELECT * FROM personal WHERE kind='trip' AND status='planned'`)) {
    const d = daysTo(t.date); if (!STEPS.includes(d)) continue;
    send('trip', t.id, t.date, d, t.user_id, `H-${d}: Perjalanan ke ${t.title} ${d === 1 ? 'besok' : 'pada'} ${fmt(t.date)}. Jangan lupa cek tiket & barang bawaan!`, 'personal'); n++;
  }
  checkBirthdays();
  return n;
}

function checkBirthdays() {
  const d = new Date();
  const todayMD = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const year = d.getFullYear();
  const bdays = all('SELECT id,name,birth_date FROM users WHERE share_birthday=1 AND birth_date IS NOT NULL AND disabled=0 AND email_verified=1');
  for (const u of bdays) {
    if (!u.birth_date || u.birth_date.slice(5) !== todayMD) continue;
    const key = `bday-${year}`;
    const sent = one('SELECT 1 FROM reminders WHERE kind=? AND ref_id=? AND due=?', 'bday', u.id, key);
    if (sent) continue;

    // Notify teammates
    const others = all('SELECT id FROM users WHERE id!=? AND disabled=0 AND email_verified=1', u.id);
    for (const o of others) {
      notify(o.id, 'announce', `🎉 Hari ini ${u.name} berulang tahun! Jangan lupa ucapkan selamat ulang tahun! 🎂`);
    }
    // Birthday wish to the member themselves
    notify(u.id, 'announce', `🎂 Selamat ulang tahun, ${u.name}! Semoga harimu menyenangkan dan sukses selalu! 🎉`);

    run('INSERT OR IGNORE INTO reminders(kind,ref_id,due,days,user_id,sent_at) VALUES(?,?,?,?,?,?)', 'bday', u.id, key, 0, u.id, now());
  }
}
const LABEL = { tx: 'Keuangan', note: 'Catatan', ptask: 'Tugas pribadi', wish: 'Wishlist', trip: 'Travel' };
function exact() {
  let n = 0;
  for (const r of all('SELECT * FROM personal WHERE remind_at IS NOT NULL AND reminded_at IS NULL AND remind_at<=?', now())) {
    if (!run('UPDATE personal SET reminded_at=? WHERE id=? AND reminded_at IS NULL', now(), r.id).changes) continue;
    const extra = (r.kind === 'tx' || r.kind === 'wish') && r.amount ? ` — ${idr(r.amount)}` : r.kind === 'trip' ? ` (${fmt(r.date)})` : '';
    notify(r.user_id, 'personal', `Pengingat ${LABEL[r.kind] || ''}: ${r.title}${extra}${r.kind === 'note' && r.body ? `\n${r.body.slice(0, 300)}` : ''}`); n++;
  }
  return n;
}
const start = () => { check(); exact(); setInterval(check, 15 * 60 * 1000).unref(); setInterval(exact, 60 * 1000).unref(); };
module.exports = { start, check, exact };
