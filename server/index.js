'use strict';
const core = require('./core');
const { all, one, run, tx, now, today, dayOf, addDays, hashPw, verifyPw, clients, online, pushUser, broadcast, notify, activity } = core;
const express = require('express'), crypto = require('crypto'), path = require('path');
const { E, s, D, en, int, money, sha, cookies, startSession, limited, tries, EMAIL, PRIO, APP_URL, SECURE, COOKIE } = require('./http');
const tg = require('./telegram'), reminders = require('./reminders'), mail = require('./mail'), { buildReport } = require('./report');
const PORT = +process.env.PORT || 3000, HOST = process.env.HOST || '127.0.0.1';
const TAGS = ['Frontend', 'Backend', 'Design', 'QA', 'Marketing'], STAGES = ['todo', 'progress', 'review', 'done'];
const STATUS = ['pending', 'running', 'ended'], DIVS = ['Engineering', 'Design', 'Marketing', 'Management'], EV = ['meeting', 'team', 'review', 'deadline', 'social'];
const STAGE_LABEL = { todo: 'To do', progress: 'In progress', review: 'In review', done: 'Done' };
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'" });
  next();
});
app.use(express.json({ limit: '300kb' }));
// CSRF defence: state-changing calls must carry a custom header (cross-site forms cannot set it) on top of SameSite=Lax cookies.
app.use('/api', (req, res, next) => { if (req.method !== 'GET' && req.get('x-luki') !== '1') return next(E(403, 'Permintaan ditolak')); next(); });
app.use('/api', (req, res, next) => {
  res.on('finish', () => { if (req.method !== 'GET' && res.statusCode < 300 && req.user && !/^\/(auth|messages|notifications|telegram|personal)/.test(req.path)) broadcast({ type: 'data' }); });
  next();
});

/* ---------- auth: email + password (with email verification) ---------- */
const firstUser = () => !one('SELECT 1 FROM users LIMIT 1');
async function sendVerify(u) {
  const tok = crypto.randomBytes(32).toString('base64url');
  run('UPDATE users SET verify_hash=?,verify_exp=? WHERE id=?', sha(tok), now() + 864e5, u.id);
  try { return await mail.sendVerify(u.email, u.name, `${APP_URL}/api/auth/verify?token=${tok}`); } catch (e) { console.error('[mail]', e.message); return false; }
}
function auth(req, res, next) {
  const t = cookies(req)[COOKIE];
  const u = t && one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0', sha(t), now());
  if (!u) return next(E(401, 'Silakan login'));
  req.user = u; next();
}
const pubUser = u => ({ id: u.id, name: u.name, role: u.role, div: u.division, loc: u.location, on: online(u.id) });
const meUser = u => ({ ...pubUser(u), email: u.email, bio: u.bio, tz: u.tz, accent: u.accent, week: u.week, notif: JSON.parse(u.notif), tg: !!u.tg_chat_id, admin: !!u.is_admin, provider: u.google_id ? 'google' : 'email', hasPassword: !!u.pass_hash, budget: u.budget || 0 });

