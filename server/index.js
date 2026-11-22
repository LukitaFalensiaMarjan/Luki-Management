'use strict';
const core = require('./core');
const { all, one, run, tx, now, today, dayOf, addDays, hashPw, verifyPw, clients, online, pushUser, broadcast, notify, activity, genTeamCode } = core;
const express = require('express'), crypto = require('crypto'), path = require('path'), fs = require('fs');
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
app.use(express.json({ limit: '15mb' }));
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
const pubUser = u => ({
  id: u.id, name: u.name, username: u.username || '', avatar: u.avatar || '',
  role: u.team_role || u.role || 'Member', teamRole: u.team_role || (u.is_admin ? 'Ketua Tim' : 'Member'),
  div: u.division, loc: u.location, address: u.address || '', birthPlace: u.birth_place || '',
  birthDate: u.share_birthday ? u.birth_date : null, shareBirthday: !!u.share_birthday,
  on: online(u.id), admin: !!u.is_admin
});
const meUser = u => ({
  ...pubUser(u), email: u.email, bio: u.bio, tz: u.tz, accent: u.accent, week: u.week,
  notif: JSON.parse(u.notif), tg: !!u.tg_chat_id, provider: u.google_id ? 'google' : 'email',
  hasPassword: !!u.pass_hash, budget: u.budget || 0, birthDate: u.birth_date || ''
});

function ensureUserTeam(user, explicitInviteCode = null) {
  const uid = user.id;
  const u = one('SELECT id, name, invite_team_id FROM users WHERE id=?', uid) || user;
  
  // 1. If explicit invite code or invite_team_id
  let targetTeam = null;
  if (explicitInviteCode) {
    targetTeam = one('SELECT * FROM teams WHERE UPPER(code)=?', String(explicitInviteCode).toUpperCase().trim());
  } else if (u.invite_team_id) {
    targetTeam = one('SELECT * FROM teams WHERE id=?', u.invite_team_id);
  }

  if (targetTeam) {
    run("INSERT OR IGNORE INTO team_members(team_id, user_id, role, joined_at) VALUES(?,?, 'Member', ?)", targetTeam.id, uid, now());
    activity(uid, null, `${u.name} bergabung ke tim "${targetTeam.name}" via undangan`);
    run('UPDATE users SET invite_team_id=NULL WHERE id=?', uid);
    return targetTeam;
  }

  // 2. Check if user already belongs to any team
  const existingTeam = one('SELECT team_id FROM team_members WHERE user_id=? LIMIT 1', uid);
  if (existingTeam) return one('SELECT * FROM teams WHERE id=?', existingTeam.team_id);

  // 3. User does not belong to any team
  const tCount = one('SELECT COUNT(*) as c FROM teams').c;
  if (tCount === 0) {
    const code = genTeamCode();
    const r = run("INSERT INTO teams(name, logo, description, code, created_by, created_at) VALUES ('Luki Core Team', 'preset:lion', 'Tim Utama Luki Management', ?, ?, ?)", code, uid, now());
    const tid = r.lastInsertRowid;
    run("INSERT INTO team_members(team_id, user_id, role, joined_at) VALUES(?,?, 'Ketua Tim', ?)", tid, uid, now());
    return one('SELECT * FROM teams WHERE id=?', tid);
  }

  // 4. Create an independent new team for this new user where they are Ketua Tim!
  const teamName = `Tim ${u.name}`;
  const code = genTeamCode();
  const presets = ['preset:lion', 'preset:rocket', 'preset:star', 'preset:bulb', 'preset:fire'];
  const logo = presets[Math.floor(Math.random() * presets.length)];
  const r = run("INSERT INTO teams(name, logo, description, code, created_by, created_at) VALUES(?,?,?,?,?,?)", teamName, logo, `Ruang kerja kolaborasi ${u.name}`, code, uid, now());
  const tid = r.lastInsertRowid;
  run("INSERT INTO team_members(team_id, user_id, role, joined_at) VALUES(?,?, 'Ketua Tim', ?)", tid, uid, now());
  activity(uid, null, `${u.name} membuat tim baru "${teamName}"`);
  return one('SELECT * FROM teams WHERE id=?', tid);
}

