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
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_google ON users(google_id) WHERE google_id IS NOT NULL');
  for (const e of (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)) db.prepare('UPDATE users SET is_admin=1 WHERE email=?').run(e);
  if (!db.prepare('SELECT 1 FROM users WHERE is_admin=1').get()) db.exec('UPDATE users SET is_admin=1 WHERE id=(SELECT MIN(id) FROM users)');
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
const activity = (uid, pid, text) => run('INSERT INTO activity(user_id,project_id,text,created_at) VALUES(?,?,?,?)', uid ?? null, pid ?? null, text, now());

module.exports = { db, all, one, run, tx, now, ymd, today, dayOf, daysTo, addDays, hashPw, verifyPw, clients, online, pushUser, broadcast, hooks, notify, activity };
