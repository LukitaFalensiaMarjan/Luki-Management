'use strict';
/* DB schema + shared helpers (SSE registry, notifications, activity). */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { promisify } = require('util');

// Minimal .env loader (no dependency). Real env vars win.
try {
  for (const l of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env: defaults */ }

const { DatabaseSync } = require('node:sqlite');
const dir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(process.env.DB_FILE || path.join(dir, 'luki.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Member', division TEXT NOT NULL DEFAULT 'Engineering', location TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '', tz TEXT NOT NULL DEFAULT 'GMT+7 · Jakarta', accent TEXT NOT NULL DEFAULT 'ocean', week INTEGER NOT NULL DEFAULT 0,
  notif TEXT NOT NULL DEFAULT '{"assign":true,"due":true,"chat":true,"report":true}',
  tg_chat_id TEXT, tg_code TEXT, tg_code_exp INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS projects(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, due TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','running','ended')),
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at INTEGER NOT NULL, completed_at INTEGER);
CREATE TABLE IF NOT EXISTS tasks(
  id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, title TEXT NOT NULL, tag TEXT NOT NULL DEFAULT 'Frontend',
  prio TEXT NOT NULL DEFAULT 'Medium', stage TEXT NOT NULL DEFAULT 'todo' CHECK(stage IN('todo','progress','review','done')), due TEXT NOT NULL,
  prog INTEGER NOT NULL DEFAULT 0, created_by INTEGER, created_at INTEGER NOT NULL, completed_at INTEGER);
CREATE TABLE IF NOT EXISTS task_assignees(task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(task_id,user_id));
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, type TEXT NOT NULL, created_by INTEGER);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER);
CREATE INDEX IF NOT EXISTS ix_msg ON messages(from_id,to_id,id);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER);
CREATE TABLE IF NOT EXISTS reminders(kind TEXT NOT NULL, ref_id INTEGER NOT NULL, due TEXT NOT NULL, days INTEGER NOT NULL, user_id INTEGER NOT NULL, sent_at INTEGER NOT NULL, PRIMARY KEY(kind,ref_id,due,days,user_id));
CREATE TABLE IF NOT EXISTS time_entries(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, seconds INTEGER NOT NULL, started_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY, user_id INTEGER, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_act ON activity(created_at);
CREATE TABLE IF NOT EXISTS personal(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  amount REAL, category TEXT, date TEXT, date2 TEXT, url TEXT, status TEXT, priority TEXT, color TEXT, pinned INTEGER NOT NULL DEFAULT 0,
  remind_at INTEGER, reminded_at INTEGER, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_personal ON personal(user_id,kind);
CREATE INDEX IF NOT EXISTS ix_personal_remind ON personal(remind_at) WHERE reminded_at IS NULL;
`);
// Migrations for databases created before auth v2. Users that existed before email verification are treated as verified.
{
  const cols = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
  const add = (c, d) => { if (!cols.has(c)) db.exec(`ALTER TABLE users ADD COLUMN ${c} ${d}`); };
  if (!cols.has('email_verified')) { add('email_verified', 'INTEGER NOT NULL DEFAULT 0'); db.exec('UPDATE users SET email_verified=1'); }
  add('verify_hash', 'TEXT'); add('verify_exp', 'INTEGER'); add('google_id', 'TEXT'); add('is_admin', 'INTEGER NOT NULL DEFAULT 0');
  add('disabled', 'INTEGER NOT NULL DEFAULT 0'); add('last_login', 'INTEGER'); add('budget', 'REAL NOT NULL DEFAULT 0');
  add('username', 'TEXT'); add('avatar', "TEXT NOT NULL DEFAULT ''");
  add('address', "TEXT NOT NULL DEFAULT ''"); add('birth_place', "TEXT NOT NULL DEFAULT ''");
  add('birth_date', 'TEXT'); add('share_birthday', 'INTEGER NOT NULL DEFAULT 0');
  add('team_role', "TEXT NOT NULL DEFAULT 'Member'");
  add('reset_hash', 'TEXT'); add('reset_exp', 'INTEGER');
  add('invite_team_id', 'INTEGER REFERENCES teams(id) ON DELETE SET NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_google ON users(google_id) WHERE google_id IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_username ON users(username) WHERE username IS NOT NULL');
  for (const e of (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)) db.prepare('UPDATE users SET is_admin=1 WHERE email=?').run(e);
  if (!db.prepare('SELECT 1 FROM users WHERE is_admin=1').get()) db.exec('UPDATE users SET is_admin=1 WHERE id=(SELECT MIN(id) FROM users)');
  // Auto-generate username for users without one
  for (const u of db.prepare("SELECT id, email, name FROM users WHERE username IS NULL OR username=''").all()) {
    let base = (u.email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
    let cand = base, idx = 1;
    while (db.prepare('SELECT 1 FROM users WHERE username=? AND id!=?').get(cand, u.id)) cand = `${base}${++idx}`;
    db.prepare('UPDATE users SET username=? WHERE id=?').run(cand, u.id);
  }
  // Ensure Ketua Tim role for admins
  db.exec("UPDATE users SET team_role='Ketua Tim' WHERE is_admin=1 AND (team_role IS NULL OR team_role='Member' OR team_role='')");

  // Migration for tasks (description) and projects (team_id)
  const taskCols = new Set(db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name));
  if (!taskCols.has('description')) db.exec("ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  const projCols = new Set(db.prepare('PRAGMA table_info(projects)').all().map(c => c.name));
  if (!projCols.has('team_id')) db.exec("ALTER TABLE projects ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL");

  // Migration for messages (channel, reply_to_id)
  const msgCols = new Set(db.prepare('PRAGMA table_info(messages)').all().map(c => c.name));
  if (!msgCols.has('channel')) {
    db.exec("ALTER TABLE messages ADD COLUMN channel TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS ix_msg_channel ON messages(channel, id)");
  }
  if (!msgCols.has('reply_to_id')) {
    db.exec("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL");
    db.exec("CREATE INDEX IF NOT EXISTS ix_msg_reply ON messages(reply_to_id)");
  }

  // Migration for personal (wallet, recurring)
  const personalCols = new Set(db.prepare('PRAGMA table_info(personal)').all().map(c => c.name));
  if (!personalCols.has('wallet')) db.exec("ALTER TABLE personal ADD COLUMN wallet TEXT NOT NULL DEFAULT 'cash'");
  if (!personalCols.has('recurring')) db.exec("ALTER TABLE personal ADD COLUMN recurring TEXT");

  // Multi-team tables
  db.exec(`
  CREATE TABLE IF NOT EXISTS teams(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT NOT NULL DEFAULT 'preset:lion',
    description TEXT NOT NULL DEFAULT '',
    code TEXT UNIQUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS team_members(
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'Member' CHECK(role IN('Ketua Tim','Project Manager','Member','Viewer')),
    joined_at INTEGER NOT NULL,
    PRIMARY KEY(team_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS ix_tm_user ON team_members(user_id);
  CREATE TABLE IF NOT EXISTS task_checklists(
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_tchk ON task_checklists(task_id);
  CREATE TABLE IF NOT EXISTS task_comments(
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_tcom ON task_comments(task_id, id);
  `);

  const teamCols = new Set(db.prepare('PRAGMA table_info(teams)').all().map(c => c.name));
  if (!teamCols.has('code')) {
    db.exec("ALTER TABLE teams ADD COLUMN code TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ix_team_code ON teams(code)");
  }
  const teamsWithoutCode = db.prepare("SELECT id FROM teams WHERE code IS NULL OR code = ''").all();
  for (const t of teamsWithoutCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'LK-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    db.prepare('UPDATE teams SET code=? WHERE id=?').run(code, t.id);
  }

  // Seed default team if no teams exist yet
  const tCount = db.prepare('SELECT COUNT(*) as c FROM teams').get()?.c || 0;
  if (tCount === 0) {
    const adm = db.prepare('SELECT id, name FROM users WHERE is_admin=1 ORDER BY id LIMIT 1').get() || db.prepare('SELECT id, name FROM users ORDER BY id LIMIT 1').get();
    if (adm) {
      const initT = db.prepare("INSERT INTO teams(name, logo, description, code, created_by, created_at) VALUES ('Luki Core Team', 'preset:lion', 'Tim Utama Luki Management', 'LK-CORE01', ?, ?)").run(adm.id, Date.now());
      const defTeamId = initT.lastInsertRowid;
      const allU = db.prepare('SELECT id, is_admin, team_role FROM users').all();
      for (const u of allU) {
        const r = u.is_admin ? 'Ketua Tim' : (u.team_role || 'Member');
        db.prepare('INSERT OR IGNORE INTO team_members(team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(defTeamId, u.id, r, Date.now());
      }
      db.prepare('UPDATE projects SET team_id=? WHERE team_id IS NULL').run(defTeamId);
    }
  }
}

const all = (s, ...p) => db.prepare(s).all(...p);
const one = (s, ...p) => db.prepare(s).get(...p);
const run = (s, ...p) => db.prepare(s).run(...p);
const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const now = () => Date.now();
const ymd = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const today = () => ymd(new Date());
const dayOf = ms => ymd(new Date(ms));
const daysTo = s => { const [y, m, d] = s.split('-').map(Number), t = new Date(); return Math.round((new Date(y, m - 1, d) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5); };
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };

/* password hashing (scrypt) */
const scrypt = promisify(crypto.scrypt);
const hashPw = async pw => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + (await scrypt(pw, salt, 64)).toString('hex'); };
const verifyPw = async (pw, stored) => { if (!stored || !stored.includes(':')) return false; const [s, h] = stored.split(':'); return crypto.timingSafeEqual(await scrypt(pw, Buffer.from(s, 'hex'), 64), Buffer.from(h, 'hex')); };

/* SSE registry: userId -> Set(res) */
const clients = new Map();
const online = id => clients.has(id);
const write = (res, evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);
const pushUser = (id, evt) => { for (const r of clients.get(id) || []) write(r, evt); };
const broadcast = evt => { for (const s of clients.values()) for (const r of s) write(r, evt); };

/* notifications: in-app row + SSE push + Telegram (hook set by telegram.js) */
const hooks = { tg: null };
function notify(uid, kind, text, opt = {}) {
  const u = one('SELECT id,notif,tg_chat_id FROM users WHERE id=?', uid);
  if (!u) return;
  let prefs = {}; try { prefs = JSON.parse(u.notif); } catch { /* defaults */ }
  if (prefs[kind] === false) return;
  if (kind !== 'chat') { run('INSERT INTO notifications(user_id,kind,text,created_at) VALUES(?,?,?,?)', uid, kind, text, now()); pushUser(uid, { type: 'notif', text }); }
  if (u.tg_chat_id && hooks.tg && (kind !== 'chat' || !online(uid))) hooks.tg(u.tg_chat_id, text, opt.doc).catch(e => console.error('[telegram]', e.message));
}
function genTeamCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = 'LK-';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

const activity = (uid, pid, text) => run('INSERT INTO activity(user_id,project_id,text,created_at) VALUES(?,?,?,?)', uid ?? null, pid ?? null, text, now());

module.exports = { db, all, one, run, tx, now, ymd, today, dayOf, daysTo, addDays, hashPw, verifyPw, clients, online, pushUser, broadcast, hooks, notify, activity, genTeamCode };