app.post('/api/auth/register', async (req, res) => {
  if (process.env.ALLOW_REGISTER === '0') throw E(403, 'Pendaftaran ditutup');
  if (limited('reg' + req.ip)) throw E(429, 'Terlalu banyak percobaan, coba lagi nanti');
  const b = req.body || {}, name = s(b.name, 50, 2), email = s(b.email, 100).toLowerCase(), pw = s(b.password, 100, 8);
  if (!EMAIL.test(email)) throw E(400, 'Email tidak valid');
  const div = s(b.division || 'Engineering & IT', 50, 1);
  let un = (b.username ? s(b.username, 30, 3) : email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_.]/g, '');
  if (!/^[a-z0-9_.]{3,30}$/.test(un)) un = email.split('@')[0].slice(0, 20);
  const ex = one('SELECT * FROM users WHERE email=?', email);
  if (ex && ex.email_verified) {
    if (ex.google_id && !ex.pass_hash) {
      throw E(409, 'Email ini sudah terdaftar melalui akun Google. Anda tidak perlu mendaftar ulang! Silakan login langsung menggunakan tombol "Lanjut dengan Google", atau gunakan "Lupa Kata Sandi" jika ingin membuat password mandiri.');
    }
    throw E(409, 'Email ini sudah terdaftar di LUKI MANAGEMENT. Silakan masuk ke akun Anda melalui tab Login.');
  }
  const exUn = one('SELECT id, email FROM users WHERE username=?', un);
  if (exUn && (!ex || exUn.id !== ex.id)) {
    throw E(409, `Username '@${un}' sudah digunakan oleh pengguna lain. Silakan pilih username yang berbeda.`);
  }
  const inviteCode = b.inviteCode ? s(b.inviteCode, 30, 2).toUpperCase().trim() : null;
  let inviteTeamId = null;
  if (inviteCode) {
    const invT = one('SELECT id FROM teams WHERE UPPER(code)=?', inviteCode);
    if (invT) inviteTeamId = invT.id;
  }
  const hash = await hashPw(pw);
  const isFirst = firstUser();
  const teamRole = isFirst ? 'Ketua Tim' : 'Member';
  // Unverified registration can be re-done: only the inbox owner can ever activate it.
  const id = ex ? (run('UPDATE users SET name=?,username=?,pass_hash=?,role=?,division=?,team_role=?,invite_team_id=? WHERE id=?', name, un, hash, teamRole, div, teamRole, inviteTeamId, ex.id), ex.id)
    : run('INSERT INTO users(name,username,email,pass_hash,role,division,team_role,invite_team_id,created_at,email_verified,is_admin) VALUES(?,?,?,?,?,?,?,?,?,0,?)', name, un, email, hash, teamRole, div, teamRole, inviteTeamId, now(), isFirst ? 1 : 0).lastInsertRowid;
  const sent = await sendVerify({ id, email, name });
  res.status(201).json({ verify: true, email, sent });
});
app.get('/api/auth/verify', (req, res) => {
  const t = String(req.query.token || '');
  const u = t && one('SELECT id,disabled,invite_team_id,name FROM users WHERE verify_hash=? AND verify_exp>?', sha(t), now());
  if (!u) return res.redirect('/?auth=invalid');
  run('UPDATE users SET email_verified=1,verify_hash=NULL,verify_exp=NULL,last_login=? WHERE id=?', now(), u.id);
  ensureUserTeam(u);
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
app.post('/api/auth/forgot-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (limited('forgot' + req.ip, 10)) throw E(429, 'Terlalu banyak permintaan reset kata sandi, coba lagi dalam 10 menit');
  if (!EMAIL.test(email)) throw E(400, 'Format email tidak valid');
  const u = one('SELECT id, name, email, google_id, pass_hash FROM users WHERE email=? AND disabled=0', email);
  if (!u) {
    throw E(404, 'Email belum terdaftar di LUKI MANAGEMENT. Silakan daftar akun baru.');
  }
  const tok = crypto.randomBytes(32).toString('base64url');
  run('UPDATE users SET reset_hash=?, reset_exp=? WHERE id=?', sha(tok), now() + 3600000, u.id);
  const link = `${APP_URL}/?resetToken=${tok}`;
  try {
    await mail.sendReset(u.email, u.name, link);
  } catch (e) {
    console.error('[mail:reset]', e.message);
  }
  const msg = (u.google_id && !u.pass_hash)
    ? 'Tautan pemulihan telah dikirim ke email kamu! Karena akunmu terhubung dengan Google, kamu kini dapat membuat kata sandi mandiri agar bisa login via email.'
    : 'Tautan pemulihan kata sandi telah dikirim ke email kamu! Silakan periksa inbox atau spam (berlaku 1 jam).';
  res.json({ ok: true, message: msg, isGoogle: !!(u.google_id && !u.pass_hash) });
});
app.post('/api/auth/reset-password', async (req, res) => {
  const tok = String(req.body?.token || '').trim();
  const pw = s(req.body?.password || '', 100, 8);
  if (!tok) throw E(400, 'Token reset tidak valid');
  const u = one('SELECT id FROM users WHERE reset_hash=? AND reset_exp>?', sha(tok), now());
  if (!u) throw E(400, 'Tautan reset sudah kedaluwarsa atau tidak valid. Silakan ajukan lupa kata sandi kembali.');
  const hash = await hashPw(pw);
  run('UPDATE users SET pass_hash=?, reset_hash=NULL, reset_exp=NULL WHERE id=?', hash, u.id);
  run('DELETE FROM sessions WHERE user_id=?', u.id);
  res.json({ ok: true, message: 'Kata sandi berhasil diperbarui. Silakan login kembali.' });
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
      let un = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 25);
      if (one('SELECT id FROM users WHERE username=?', un)) un = `${un}${Math.floor(Math.random() * 900 + 100)}`;
      const isFirst = firstUser();
      const teamRole = isFirst ? 'Ketua Tim' : 'Member';
      u = { id: run('INSERT INTO users(name,username,email,pass_hash,google_id,email_verified,is_admin,team_role,role,created_at,last_login) VALUES(?,?,?,?,?,1,?,?,?,?,?)', name, un, email, '', g.sub, isFirst ? 1 : 0, teamRole, teamRole, now(), now()).lastInsertRowid };
      ensureUserTeam(u);
    }
    startSession(res, u.id); res.redirect('/#/dashboard');
  } catch (e) { console.error('[google]', e.message); res.redirect('/?auth=google_fail'); }
});

app.get('/api/auth/dev-session', (req, res) => {
  const tok = String(req.query.sid || 'dev_browser_session_9');
  const u = one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', sha(tok), now());
  if (!u) return res.redirect('/?auth=invalid');
  startSession(res, u.id);
  res.redirect('/#/dashboard');
});

/* ---------- health check (public) ---------- */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), time: now(), database: 'connected' });
});

app.use('/api', auth);