app.post('/api/auth/register', async (req, res) => {
  if (process.env.ALLOW_REGISTER === '0') throw E(403, 'Pendaftaran ditutup');
  if (limited('reg' + req.ip)) throw E(429, 'Terlalu banyak percobaan, coba lagi nanti');
  const b = req.body || {}, name = s(b.name, 50, 2), email = s(b.email, 100).toLowerCase(), pw = s(b.password, 100, 8);
  if (!EMAIL.test(email)) throw E(400, 'Email tidak valid');
  const div = en(b.division || 'Engineering', DIVS), role = b.role ? s(b.role, 40, 0) || 'Member' : 'Member';
  const ex = one('SELECT * FROM users WHERE email=?', email);
  if (ex && ex.email_verified) throw E(409, 'Email sudah terdaftar. Silakan login.');
  const hash = await hashPw(pw);
  // Unverified registration can be re-done: only the inbox owner can ever activate it.
  const id = ex ? (run('UPDATE users SET name=?,pass_hash=?,role=?,division=? WHERE id=?', name, hash, role, div, ex.id), ex.id)
    : run('INSERT INTO users(name,email,pass_hash,role,division,created_at,email_verified,is_admin) VALUES(?,?,?,?,?,?,0,?)', name, email, hash, role, div, now(), firstUser() ? 1 : 0).lastInsertRowid;
  const sent = await sendVerify({ id, email, name });
  res.status(201).json({ verify: true, email, sent });
});
app.get('/api/auth/verify', (req, res) => {
  const t = String(req.query.token || '');
  const u = t && one('SELECT id,disabled FROM users WHERE verify_hash=? AND verify_exp>?', sha(t), now());
  if (!u) return res.redirect('/?auth=invalid');
  run('UPDATE users SET email_verified=1,verify_hash=NULL,verify_exp=NULL,last_login=? WHERE id=?', now(), u.id);
  if (u.disabled) return res.redirect('/?auth=disabled');
  startSession(res, u.id); res.redirect('/?auth=verified#/dashboard');
});
app.post('/api/auth/resend', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (limited('resend' + req.ip, 5)) throw E(429, 'Terlalu sering, coba lagi 10 menit lagi');
  const u = EMAIL.test(email) && one('SELECT id,email,name FROM users WHERE email=? AND email_verified=0', email);
  if (u) await sendVerify(u);
  res.json({ ok: true }); // same answer whether or not the account exists
});
const DUMMY = hashPw('dummy-password');
app.post('/api/auth/login', async (req, res) => {
  const b = req.body || {}, email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '', pw = typeof b.password === 'string' ? b.password : '';
  if (limited('login' + req.ip + email)) throw E(429, 'Terlalu banyak percobaan, coba lagi nanti');
  const u = email && one('SELECT * FROM users WHERE email=?', email);
  const ok = u && u.pass_hash ? await verifyPw(pw, u.pass_hash) : (await verifyPw(pw, await DUMMY), false);
  if (!ok) throw E(401, u && !u.pass_hash ? 'Akun ini terdaftar lewat Google. Gunakan tombol "Lanjut dengan Google".' : 'Email atau password salah');
  if (u.disabled) throw E(403, 'Akun kamu dinonaktifkan admin');
  if (!u.email_verified) throw E(403, 'Email belum diverifikasi. Cek inbox (atau folder spam) kamu.', 'unverified');
  tries.delete('login' + req.ip + email); run('UPDATE users SET last_login=? WHERE id=?', now(), u.id);
  startSession(res, u.id); res.json({ ok: true });
});
app.post('/api/auth/logout', (req, res) => {
  const t = cookies(req)[COOKIE]; if (t) run('DELETE FROM sessions WHERE token_hash=?', sha(t));
  res.append('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${SECURE}`); res.json({ ok: true });
});

/* ---------- auth: Google OAuth 2.0 (authorization code + PKCE) ---------- */
const GID = process.env.GOOGLE_CLIENT_ID, GSEC = process.env.GOOGLE_CLIENT_SECRET, GREDIR = `${APP_URL}/api/auth/google/callback`;
const b64u = b => b.toString('base64url');
app.get('/api/auth/config', (req, res) => res.json({ google: !!(GID && GSEC), register: process.env.ALLOW_REGISTER !== '0' }));
app.get('/api/auth/google', (req, res) => {
  if (!GID || !GSEC) return res.redirect('/?auth=google_off');
  const state = b64u(crypto.randomBytes(16)), ver = b64u(crypto.randomBytes(32));
  res.append('Set-Cookie', `g_oauth=${state}.${ver}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600${SECURE}`);
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: GID, redirect_uri: GREDIR, response_type: 'code', scope: 'openid email profile', state, code_challenge: b64u(crypto.createHash('sha256').update(ver).digest()), code_challenge_method: 'S256', prompt: 'select_account' }));
});
app.get('/api/auth/google/callback', async (req, res) => {
  res.append('Set-Cookie', `g_oauth=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0${SECURE}`);
  try {
    const [state, ver] = (cookies(req).g_oauth || '').split('.');
    if (!state || !ver || state !== req.query.state || !req.query.code) return res.redirect('/?auth=google_fail');
    const t = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ code: String(req.query.code), client_id: GID, client_secret: GSEC, redirect_uri: GREDIR, grant_type: 'authorization_code', code_verifier: ver }) }).then(r => r.json());
    if (!t.access_token) return res.redirect('/?auth=google_fail');
    const g = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: 'Bearer ' + t.access_token }, signal: AbortSignal.timeout(10000) }).then(r => r.json());
    if (!g.sub || !g.email) return res.redirect('/?auth=google_fail');
    if (g.email_verified !== true) return res.redirect('/?auth=google_unverified'); // Google must have verified the address
    const email = String(g.email).toLowerCase();
    let u = one('SELECT * FROM users WHERE google_id=?', g.sub) || one('SELECT * FROM users WHERE email=?', email);
    if (u) {
      if (u.disabled) return res.redirect('/?auth=disabled');
      // An unverified password account on this email was never proven: drop its password so only the Google owner gets in.
      run(`UPDATE users SET google_id=?,email_verified=1,verify_hash=NULL,pass_hash=CASE WHEN email_verified=0 THEN '' ELSE pass_hash END,last_login=? WHERE id=?`, g.sub, now(), u.id);
    } else {
      if (process.env.ALLOW_REGISTER === '0') return res.redirect('/?auth=closed');
      const name = String(g.name || email.split('@')[0]).trim().slice(0, 50).padEnd(2, '_');
      u = { id: run('INSERT INTO users(name,email,pass_hash,google_id,email_verified,is_admin,created_at,last_login) VALUES(?,?,?,?,1,?,?,?)', name, email, '', g.sub, firstUser() ? 1 : 0, now(), now()).lastInsertRowid };
    }
    startSession(res, u.id); res.redirect('/#/dashboard');
  } catch (e) { console.error('[google]', e.message); res.redirect('/?auth=google_fail'); }
});

