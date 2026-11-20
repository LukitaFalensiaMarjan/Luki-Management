'use strict';
/* Shared HTTP helpers: errors, input validation, cookies, sessions, rate limit. */
const crypto = require('crypto');
const { run, now } = require('./core');

class HttpError extends Error { constructor(code, msg, tag) { super(msg); this.code = code; this.tag = tag; } }
const E = (c, m, tag) => new HttpError(c, m, tag);
const s = (v, max, min = 1) => { if (typeof v !== 'string') throw E(400, 'Input tidak valid'); v = v.trim(); if (v.length < min || v.length > max) throw E(400, `Panjang harus ${min}-${max} karakter`); return v; };
const D = v => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) throw E(400, 'Tanggal tidak valid'); return v; };
const en = (v, list) => { if (!list.includes(v)) throw E(400, 'Nilai tidak valid'); return v; };
const int = v => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw E(400, 'ID tidak valid'); return n; };
const money = v => { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 1e13) throw E(400, 'Nominal tidak valid'); return Math.round(n * 100) / 100; };
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PRIO = ['High', 'Medium', 'Low'];
const APP_URL = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
const SECURE = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';

const COOKIE = 'luki_sid', SESSION_MS = 30 * 864e5;
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => { try { return [k, decodeURIComponent(v.join('='))]; } catch { return [k, '']; } }));
function startSession(res, uid) {
  const tok = crypto.randomBytes(32).toString('base64url');
  run('DELETE FROM sessions WHERE expires_at<?', now());
  run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', sha(tok), uid, now() + SESSION_MS);
  res.append('Set-Cookie', `${COOKIE}=${tok}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${SECURE}`);
}
const tries = new Map();
function limited(key, max = 8) { const t = tries.get(key) || { n: 0, at: now() }; if (now() - t.at > 6e5) { t.n = 0; t.at = now(); } tries.set(key, t); return ++t.n > max; }

module.exports = { HttpError, E, s, D, en, int, money, sha, EMAIL, PRIO, APP_URL, SECURE, COOKIE, cookies, startSession, limited, tries };
