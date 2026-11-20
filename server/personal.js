'use strict';
/* Personal space API. Every query is scoped to req.user.id: items are private to their owner (admins included). */
const { all, one, run, now } = require('./core');
const { E, s, D, en, int, money, PRIO } = require('./http');

const COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'gray'];
const opt = (v, f) => v == null || v === '' ? null : f(v);
const url = u => { u = s(u, 500); if (!/^https?:\/\//i.test(u)) throw E(400, 'Link harus diawali http:// atau https://'); return u; };
// kind -> validator returning DB columns
const SPEC = {
  tx: b => ({ title: s(b.title, 120), status: en(b.status, ['income', 'expense']), amount: money(b.amount), category: s(b.category, 30), date: D(b.date), body: s(b.body ?? '', 500, 0) }),
  note: b => ({ title: s(b.title, 120), body: s(b.body ?? '', 5000, 0), color: en(b.color || 'yellow', COLORS), pinned: b.pinned ? 1 : 0 }),
  ptask: b => ({ title: s(b.title, 120), body: s(b.body ?? '', 2000, 0), date: opt(b.date, D), status: en(b.status || 'todo', ['todo', 'done']), priority: en(b.priority || 'Medium', PRIO), category: s(b.category ?? '', 30, 0) }),
  wish: b => ({ title: s(b.title, 120), amount: opt(b.amount, money), url: opt(b.url, url), priority: en(b.priority || 'Medium', PRIO), date: opt(b.date, D), status: en(b.status || 'want', ['want', 'bought']), body: s(b.body ?? '', 1000, 0) }),
  trip: b => {
    const o = { title: s(b.title, 120), date: D(b.date), date2: D(b.date2), amount: opt(b.amount, money), body: s(b.body ?? '', 3000, 0), status: en(b.status || 'planned', ['planned', 'done']) };
    if (o.date2 < o.date) throw E(400, 'Tanggal pulang harus sama atau setelah tanggal berangkat');
    return o;
  },
};
const out = r => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, amount: r.amount, category: r.category, date: r.date, date2: r.date2, url: r.url, status: r.status, priority: r.priority, color: r.color, pinned: !!r.pinned, remindAt: r.remind_at, reminded: !!r.reminded_at, createdAt: r.created_at });
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
};