app.use('/api', auth);

/* ---------- bootstrap ---------- */
const taskOut = (t, who) => ({ id: t.id, projectId: t.project_id, title: t.title, tag: t.tag, prio: t.prio, stage: t.stage, due: t.due, prog: t.prog, who: who.get(t.id) || [], createdAt: t.created_at, completedAt: t.completed_at });
app.get('/api/bootstrap', (req, res) => {
  const who = new Map(); for (const a of all('SELECT task_id,user_id FROM task_assignees')) (who.get(a.task_id) || who.set(a.task_id, []).get(a.task_id)).push(a.user_id);
  const unread = {}; for (const r of all('SELECT from_id,COUNT(*) c FROM messages WHERE to_id=? AND read_at IS NULL GROUP BY from_id', req.user.id)) unread[r.from_id] = r.c;
  res.json({
    me: meUser(req.user), members: all('SELECT * FROM users WHERE disabled=0 AND email_verified=1 ORDER BY id').map(pubUser),
    projects: all('SELECT id,name,due,status,owner_id ownerId,created_at createdAt,completed_at completedAt FROM projects ORDER BY id'),
    tasks: all('SELECT * FROM tasks ORDER BY id').map(t => taskOut(t, who)),
    events: all('SELECT id,title,date,time,type FROM events ORDER BY date,time'),
    notifs: all('SELECT id,text,kind,created_at at,read_at IS NULL unread FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 20', req.user.id),
    unread, tg: { enabled: tg.enabled(), bot: tg.botName() },
  });
});

