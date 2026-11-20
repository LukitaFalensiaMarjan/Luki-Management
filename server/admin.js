'use strict';
/* Admin API: workspace stats, user management, broadcast. Admins cannot change or delete their own account here (lock-out guard). */
const { all, one, run, now, online, pushUser, notify, clients } = require('./core');
const { E, s, int } = require('./http');

module.exports = app => {
  const admin = (req, res, next) => req.user.is_admin ? next() : next(E(403, 'Khusus admin'));
  const n = sql => one(sql).n;
  const kick = id => { pushUser(id, { type: 'logout' }); for (const r of clients.get(id) || []) r.end(); };

  app.get('/api/admin/overview', admin, (req, res) => {
    const days = Array(30).fill(0), t = now();
    for (const u of all('SELECT created_at FROM users WHERE created_at>=?', t - 30 * 864e5)) { const i = 29 - Math.floor((t - u.created_at) / 864e5); if (i >= 0) days[i]++; }
    res.json({
      stats: {
        users: n('SELECT COUNT(*) n FROM users'), verified: n('SELECT COUNT(*) n FROM users WHERE email_verified=1'), admins: n('SELECT COUNT(*) n FROM users WHERE is_admin=1'),
        disabled: n('SELECT COUNT(*) n FROM users WHERE disabled=1'), google: n('SELECT COUNT(*) n FROM users WHERE google_id IS NOT NULL'), telegram: n('SELECT COUNT(*) n FROM users WHERE tg_chat_id IS NOT NULL'),
        online: clients.size, projects: n('SELECT COUNT(*) n FROM projects'), tasks: n('SELECT COUNT(*) n FROM tasks'), messages: n('SELECT COUNT(*) n FROM messages'), personal: n('SELECT COUNT(*) n FROM personal'),
      },
      signups: days,
      users: all(`SELECT u.id,u.name,u.email,u.role,u.division div,u.email_verified verified,u.is_admin admin,u.disabled,u.google_id IS NOT NULL google,u.tg_chat_id IS NOT NULL tg,u.created_at createdAt,u.last_login lastLogin,
        (SELECT COUNT(*) FROM task_assignees a WHERE a.user_id=u.id) tasks FROM users u ORDER BY u.id`).map(u => ({ ...u, on: online(u.id) })),
    });
  });

  const target = req => {
    const id = int(req.params.id);
    if (id === req.user.id) throw E(400, 'Tidak bisa mengubah akun sendiri dari halaman admin');
    const u = one('SELECT id,name FROM users WHERE id=?', id); if (!u) throw E(404, 'User tidak ditemukan');
    return u;
  };
  app.patch('/api/admin/users/:id', admin, (req, res) => {
    const u = target(req), b = req.body || {};
    if ('admin' in b) run('UPDATE users SET is_admin=? WHERE id=?', b.admin ? 1 : 0, u.id);
    if ('disabled' in b) { run('UPDATE users SET disabled=? WHERE id=?', b.disabled ? 1 : 0, u.id); if (b.disabled) { run('DELETE FROM sessions WHERE user_id=?', u.id); kick(u.id); } }
    if (b.verified === true) run('UPDATE users SET email_verified=1,verify_hash=NULL,verify_exp=NULL WHERE id=?', u.id);
    res.json({ ok: true });
  });
  app.delete('/api/admin/users/:id', admin, (req, res) => { const u = target(req); kick(u.id); run('DELETE FROM users WHERE id=?', u.id); res.json({ ok: true }); });
  app.post('/api/admin/broadcast', admin, (req, res) => {
    const text = s(req.body?.text, 500), ids = all('SELECT id FROM users WHERE disabled=0 AND email_verified=1');
    for (const u of ids) notify(u.id, 'announce', `Pengumuman: ${text}`);
    res.json({ sent: ids.length });
  });
};