/* ---------- bootstrap ---------- */
const taskOut = (t, who) => ({ id: t.id, projectId: t.project_id, title: t.title, description: t.description || '', tag: t.tag, prio: t.prio, stage: t.stage, due: t.due, prog: t.prog, who: who.get(t.id) || [], createdAt: t.created_at, completedAt: t.completed_at });
app.get('/api/bootstrap', (req, res) => {
  const who = new Map(); for (const a of all('SELECT task_id,user_id FROM task_assignees')) (who.get(a.task_id) || who.set(a.task_id, []).get(a.task_id)).push(a.user_id);
  const unread = {}; for (const r of all("SELECT from_id,COUNT(*) c FROM messages WHERE to_id=? AND read_at IS NULL AND (channel IS NULL OR channel='') GROUP BY from_id", req.user.id)) unread[r.from_id] = r.c;
  
  ensureUserTeam(req.user);

  const teams = all(`
    SELECT t.id, t.name, t.logo, t.description, t.code, t.created_by as createdBy, t.created_at as createdAt,
           tm.role as myRole,
           (SELECT COUNT(*) FROM team_members WHERE team_id=t.id) as memberCount
    FROM teams t
    JOIN team_members tm ON tm.team_id=t.id AND tm.user_id=?
    ORDER BY t.id ASC
  `, req.user.id);

  const myTeamIds = teams.map(t => t.id);
  const members = myTeamIds.length ? all(`
    SELECT DISTINCT u.* FROM users u
    JOIN team_members tm ON tm.user_id=u.id
    WHERE tm.team_id IN (${myTeamIds.map(() => '?').join(',')})
      AND u.disabled=0 AND u.email_verified=1
    ORDER BY u.id
  `, ...myTeamIds).map(pubUser) : [pubUser(req.user)];

  const projects = myTeamIds.length ? all(`
    SELECT id, name, due, status, owner_id as ownerId, created_at as createdAt, completed_at as completedAt, team_id as teamId
    FROM projects
    WHERE team_id IN (${myTeamIds.map(() => '?').join(',')}) OR owner_id=?
    ORDER BY id
  `, ...myTeamIds, req.user.id) : all('SELECT id, name, due, status, owner_id as ownerId, created_at as createdAt, completed_at as completedAt, team_id as teamId FROM projects WHERE owner_id=? ORDER BY id', req.user.id);

  const myProjIds = projects.map(p => p.id);
  const tasks = myProjIds.length ? all(`
    SELECT * FROM tasks
    WHERE project_id IN (${myProjIds.map(() => '?').join(',')}) OR id IN (SELECT task_id FROM task_assignees WHERE user_id=?)
    ORDER BY id
  `, ...myProjIds, req.user.id).map(t => taskOut(t, who)) : all('SELECT * FROM tasks WHERE id IN (SELECT task_id FROM task_assignees WHERE user_id=?) ORDER BY id', req.user.id).map(t => taskOut(t, who));

  res.json({
    me: meUser(req.user), members, projects, tasks,
    events: all('SELECT id,title,date,time,type FROM events ORDER BY date,time'),
    notifs: all('SELECT id,text,kind,created_at at,read_at IS NULL unread FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 20', req.user.id),
    teams, unread, tg: { enabled: tg.enabled(), bot: tg.botName() },
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
  const rawTid = b.team_id !== undefined ? b.team_id : b.teamId;
  let tid = rawTid ? int(rawTid) : null;
  if (tid) {
    const inTeam = one('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', tid, req.user.id);
    if (!inTeam) throw E(403, 'Kamu bukan anggota dari tim ini');
  }
  const r = run('INSERT INTO projects(name,due,status,owner_id,created_at,completed_at,team_id) VALUES(?,?,?,?,?,?,?)', name, due, st, req.user.id, now(), st === 'ended' ? now() : null, tid);
  activity(req.user.id, r.lastInsertRowid, `${req.user.name} membuat project "${name}"`);
  broadcast({ type: 'data' });
  res.status(201).json({ id: r.lastInsertRowid, teamId: tid });
});
app.post('/api/projects/import', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 200) : []; let n = 0;
  tx(() => { for (const r of rows) { try { run('INSERT INTO projects(name,due,status,owner_id,created_at) VALUES(?,?,?,?,?)', s(r.name, 60), D(r.due), en(r.status === 'ended' ? 'pending' : (r.status || 'pending'), STATUS), req.user.id, now()); n++; } catch { /* skip invalid row */ } } });
  broadcast({ type: 'data' });
  res.json({ imported: n });
});
app.patch('/api/projects/:id', (req, res) => {
  const p = one('SELECT * FROM projects WHERE id=?', int(req.params.id)); if (!p) throw E(404, 'Project tidak ditemukan');
  let isLeader = false;
  if (p.team_id) {
    const mem = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', p.team_id, req.user.id);
    if (mem && mem.role === 'Ketua Tim') isLeader = true;
  }
  if (!req.user.is_admin && p.owner_id !== req.user.id && !isLeader) {
    throw E(403, 'Hanya pembuat project atau Ketua Tim yang boleh mengubahnya');
  }
  const b = req.body || {}, name = 'name' in b ? s(b.name, 60) : p.name, due = 'due' in b ? D(b.due) : p.due, st = 'status' in b ? en(b.status, STATUS) : p.status;
  let tid = p.team_id;
  if ('team_id' in b || 'teamId' in b) {
    const rawT = b.team_id !== undefined ? b.team_id : b.teamId;
    tid = rawT ? int(rawT) : null;
    if (tid) {
      const inTeam = one('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', tid, req.user.id);
      if (!inTeam) throw E(403, 'Kamu bukan anggota dari tim tersebut');
    }
  }
  const finishing = st === 'ended' && p.status !== 'ended';
  run('UPDATE projects SET name=?,due=?,status=?,completed_at=?,team_id=? WHERE id=?', name, due, st, st === 'ended' ? (p.completed_at || now()) : null, tid, p.id);
  if (st !== p.status) activity(req.user.id, p.id, `${req.user.name} mengubah status project menjadi ${st}`);
  broadcast({ type: 'data' });
  res.json({ ok: true, report: finishing });
  if (finishing) finishProject(p.id).catch(e => console.error('[report]', e.message));
});
app.delete('/api/projects/:id', (req, res) => {
  const p = one('SELECT * FROM projects WHERE id=?', int(req.params.id)); if (!p) throw E(404, 'Project tidak ditemukan');
  let isLeader = false;
  if (p.team_id) {
    const mem = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', p.team_id, req.user.id);
    if (mem && mem.role === 'Ketua Tim') isLeader = true;
  }
  if (!req.user.is_admin && p.owner_id !== req.user.id && !isLeader) {
    throw E(403, 'Hanya pembuat project atau Ketua Tim yang boleh menghapusnya');
  }
  tx(() => {
    run('DELETE FROM task_assignees WHERE task_id IN (SELECT id FROM tasks WHERE project_id=?)', p.id);
    run('DELETE FROM tasks WHERE project_id=?', p.id);
    run('DELETE FROM projects WHERE id=?', p.id);
  });
  activity(req.user.id, null, `${req.user.name} menghapus project "${p.name}"`);
  broadcast({ type: 'data' });
  res.json({ ok: true });
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
  const desc = s(b.description || '', 2000, 0);
  const tag = s(b.tag || 'General', 30, 1);
  const id = tx(() => {
    const r = run('INSERT INTO tasks(project_id,title,description,tag,prio,stage,due,prog,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', pid, title, desc, tag, en(b.prio || 'Medium', PRIO), 'todo', D(b.due), 0, req.user.id, now());
    setWho(r.lastInsertRowid, b.who, req.user); return r.lastInsertRowid;
  });
  activity(req.user.id, pid, `${req.user.name} membuat task "${title}"`);
  res.status(201).json({ id });
});
app.patch('/api/tasks/:id', (req, res) => {
  const t = one('SELECT * FROM tasks WHERE id=?', int(req.params.id)); if (!t) throw E(404, 'Task tidak ditemukan');
  const b = req.body || {}, f = {};
  if ('title' in b) f.title = s(b.title, 80);
  if ('description' in b) f.description = s(b.description, 2000, 0);
  if ('tag' in b) f.tag = s(b.tag || 'General', 30, 1);
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

/* ---------- task details: subtasks & comments ---------- */
app.get('/api/tasks/:id/details', (req, res) => {
  const tid = int(req.params.id);
  const t = one('SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=?', tid);
  if (!t) throw E(404, 'Task tidak ditemukan');
  const assignees = all('SELECT u.id, u.name, u.username, u.avatar, u.division, u.team_role FROM task_assignees ta JOIN users u ON u.id=ta.user_id WHERE ta.task_id=?', tid);
  const checklists = all('SELECT id, title, done, created_at FROM task_checklists WHERE task_id=? ORDER BY id ASC', tid);
  const comments = all(`
    SELECT tc.id, tc.user_id as userId, u.name as userName, u.username as userUsername, u.avatar as userAvatar, tc.content, tc.created_at as createdAt
    FROM task_comments tc
    JOIN users u ON u.id=tc.user_id
    WHERE tc.task_id=?
    ORDER BY tc.id ASC
  `, tid);
  res.json({
    task: {
      id: t.id,
      projectId: t.project_id,
      projectName: t.project_name || '',
      title: t.title,
      description: t.description || '',
      tag: t.tag,
      prio: t.prio,
      stage: t.stage,
      due: t.due,
      prog: t.prog,
      assignees,
      createdAt: t.created_at,
      completedAt: t.completed_at
    },
    checklists,
    comments
  });
});

app.post('/api/tasks/:id/checklists', (req, res) => {
  const tid = int(req.params.id);
  const t = one('SELECT id FROM tasks WHERE id=?', tid);
  if (!t) throw E(404, 'Task tidak ditemukan');
  const title = s(req.body?.title, 120);
  const r = run('INSERT INTO task_checklists(task_id, title, done, created_at) VALUES(?,?,0,?)', tid, title, now());
  res.status(201).json({ id: r.lastInsertRowid, title, done: 0 });
});

app.patch('/api/checklists/:id', (req, res) => {
  const cid = int(req.params.id);
  const c = one('SELECT * FROM task_checklists WHERE id=?', cid);
  if (!c) throw E(404, 'Checklist tidak ditemukan');
  const b = req.body || {}, f = {};
  if ('done' in b) f.done = b.done ? 1 : 0;
  if ('title' in b) f.title = s(b.title, 120);
  const k = Object.keys(f);
  if (k.length) run(`UPDATE task_checklists SET ${k.map(x => x + '=?').join(',')} WHERE id=?`, ...k.map(x => f[x]), cid);
  res.json({ ok: true, done: f.done ?? c.done });
});

app.delete('/api/checklists/:id', (req, res) => {
  const cid = int(req.params.id);
  run('DELETE FROM task_checklists WHERE id=?', cid);
  res.json({ ok: true });
});

app.post('/api/tasks/:id/comments', (req, res) => {
  const tid = int(req.params.id);
  const t = one('SELECT id, project_id, title FROM tasks WHERE id=?', tid);
  if (!t) throw E(404, 'Task tidak ditemukan');
  const content = s(req.body?.content, 1000);
  const r = run('INSERT INTO task_comments(task_id, user_id, content, created_at) VALUES(?,?,?,?)', tid, req.user.id, content, now());
  const newC = {
    id: r.lastInsertRowid,
    userId: req.user.id,
    userName: req.user.name,
    userUsername: req.user.username || '',
    userAvatar: req.user.avatar || '',
    content,
    createdAt: now()
  };
  const assignees = all('SELECT user_id FROM task_assignees WHERE task_id=? AND user_id!=?', tid, req.user.id);
  for (const a of assignees) notify(a.user_id, 'chat', `${req.user.name} mengomentari task "${t.title}": ${content.slice(0, 80)}`);
  broadcast({ type: 'task_comment', taskId: tid, comment: newC });
  res.status(201).json(newC);
});

app.delete('/api/comments/:id', (req, res) => {
  const cid = int(req.params.id);
  const c = one('SELECT * FROM task_comments WHERE id=?', cid);
  if (!c) throw E(404, 'Komentar tidak ditemukan');
  if (c.user_id !== req.user.id && !req.user.is_admin) throw E(403, 'Tidak dapat menghapus komentar ini');
  run('DELETE FROM task_comments WHERE id=?', cid);
  res.json({ ok: true });
});

/* ---------- events, time, me ---------- */
app.post('/api/events', (req, res) => {
  const b = req.body || {}; const t = s(b.time, 5, 5); if (!/^\d{2}:\d{2}$/.test(t)) throw E(400, 'Jam tidak valid');
  const r = run('INSERT INTO events(title,date,time,type,created_by) VALUES(?,?,?,?,?)', s(b.title, 60), D(b.date), t, en(b.type, EV), req.user.id); res.status(201).json({ id: r.lastInsertRowid });
});
app.patch('/api/events/:id', (req, res) => {
  const ev = one('SELECT * FROM events WHERE id=?', int(req.params.id));
  if (!ev) throw E(404, 'Event tidak ditemukan');
  const b = req.body || {}, f = {};
  if ('title' in b) f.title = s(b.title, 60);
  if ('date' in b) f.date = D(b.date);
  if ('time' in b) {
    const t = s(b.time, 5, 5);
    if (!/^\d{2}:\d{2}$/.test(t)) throw E(400, 'Jam tidak valid');
    f.time = t;
  }
  if ('type' in b) f.type = en(b.type, EV);
  const k = Object.keys(f);
  if (k.length) run(`UPDATE events SET ${k.map(x => x + '=?').join(',')} WHERE id=?`, ...k.map(x => f[x]), ev.id);
  res.json({ ok: true });
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
  if ('username' in b) {
    const un = s(b.username, 30, 3).toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(un)) throw E(400, 'Username hanya boleh huruf kecil, angka, titik, atau garis bawah (3-30 karakter)');
    const ex = one('SELECT id FROM users WHERE username=? AND id!=?', un, u.id);
    if (ex) throw E(409, 'Username sudah digunakan, silakan pilih yang lain');
    f.username = un;
  }
  if ('avatar' in b) f.avatar = typeof b.avatar === 'string' ? b.avatar.slice(0, 500000) : '';
  if ('division' in b) f.division = s(b.division, 50, 1);
  if ('tz' in b) f.tz = s(b.tz, 40);
  if ('bio' in b) f.bio = s(b.bio, 200, 0);
  if ('location' in b) f.location = s(b.location, 40, 0);
  if ('address' in b) f.address = s(b.address, 150, 0);
  if ('birthPlace' in b) f.birth_place = s(b.birthPlace, 50, 0);
  if ('birthDate' in b) f.birth_date = b.birthDate ? D(b.birthDate) : null;
  if ('shareBirthday' in b) f.share_birthday = b.shareBirthday ? 1 : 0;
  if ('accent' in b) f.accent = en(b.accent, [
    'ocean', 'navy', 'slate-blue', 'sky',
    'soft-yellow', 'sunshine',
    'forest', 'sage', 'olive',
    'plum', 'lavender', 'rose',
    'ember', 'terracotta', 'mocha', 'ink'
  ]);
  if ('week' in b) f.week = en(+b.week, [0, 1]);
  if ('budget' in b) f.budget = money(b.budget);
  if ('notif' in b) { const cur = JSON.parse(u.notif); for (const k of ['assign', 'due', 'chat', 'report', 'personal']) if (typeof b.notif?.[k] === 'boolean') cur[k] = b.notif[k]; f.notif = JSON.stringify(cur); }
  const k = Object.keys(f); if (k.length) run(`UPDATE users SET ${k.map(x => x + '=?').join(',')} WHERE id=?`, ...k.map(x => f[x]), u.id);
  res.json({ ok: true });
});

app.post('/api/me/password', async (req, res) => {
  const b = req.body || {}, u = req.user;
  const newPw = s(b.newPassword || '', 100, 8);
  if (u.pass_hash) {
    const oldPw = String(b.oldPassword || '');
    if (!oldPw || !(await verifyPw(oldPw, u.pass_hash))) throw E(401, 'Kata sandi saat ini tidak sesuai');
  }
  const hash = await hashPw(newPw);
  run('UPDATE users SET pass_hash=? WHERE id=?', hash, u.id);
  res.json({ ok: true });
});

/* ---------- teams (multi-team & per-team RBAC) ---------- */
app.get('/api/teams', (req, res) => {
  const teams = all(`
    SELECT t.id, t.name, t.logo, t.description, t.created_by as createdBy, t.created_at as createdAt,
           COALESCE(tm.role, 'Viewer') as myRole,
           (SELECT COUNT(*) FROM team_members WHERE team_id=t.id) as memberCount
    FROM teams t
    JOIN team_members tm ON tm.team_id=t.id AND tm.user_id=?
    ORDER BY t.id ASC
  `, req.user.id);
  res.json(teams);
});

app.post('/api/teams', (req, res) => {
  const b = req.body || {};
  const name = s(b.name, 60, 2);
  const logo = typeof b.logo === 'string' && b.logo ? b.logo.slice(0, 500000) : 'preset:rocket';
  const description = s(b.description || '', 200, 0);
  const code = genTeamCode();
  const id = tx(() => {
    const r = run('INSERT INTO teams(name, logo, description, code, created_by, created_at) VALUES(?,?,?,?,?,?)', name, logo, description, code, req.user.id, now());
    const tid = r.lastInsertRowid;
    run("INSERT INTO team_members(team_id, user_id, role, joined_at) VALUES(?,?, 'Ketua Tim', ?)", tid, req.user.id, now());
    return tid;
  });
  activity(req.user.id, null, `${req.user.name} membuat tim baru "${name}"`);
  broadcast({ type: 'data' });
  res.status(201).json({ id, name, logo, description, code, myRole: 'Ketua Tim', memberCount: 1 });
});

app.post('/api/teams/join', (req, res) => {
  const rawCode = s(req.body?.code || '', 30, 2).toUpperCase().trim();
  const team = one('SELECT * FROM teams WHERE UPPER(code)=?', rawCode);
  if (!team) throw E(404, 'Kode tim tidak ditemukan. Pastikan kode unik yang kamu masukkan sudah benar.');
  const existing = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', team.id, req.user.id);
  if (existing) {
    return res.json({ ok: true, teamId: team.id, teamName: team.name, role: existing.role, alreadyMember: true, message: `Kamu sudah menjadi anggota di tim "${team.name}"` });
  }
  run("INSERT INTO team_members(team_id, user_id, role, joined_at) VALUES(?,?, 'Member', ?)", team.id, req.user.id, now());
  activity(req.user.id, null, `${req.user.name} bergabung ke tim "${team.name}" via kode unik`);
  broadcast({ type: 'data' });
  res.status(201).json({ ok: true, teamId: team.id, teamName: team.name, role: 'Member', message: `Berhasil bergabung ke tim "${team.name}"!` });
});

app.get('/api/teams/info-by-code', (req, res) => {
  const rawCode = s(req.query?.code || '', 30, 2).toUpperCase().trim();
  const team = one(`
    SELECT t.id, t.name, t.logo, t.description, t.code,
           (SELECT COUNT(*) FROM team_members WHERE team_id=t.id) as memberCount,
           u.name as creatorName
    FROM teams t
    LEFT JOIN users u ON u.id=t.created_by
    WHERE UPPER(t.code)=?
  `, rawCode);
  if (!team) throw E(404, 'Tim dengan kode ini tidak ditemukan');
  res.json(team);
});

app.patch('/api/teams/:id', (req, res) => {
  const tid = int(req.params.id);
  const t = one('SELECT * FROM teams WHERE id=?', tid);
  if (!t) throw E(404, 'Tim tidak ditemukan');
  const myMem = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', tid, req.user.id);
  if (!req.user.is_admin && (!myMem || myMem.role !== 'Ketua Tim')) throw E(403, 'Hanya Ketua Tim atau Admin yang dapat mengubah profil tim ini');
  const b = req.body || {}, f = {};
  if ('name' in b) f.name = s(b.name, 60, 2);
  if ('logo' in b) f.logo = typeof b.logo === 'string' && b.logo ? b.logo.slice(0, 500000) : t.logo;
  if ('description' in b) f.description = s(b.description, 200, 0);
  const k = Object.keys(f);
  if (k.length) run(`UPDATE teams SET ${k.map(x => x + '=?').join(',')} WHERE id=?`, ...k.map(x => f[x]), tid);
  broadcast({ type: 'data' });
  res.json({ ok: true });
});

app.delete('/api/teams/:id', (req, res) => {
  const tid = int(req.params.id);
  const t = one('SELECT * FROM teams WHERE id=?', tid);
  if (!t) throw E(404, 'Tim tidak ditemukan');
  const totalTeams = one('SELECT COUNT(*) as c FROM teams').c;
  if (totalTeams <= 1) throw E(400, 'Tidak dapat menghapus tim terakhir. Workspace harus memiliki minimal 1 tim.');
  const myMem = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', tid, req.user.id);
  if (!req.user.is_admin && (!myMem || myMem.role !== 'Ketua Tim')) throw E(403, 'Hanya Ketua Tim atau Admin yang dapat menghapus tim');
  run('DELETE FROM teams WHERE id=?', tid);
  broadcast({ type: 'data' });
  res.json({ ok: true });
});

app.get('/api/teams/:id/members', (req, res) => {
  const tid = int(req.params.id);
  const team = one('SELECT * FROM teams WHERE id=?', tid);
  if (!team) throw E(404, 'Tim tidak ditemukan');
  const myMem = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', tid, req.user.id);
  const members = all(`
    SELECT u.id, u.name, u.username, u.email, u.avatar, u.division as div, u.location as loc,
           u.address, u.birth_place, u.birth_date, u.share_birthday, u.is_admin,
           tm.role, tm.joined_at,
           (SELECT COUNT(*) FROM tasks t JOIN task_assignees a ON a.task_id=t.id WHERE a.user_id=u.id AND t.stage!='done') as openTasks,
           (SELECT COUNT(*) FROM tasks t JOIN task_assignees a ON a.task_id=t.id WHERE a.user_id=u.id AND t.stage='done') as doneTasks
    FROM team_members tm
    JOIN users u ON u.id=tm.user_id
    WHERE tm.team_id=? AND u.disabled=0
    ORDER BY CASE tm.role WHEN 'Ketua Tim' THEN 1 WHEN 'Project Manager' THEN 2 WHEN 'Member' THEN 3 ELSE 4 END, tm.joined_at ASC
  `, tid).map(m => ({
    id: m.id, name: m.name, username: m.username || '', avatar: m.avatar || '', email: m.email,
    div: m.div, loc: m.loc, address: m.address || '', birthPlace: m.birth_place || '',
    birthDate: m.share_birthday ? m.birth_date : null, shareBirthday: !!m.share_birthday,
    role: m.role, on: online(m.id), admin: !!m.is_admin,
    openTasks: m.openTasks || 0, doneTasks: m.doneTasks || 0
  }));
  res.json({ team, myRole: myMem ? myMem.role : (req.user.is_admin ? 'Ketua Tim' : 'Viewer'), members });
});

app.post('/api/teams/:id/members', (req, res) => {
  const tid = int(req.params.id);
  const myMem = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', tid, req.user.id);
  if (!req.user.is_admin && (!myMem || myMem.role !== 'Ketua Tim')) throw E(403, 'Hanya Ketua Tim atau Admin yang dapat menambahkan anggota ke tim ini');
  const userId = int(req.body?.userId);
  const target = one('SELECT * FROM users WHERE id=?', userId);
  if (!target) throw E(404, 'Pengguna tidak ditemukan');
  const role = en(req.body?.role || 'Member', ['Ketua Tim', 'Project Manager', 'Member', 'Viewer']);
  run('INSERT OR REPLACE INTO team_members(team_id, user_id, role, joined_at) VALUES(?,?,?,?)', tid, target.id, role, now());
  broadcast({ type: 'data' });
  res.status(201).json({ ok: true, role });
});

app.patch('/api/teams/:id/members/:userId/role', (req, res) => {
  const tid = int(req.params.id);
  const myMem = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', tid, req.user.id);
  if (!myMem || myMem.role !== 'Ketua Tim') throw E(403, 'Hanya Ketua Tim yang dapat menetapkan role anggota pada tim ini');
  const targetId = int(req.params.userId);
  const target = one('SELECT * FROM users WHERE id=?', targetId);
  if (!target) throw E(404, 'Anggota tim tidak ditemukan');
  const role = en(req.body?.role, ['Ketua Tim', 'Project Manager', 'Member', 'Viewer']);
  if (targetId === req.user.id && role !== 'Ketua Tim') {
    const kc = one("SELECT COUNT(*) as c FROM team_members WHERE team_id=? AND role='Ketua Tim'", tid).c;
    if (kc <= 1) throw E(400, 'Kamu adalah satu-satunya Ketua Tim. Tunjuk anggota lain sebagai Ketua Tim terlebih dahulu sebelum melepas peran ini.');
  }
  run('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?', role, tid, target.id);
  activity(req.user.id, null, `${req.user.name} menetapkan peran ${target.name} sebagai ${role} di tim`);
  broadcast({ type: 'data' });
  res.json({ ok: true, role });
});

app.delete('/api/teams/:id/members/:userId', (req, res) => {
  const tid = int(req.params.id);
  const targetId = int(req.params.userId);
  const myMem = one('SELECT role FROM team_members WHERE team_id=? AND user_id=?', tid, req.user.id);
  const isSelf = targetId === req.user.id;
  if (!isSelf && (!myMem || myMem.role !== 'Ketua Tim')) {
    throw E(403, 'Hanya Ketua Tim yang dapat mengeluarkan anggota dari tim ini');
  }
  if (myMem?.role === 'Ketua Tim' && targetId === req.user.id) {
    const kc = one("SELECT COUNT(*) as c FROM team_members WHERE team_id=? AND role='Ketua Tim'", tid).c;
    if (kc <= 1) throw E(400, 'Kamu adalah satu-satunya Ketua Tim. Tunjuk Ketua Tim lain sebelum keluar.');
  }
  run('DELETE FROM team_members WHERE team_id=? AND user_id=?', tid, targetId);
  broadcast({ type: 'data' });
  res.json({ ok: true });
});

app.patch('/api/team/members/:id/role', (req, res) => {
  const isLead = req.user.is_admin || req.user.team_role === 'Ketua Tim';
  if (!isLead) throw E(403, 'Hanya Ketua Tim atau Admin yang dapat menetapkan role anggota');
  const targetId = int(req.params.id);
  const target = one('SELECT * FROM users WHERE id=?', targetId);
  if (!target) throw E(404, 'Anggota tim tidak ditemukan');
  const role = en(req.body?.role, ['Ketua Tim', 'Project Manager', 'Member', 'Viewer']);
  const makeAdmin = role === 'Ketua Tim' ? 1 : (target.is_admin && role !== 'Ketua Tim' && targetId !== req.user.id ? 0 : target.is_admin);
  run('UPDATE users SET team_role=?, role=?, is_admin=? WHERE id=?', role, role, makeAdmin, target.id);
  // Also update default team
  const defTeam = one('SELECT id FROM teams ORDER BY id ASC LIMIT 1');
  if (defTeam) run('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?', role, defTeam.id, target.id);
  activity(req.user.id, null, `${req.user.name} menetapkan peran ${target.name} sebagai ${role}`);
  broadcast({ type: 'data' });
  res.json({ ok: true, role });
});

app.post('/api/team/invite', async (req, res) => {
  const tid = req.body?.teamId ? int(req.body.teamId) : null;
  const myTeams = all('SELECT team_id FROM team_members WHERE user_id=?', req.user.id).map(r => r.team_id);
  const team = tid && myTeams.includes(tid) ? one('SELECT * FROM teams WHERE id=?', tid) : (myTeams.length ? one('SELECT * FROM teams WHERE id=?', myTeams[0]) : null);
  if (!team) throw E(404, 'Tim tidak ditemukan');
  
  const link = `${APP_URL}/#join=${team.code}`;
  const teamName = team.name;
  let sent = false;
  const email = req.body?.email ? s(req.body.email, 100).toLowerCase().trim() : '';
  if (email) {
    if (!EMAIL.test(email)) throw E(400, 'Format email tidak valid');
    try {
      sent = await mail.sendInvite(email, req.user.name, link, teamName);
    } catch (e) {
      console.error('[mail:invite]', e.message);
    }
    const ex = one('SELECT id FROM users WHERE email=?', email);
    if (ex) {
      run("INSERT OR IGNORE INTO team_members(team_id, user_id, role, joined_at) VALUES(?,?, 'Member', ?)", team.id, ex.id, now());
    }
    activity(req.user.id, null, `${req.user.name} mengundang ${email} ke tim "${teamName}"`);
  }
  res.json({ ok: true, sent, link, code: team.code, teamName });
});

/* ---------- chat ---------- */
function checkChannelAccess(user, ch) {
  if (user.is_admin) return true;
  if (ch.startsWith('team:')) {
    const tid = int(ch.split(':')[1]);
    return !!one('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', tid, user.id);
  }
  if (ch.startsWith('project:')) {
    const pid = int(ch.split(':')[1]);
    const p = one('SELECT team_id, owner_id FROM projects WHERE id=?', pid);
    if (!p) return false;
    if (p.owner_id === user.id) return true;
    if (p.team_id) {
      return !!one('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', p.team_id, user.id);
    }
    return false;
  }
  return false;
}

function channelParticipants(ch) {
  if (ch.startsWith('team:')) {
    const tid = int(ch.split(':')[1]);
    return all('SELECT user_id FROM team_members WHERE team_id=?', tid).map(r => r.user_id);
  }
  if (ch.startsWith('project:')) {
    const pid = int(ch.split(':')[1]);
    const p = one('SELECT team_id, owner_id FROM projects WHERE id=?', pid);
    const set = new Set();
    if (p?.owner_id) set.add(p.owner_id);
    if (p?.team_id) {
      for (const r of all('SELECT user_id FROM team_members WHERE team_id=?', p.team_id)) set.add(r.user_id);
    }
    return [...set];
  }
  return [];
}

app.get('/api/messages/channel/:channel', (req, res) => {
  const ch = String(req.params.channel || '');
  if (!checkChannelAccess(req.user, ch)) throw E(403, 'Kamu tidak memiliki akses ke channel ini');
  const rows = all(`
    SELECT m.id, m.from_id, m.channel, m.body, m.created_at, m.reply_to_id,
           u.name as from_name, u.avatar as from_avatar, u.username as from_username,
           rm.body as reply_body, ru.name as reply_name
    FROM messages m
    JOIN users u ON u.id=m.from_id
    LEFT JOIN messages rm ON rm.id=m.reply_to_id
    LEFT JOIN users ru ON ru.id=rm.from_id
    WHERE m.channel=?
    ORDER BY m.id ASC
    LIMIT 200
  `, ch);
  res.json(rows);
});

app.post('/api/messages/channel/:channel', (req, res) => {
  const ch = String(req.params.channel || '');
  if (!checkChannelAccess(req.user, ch)) throw E(403, 'Kamu tidak memiliki akses ke channel ini');
  const body = s(req.body?.body, 2000);
  const replyToId = req.body?.replyToId ? int(req.body.replyToId) : null;
  if (limited('msg' + req.user.id, 60)) throw E(429, 'Terlalu banyak pesan, tunggu sebentar');

  let replyMeta = null;
  if (replyToId) {
    replyMeta = one(`
      SELECT m.body, u.name
      FROM messages m
      JOIN users u ON u.id=m.from_id
      WHERE m.id=? AND m.channel=?
    `, replyToId, ch);
  }

  const r = run('INSERT INTO messages(from_id,to_id,channel,body,created_at,reply_to_id) VALUES(?,?,?,?,?,?)', req.user.id, req.user.id, ch, body, now(), replyMeta ? replyToId : null);
  const m = {
    id: r.lastInsertRowid,
    from_id: req.user.id,
    channel: ch,
    body,
    created_at: now(),
    from_name: req.user.name,
    from_avatar: req.user.avatar,
    from_username: req.user.username,
    reply_to_id: replyMeta ? replyToId : null,
    reply_name: replyMeta ? replyMeta.name : null,
    reply_body: replyMeta ? replyMeta.body : null
  };
  const members = channelParticipants(ch);
  for (const uid of members) {
    pushUser(uid, { type: 'channel_message', channel: ch, message: m });
  }
  res.status(201).json(m);
});

app.get('/api/messages/:uid', (req, res) => {
  const o = int(req.params.uid), me = req.user.id;
  const rows = all(`
    SELECT m.id, m.from_id, m.to_id, m.body, m.created_at, m.reply_to_id,
           rm.body as reply_body, ru.name as reply_name
    FROM (
      SELECT * FROM messages
      WHERE ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) AND (channel IS NULL OR channel='')
      ORDER BY id DESC LIMIT 200
    ) m
    LEFT JOIN messages rm ON rm.id=m.reply_to_id
    LEFT JOIN users ru ON ru.id=rm.from_id
    ORDER BY m.id ASC
  `, me, o, o, me);
  run('UPDATE messages SET read_at=? WHERE to_id=? AND from_id=? AND read_at IS NULL', now(), me, o);
  res.json(rows);
});
app.post('/api/messages', (req, res) => {
  const to = int(req.body?.to), body = s(req.body?.body, 2000);
  const replyToId = req.body?.replyToId ? int(req.body.replyToId) : null;
  if (to === req.user.id || !one('SELECT id FROM users WHERE id=? AND disabled=0', to)) throw E(400, 'Penerima tidak valid');
  if (limited('msg' + req.user.id, 60)) throw E(429, 'Terlalu banyak pesan, tunggu sebentar');

  let replyMeta = null;
  if (replyToId) {
    replyMeta = one(`
      SELECT m.body, u.name
      FROM messages m
      JOIN users u ON u.id=m.from_id
      WHERE m.id=?
    `, replyToId);
  }

  const r = run('INSERT INTO messages(from_id,to_id,body,created_at,reply_to_id) VALUES(?,?,?,?,?,?)', req.user.id, to, body, now(), replyMeta ? replyToId : null);
  const m = {
    id: r.lastInsertRowid,
    from_id: req.user.id,
    to_id: to,
    body,
    created_at: now(),
    reply_to_id: replyMeta ? replyToId : null,
    reply_name: replyMeta ? replyMeta.name : null,
    reply_body: replyMeta ? replyMeta.body : null
  };
  pushUser(to, { type: 'message', message: m }); pushUser(req.user.id, { type: 'message', message: m });
  notify(to, 'chat', `${req.user.name}:${body.slice(0, 300)}`);
  res.status(201).json(m);
});
app.post('/api/notifications/read', (req, res) => { run('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', now(), req.user.id); res.json({ ok: true }); });

/* ---------- file attachments upload ---------- */
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));