/* ---------- projects ---------- */
const participants = pid => { const p = one('SELECT owner_id FROM projects WHERE id=?', pid); const set = new Set(all('SELECT DISTINCT a.user_id FROM task_assignees a JOIN tasks t ON t.id=a.task_id WHERE t.project_id=?', pid).map(r => r.user_id)); if (p?.owner_id) set.add(p.owner_id); return [...set]; };
async function finishProject(pid) {
  const p = one('SELECT * FROM projects WHERE id=?', pid); if (!p) return;
  const buf = await buildReport(pid);
  for (const uid of participants(pid)) notify(uid, 'report', `Project "${p.name}" selesai. Laporan PDF siap diunduh.`, { doc: { buf, name: `laporan-${slug(p.name)}.pdf` } });
}
app.post('/api/projects', (req, res) => {
  const b = req.body || {}, name = s(b.name, 60), due = D(b.due), st = en(b.status || 'pending', STATUS);
  const r = run('INSERT INTO projects(name,due,status,owner_id,created_at,completed_at) VALUES(?,?,?,?,?,?)', name, due, st, req.user.id, now(), st === 'ended' ? now() : null);
  activity(req.user.id, r.lastInsertRowid, `${req.user.name} membuat project "${name}"`);
  res.status(201).json({ id: r.lastInsertRowid });
});
app.post('/api/projects/import', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 200) : []; let n = 0;
  tx(() => { for (const r of rows) { try { run('INSERT INTO projects(name,due,status,owner_id,created_at) VALUES(?,?,?,?,?)', s(r.name, 60), D(r.due), en(r.status === 'ended' ? 'pending' : (r.status || 'pending'), STATUS), req.user.id, now()); n++; } catch { /* skip invalid row */ } } });
  res.json({ imported: n });
});
app.patch('/api/projects/:id', (req, res) => {
  const p = one('SELECT * FROM projects WHERE id=?', int(req.params.id)); if (!p) throw E(404, 'Project tidak ditemukan');
  if (p.owner_id !== req.user.id) throw E(403, 'Hanya owner project yang boleh mengubahnya');
  const b = req.body || {}, name = 'name' in b ? s(b.name, 60) : p.name, due = 'due' in b ? D(b.due) : p.due, st = 'status' in b ? en(b.status, STATUS) : p.status;
  const finishing = st === 'ended' && p.status !== 'ended';
  run('UPDATE projects SET name=?,due=?,status=?,completed_at=? WHERE id=?', name, due, st, st === 'ended' ? (p.completed_at || now()) : null, p.id);
  if (st !== p.status) activity(req.user.id, p.id, `${req.user.name} mengubah status project menjadi ${st}`);
  res.json({ ok: true, report: finishing });
  if (finishing) finishProject(p.id).catch(e => console.error('[report]', e.message));
});
app.delete('/api/projects/:id', (req, res) => {
  const p = one('SELECT * FROM projects WHERE id=?', int(req.params.id)); if (!p) throw E(404, 'Project tidak ditemukan');
  if (p.owner_id !== req.user.id && !req.user.is_admin) throw E(403, 'Hanya owner project yang boleh menghapusnya');
  run('DELETE FROM projects WHERE id=?', p.id); res.json({ ok: true });
});
app.get('/api/projects/:id/report', async (req, res) => {
  const p = one('SELECT * FROM projects WHERE id=?', int(req.params.id)); if (!p) throw E(404, 'Project tidak ditemukan');
  if (p.status !== 'ended') throw E(409, 'Laporan hanya tersedia untuk project yang sudah selesai');
  const buf = await buildReport(p.id);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="laporan-${slug(p.name)}.pdf"`, 'Content-Length': buf.length }).end(buf);
});

/* ---------- tasks ---------- */
function setWho(tid, ids, actor) {
  const want = [...new Set((Array.isArray(ids) ? ids : []).map(int))].filter(id => one('SELECT id FROM users WHERE id=?', id));
  const had = new Set(all('SELECT user_id FROM task_assignees WHERE task_id=?', tid).map(r => r.user_id));
  run('DELETE FROM task_assignees WHERE task_id=?', tid);
  for (const id of want) run('INSERT INTO task_assignees(task_id,user_id) VALUES(?,?)', tid, id);
  const t = one('SELECT title FROM tasks WHERE id=?', tid);
  for (const id of want) if (!had.has(id) && id !== actor.id) notify(id, 'assign', `${actor.name} menugaskan kamu ke task "${t.title}".`);
}
const projId = v => { if (v == null || v === '') return null; const id = int(v); if (!one('SELECT id FROM projects WHERE id=?', id)) throw E(400, 'Project tidak ditemukan'); return id; };
app.post('/api/tasks', (req, res) => {
  const b = req.body || {}, title = s(b.title, 80), pid = projId(b.projectId);
  const id = tx(() => {
    const r = run('INSERT INTO tasks(project_id,title,tag,prio,stage,due,prog,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)', pid, title, en(b.tag || 'Frontend', TAGS), en(b.prio || 'Medium', PRIO), 'todo', D(b.due), 0, req.user.id, now());
    setWho(r.lastInsertRowid, b.who, req.user); return r.lastInsertRowid;
  });
  activity(req.user.id, pid, `${req.user.name} membuat task "${title}"`);
  res.status(201).json({ id });
});
app.patch('/api/tasks/:id', (req, res) => {
  const t = one('SELECT * FROM tasks WHERE id=?', int(req.params.id)); if (!t) throw E(404, 'Task tidak ditemukan');
  const b = req.body || {}, f = {};
  if ('title' in b) f.title = s(b.title, 80);
  if ('tag' in b) f.tag = en(b.tag, TAGS);
  if ('prio' in b) f.prio = en(b.prio, PRIO);
  if ('due' in b) f.due = D(b.due);
  if ('projectId' in b) f.project_id = projId(b.projectId);
  if ('stage' in b) { f.stage = en(b.stage, STAGES); if (f.stage !== t.stage) { f.prog = { todo: 0, progress: 50, review: 90, done: 100 }[f.stage]; f.completed_at = f.stage === 'done' ? now() : null; } }
  tx(() => {
    const k = Object.keys(f); if (k.length) run(`UPDATE tasks SET ${k.map(x => x + '=?').join(',')} WHERE id=?`, ...k.map(x => f[x]), t.id);
    if ('who' in b) setWho(t.id, b.who, req.user);
  });
  if (f.stage && f.stage !== t.stage) activity(req.user.id, t.project_id, `${req.user.name} memindahkan "${t.title}" ke ${STAGE_LABEL[f.stage]}`);
  res.json({ ok: true });
});
app.delete('/api/tasks/:id', (req, res) => { const t = one('SELECT * FROM tasks WHERE id=?', int(req.params.id)); if (!t) throw E(404, 'Task tidak ditemukan'); run('DELETE FROM tasks WHERE id=?', t.id); activity(req.user.id, t.project_id, `${req.user.name} menghapus task "${t.title}"`); res.json({ ok: true }); });

/* ---------- events, time, me ---------- */
app.post('/api/events', (req, res) => {
  const b = req.body || {}; const t = s(b.time, 5, 5); if (!/^\d{2}:\d{2}$/.test(t)) throw E(400, 'Jam tidak valid');
  const r = run('INSERT INTO events(title,date,time,type,created_by) VALUES(?,?,?,?,?)', s(b.title, 60), D(b.date), t, en(b.type, EV), req.user.id); res.status(201).json({ id: r.lastInsertRowid });
});
app.delete('/api/events/:id', (req, res) => { run('DELETE FROM events WHERE id=?', int(req.params.id)); res.json({ ok: true }); });
app.post('/api/time', (req, res) => {
  const sec = Math.round(Number(req.body?.seconds)); if (!(sec >= 1 && sec <= 86400)) throw E(400, 'Durasi tidak valid');
  const pid = projId(req.body?.projectId); run('INSERT INTO time_entries(user_id,project_id,seconds,started_at) VALUES(?,?,?,?)', req.user.id, pid, sec, now() - sec * 1000);
  activity(req.user.id, pid, `${req.user.name} mencatat ${Math.floor(sec / 3600)}j ${Math.floor(sec / 60) % 60}m waktu kerja`); res.status(201).json({ ok: true });
});
app.patch('/api/me', (req, res) => {
  const b = req.body || {}, u = req.user, f = {};
  if ('name' in b) f.name = s(b.name, 50, 2);
  if ('role' in b) f.role = s(b.role, 40, 0) || 'Member';
  if ('division' in b) f.division = en(b.division, DIVS);
  if ('tz' in b) f.tz = s(b.tz, 40);
  if ('bio' in b) f.bio = s(b.bio, 200, 0);
  if ('location' in b) f.location = s(b.location, 40, 0);
  if ('accent' in b) f.accent = en(b.accent, ['ocean', 'forest', 'plum', 'ember']);
  if ('week' in b) f.week = en(+b.week, [0, 1]);
  if ('budget' in b) f.budget = money(b.budget);
  if ('notif' in b) { const cur = JSON.parse(u.notif); for (const k of ['assign', 'due', 'chat', 'report', 'personal']) if (typeof b.notif?.[k] === 'boolean') cur[k] = b.notif[k]; f.notif = JSON.stringify(cur); }
  const k = Object.keys(f); if (k.length) run(`UPDATE users SET ${k.map(x => x + '=?').join(',')} WHERE id=?`, ...k.map(x => f[x]), u.id);
  res.json({ ok: true });
});

app.post('/api/team/invite', async (req, res) => {
  const email = s(req.body?.email || '', 100).toLowerCase();
  if (!EMAIL.test(email)) throw E(400, 'Format email tidak valid');
  const ex = one('SELECT id, name, email_verified FROM users WHERE email=?', email);
  if (ex && ex.email_verified) throw E(409, 'Email ini sudah terdaftar sebagai anggota tim');
  const link = `${APP_URL}/?tab=register&email=${encodeURIComponent(email)}`;
  let sent = false;
  try {
    sent = await mail.sendInvite(email, req.user.name, link);
  } catch (e) {
    console.error('[mail:invite]', e.message);
  }
  activity(req.user.id, null, `${req.user.name} mengirim undangan tim ke ${email}`);
  res.json({ ok: true, sent, link });
});

/* ---------- chat ---------- */
app.get('/api/messages/:uid', (req, res) => {
  const o = int(req.params.uid), me = req.user.id;
  const rows = all('SELECT id,from_id,to_id,body,created_at FROM (SELECT * FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 200) ORDER BY id', me, o, o, me);
  run('UPDATE messages SET read_at=? WHERE to_id=? AND from_id=? AND read_at IS NULL', now(), me, o);
  res.json(rows);
});
app.post('/api/messages', (req, res) => {
  const to = int(req.body?.to), body = s(req.body?.body, 2000);
  if (to === req.user.id || !one('SELECT id FROM users WHERE id=? AND disabled=0', to)) throw E(400, 'Penerima tidak valid');
  if (limited('msg' + req.user.id, 60)) throw E(429, 'Terlalu banyak pesan, tunggu sebentar');
  const r = run('INSERT INTO messages(from_id,to_id,body,created_at) VALUES(?,?,?,?)', req.user.id, to, body, now());
  const m = { id: r.lastInsertRowid, from_id: req.user.id, to_id: to, body, created_at: now() };
  pushUser(to, { type: 'message', message: m }); pushUser(req.user.id, { type: 'message', message: m });
  notify(to, 'chat', `${req.user.name}:${body.slice(0, 300)}`);
  res.status(201).json(m);
});
app.post('/api/notifications/read', (req, res) => { run('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', now(), req.user.id); res.json({ ok: true }); });

/* ---------- telegram ---------- */
app.post('/api/telegram/link', (req, res) => {
  if (!tg.enabled() || !tg.botName()) throw E(400, 'Bot Telegram belum dikonfigurasi di server');
  const code = crypto.randomBytes(5).toString('hex'); run('UPDATE users SET tg_code=?,tg_code_exp=? WHERE id=?', code, now() + 15 * 6e4, req.user.id);
  res.json({ url: `https://t.me/${tg.botName()}?start=${code}`, bot: tg.botName() });
});
app.post('/api/telegram/unlink', (req, res) => { run('UPDATE users SET tg_chat_id=NULL,tg_code=NULL WHERE id=?', req.user.id); res.json({ ok: true }); });
app.post('/api/telegram/test', async (req, res) => {
  if (!req.user.tg_chat_id) throw E(400, 'Telegram belum terhubung');
  await tg.sendText(req.user.tg_chat_id, 'Tes notifikasi LUKI MANAGEMENT berhasil. Pengingat deadline dikirim H-7, H-3, H-2 dan H-1.'); res.json({ ok: true });
});

/* ---------- analytics (real data) ---------- */
const lms = d => { const [y, m, x] = d.split('-').map(Number); return new Date(y, m - 1, x).getTime(); };
app.get('/api/analytics', (req, res) => {
  const n = en(+req.query.days || 30, [7, 30, 90]), T = today(), start = addDays(T, -(n - 1)), pstart = addDays(T, -(2 * n - 1));
  const idx = ms => Math.round((lms(dayOf(ms)) - lms(start)) / 864e5);
  const done = all('SELECT due,created_at c,completed_at d FROM tasks WHERE completed_at>=?', lms(pstart)).map(t => ({ i: idx(t.d), late: dayOf(t.d) > t.due, cyc: (t.d - t.c) / 864e5 }));
  const ents = all('SELECT seconds,started_at FROM time_entries WHERE started_at>=?', lms(pstart)).map(e => ({ i: idx(e.started_at), h: e.seconds / 3600 }));
  const cur = Array(n).fill(0), prev = Array(n).fill(0), hrs = Array(n).fill(0);
  for (const t of done) { if (t.i >= 0 && t.i < n) cur[t.i]++; else if (t.i < 0 && t.i >= -n) prev[t.i + n]++; }
  let hp = 0, hc = 0; for (const e of ents) { if (e.i >= 0 && e.i < n) { hrs[e.i] += e.h; hc += e.h; } else if (e.i < 0) hp += e.h; }
  const inW = (a, b) => done.filter(t => t.i >= a && t.i <= b);
  const ot = l => l.length ? Math.round(l.filter(t => !t.late).length / l.length * 100) : 0, cy = l => l.length ? l.reduce((x, t) => x + t.cyc, 0) / l.length : 0;
  const C = inW(0, n - 1), P = inW(-n, -1), r1 = v => Math.round(v * 10) / 10;
  const series = { tasks: cur, hours: hrs.map(r1), ontime: cur.map((_, i) => ot(inW(i - 6, i))), cycle: cur.map((_, i) => r1(cy(inW(i - 6, i)))) };
  const hs = lms(addDays(T, -139)), heat = Array(140).fill(0);
  for (const a of all('SELECT created_at FROM activity WHERE created_at>=?', hs)) { const i = Math.round((lms(dayOf(a.created_at)) - hs) / 864e5); if (i >= 0 && i < 140) heat[i]++; }
  const byProject = all('SELECT p.name name,SUM(e.seconds)/3600.0 h FROM time_entries e LEFT JOIN projects p ON p.id=e.project_id WHERE e.started_at>=? GROUP BY e.project_id ORDER BY h DESC LIMIT 5', lms(start)).map(r => ({ name: r.name || 'No project', h: r1(r.h) }));
  const top = all('SELECT u.id,u.name,COUNT(*) c FROM tasks t JOIN task_assignees a ON a.task_id=t.id JOIN users u ON u.id=a.user_id WHERE t.completed_at>=? GROUP BY u.id ORDER BY c DESC LIMIT 4', lms(start));
  res.json({ n, cur, prev, series, heat, byProject, top,
    kpi: { tasks: [cur.reduce((a, b) => a + b, 0), prev.reduce((a, b) => a + b, 0)], hours: [Math.round(hc), Math.round(hp)], ontime: [ot(C), ot(P)], cycle: [r1(cy(C)), r1(cy(P))] } });
});