app.post('/api/upload', (req, res) => {
  const b = req.body || {};
  const filename = s(b.filename || b.name || 'file', 120);
  const dataUrl = b.data;
  if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) throw E(400, 'Format file tidak valid');

  const [header, base64Data] = dataUrl.split(',');
  const buf = Buffer.from(base64Data, 'base64');
  if (buf.length > 10 * 1024 * 1024) throw E(400, 'Ukuran file maksimal 10MB');

  const ext = (path.extname(filename).slice(1) || 'bin').toLowerCase();
  const allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip'];
  if (!allowed.includes(ext)) throw E(400, `Format .${ext} tidak diizinkan. Format yang didukung: ${allowed.join(', ')}`);

  const safeName = `up_${now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, safeName);
  fs.writeFileSync(filePath, buf);

  const fileUrl = `/uploads/${safeName}`;
  res.json({ ok: true, url: fileUrl, name: filename, size: buf.length, ext });
});

/* ---------- sessions & account management ---------- */
app.get('/api/me/sessions', (req, res) => {
  const curTok = cookies(req)[COOKIE];
  const curHash = curTok ? sha(curTok) : '';
  const list = all('SELECT token_hash, expires_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY expires_at DESC', req.user.id, now());
  res.json(list.map((s, idx) => ({
    id: idx + 1,
    isCurrent: s.token_hash === curHash,
    expiresAt: s.expires_at
  })));
});

app.post('/api/me/sessions/logout-others', (req, res) => {
  const curTok = cookies(req)[COOKIE];
  const curHash = curTok ? sha(curTok) : '';
  if (curHash) {
    run('DELETE FROM sessions WHERE user_id=? AND token_hash != ?', req.user.id, curHash);
  }
  res.json({ ok: true, message: 'Berhasil keluar dari semua perangkat lain' });
});

app.delete('/api/me/account', async (req, res) => {
  const pw = typeof req.body?.password === 'string' ? req.body.password : '';
  const u = one('SELECT * FROM users WHERE id=?', req.user.id);
  if (u.pass_hash) {
    const ok = await verifyPw(pw, u.pass_hash);
    if (!ok) throw E(401, 'Kata sandi salah. Konfirmasi penghapusan akun dibatalkan.');
  }
  const leadTeams = all("SELECT team_id FROM team_members WHERE user_id=? AND role='Ketua Tim'", u.id);
  for (const lt of leadTeams) {
    const totalMem = one('SELECT COUNT(*) as c FROM team_members WHERE team_id=?', lt.team_id).c;
    const totalLeads = one("SELECT COUNT(*) as c FROM team_members WHERE team_id=? AND role='Ketua Tim'", lt.team_id).c;
    if (totalMem > 1 && totalLeads <= 1) {
      const tInfo = one('SELECT name FROM teams WHERE id=?', lt.team_id);
      throw E(400, `Kamu adalah satu-satunya Ketua Tim di "${tInfo?.name || 'Tim'}". Tunjuk Ketua Tim pengganti sebelum menghapus akun.`);
    }
  }
  tx(() => {
    run('DELETE FROM team_members WHERE user_id=?', u.id);
    run('DELETE FROM sessions WHERE user_id=?', u.id);
    run('DELETE FROM personal WHERE user_id=?', u.id);
    run('DELETE FROM task_assignees WHERE user_id=?', u.id);
    run('DELETE FROM notifications WHERE user_id=?', u.id);
    run('DELETE FROM time_entries WHERE user_id=?', u.id);
    run('DELETE FROM users WHERE id=?', u.id);
  });
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true, message: 'Akun berhasil dihapus secara permanen.' });
});

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