/* ---------- realtime stream ---------- */
app.get('/api/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.flushHeaders();
  const id = req.user.id, first = !clients.has(id); (clients.get(id) || clients.set(id, new Set()).get(id)).add(res);
  res.write(': ok\n\n'); if (first) broadcast({ type: 'presence', id, on: true });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const set = clients.get(id); set?.delete(res); if (set && !set.size) { clients.delete(id); broadcast({ type: 'presence', id, on: false }); } });
});

require('./personal')(app);
require('./admin')(app);

app.use('/api', (req, res, next) => next(E(404, 'Endpoint tidak ditemukan')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((err, req, res, next) => {
  const code = Number.isInteger(err.code) ? err.code : err.type === 'entity.parse.failed' ? 400 : 500;
  if (code === 500) console.error(err);
  res.status(code).json({ error: code === 500 ? 'Terjadi kesalahan server' : err.message, code: err.tag });
});

app.listen(PORT, HOST, () => {
  console.log(`LUKI MANAGEMENT berjalan di http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  (APP_URL=${APP_URL})`);
  if (!mail.enabled()) console.log('[mail] SMTP belum diatur: link verifikasi akan dicetak di console ini.');
  if (!GID) console.log('[google] GOOGLE_CLIENT_ID kosong: login Google nonaktif.');
  tg.start(); reminders.start();
});
module.exports = { app };
