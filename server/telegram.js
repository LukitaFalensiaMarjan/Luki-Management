'use strict';
/* Telegram bot: link accounts via /start CODE, send notifications/documents. Token comes from env only. */
const core = require('./core');
const { one, run, all, now, daysTo } = core;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let botName = process.env.TELEGRAM_BOT_USERNAME || '';

const call = async (method, body, form, ms = 15000) => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: form ? undefined : { 'content-type': 'application/json' },
    body: form || JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || 'Telegram error');
  return j.result;
};
const enabled = () => !!TOKEN;
const sendText = (chat, text) => call('sendMessage', { chat_id: chat, text: String(text).slice(0, 4000), disable_web_page_preview: true });
async function sendDoc(chat, buf, name, caption) {
  const f = new FormData();
  f.append('chat_id', String(chat)); f.append('caption', String(caption || '').slice(0, 1000));
  f.append('document', new Blob([buf], { type: 'application/pdf' }), name);
  return call('sendDocument', null, f, 60000);
}
core.hooks.tg = (chat, text, doc) => doc ? sendDoc(chat, doc.buf, doc.name, text) : sendText(chat, text);

function deadlines(uid) {
  const rows = [
    ...all(`SELECT t.title,t.due FROM tasks t JOIN task_assignees a ON a.task_id=t.id WHERE a.user_id=? AND t.stage!='done'`, uid).map(r => ({ ...r, k: 'Task' })),
    ...all(`SELECT name title,due FROM projects WHERE owner_id=? AND status!='ended'`, uid).map(r => ({ ...r, k: 'Project' })),
    ...all(`SELECT title,date due FROM personal WHERE user_id=? AND kind='ptask' AND status='todo' AND date IS NOT NULL`, uid).map(r => ({ ...r, k: 'Tugas pribadi' })),
    ...all(`SELECT title,date due FROM personal WHERE user_id=? AND kind='trip' AND status='planned'`, uid).map(r => ({ ...r, k: 'Trip' })),
  ].map(r => ({ ...r, d: daysTo(r.due) })).filter(r => r.d >= 0 && r.d <= 14).sort((a, b) => a.d - b.d).slice(0, 10);
  return rows.length ? 'Deadline 14 hari ke depan:\n' + rows.map(r => `• ${r.k}: ${r.title} — ${r.d === 0 ? 'hari ini' : 'H-' + r.d} (${r.due})`).join('\n') : 'Tidak ada deadline dalam 14 hari ke depan.';
}
async function handle(m) {
  if (!m?.text || m.chat?.type !== 'private') return;
  const chat = String(m.chat.id), [raw, arg] = m.text.trim().split(/\s+/), cmd = raw.split('@')[0].toLowerCase();
  if (cmd === '/start') {
    const u = arg && one('SELECT id,name FROM users WHERE tg_code=? AND tg_code_exp>?', arg, now());
    if (!u) return sendText(chat, 'Halo! Buka LUKI MANAGEMENT → Settings → Notifications → Connect Telegram, lalu tekan tombol yang muncul untuk menghubungkan akunmu.');
    run('UPDATE users SET tg_chat_id=NULL WHERE tg_chat_id=?', chat);
    run('UPDATE users SET tg_chat_id=?,tg_code=NULL,tg_code_exp=NULL WHERE id=?', chat, u.id);
    core.pushUser(u.id, { type: 'tg', linked: true });
    return sendText(chat, `Terhubung sebagai ${u.name}. Kamu akan menerima pengingat deadline H-7, H-3, H-2 dan H-1.\n\nPerintah: /deadline, /stop`);
  }
  const u = one('SELECT id,name FROM users WHERE tg_chat_id=? OR CAST(tg_chat_id AS TEXT)=? OR tg_chat_id=?', chat, chat, Number(m.chat.id) || 0);
  if (!u) return sendText(chat, 'Akun belum terhubung. Buka LUKI MANAGEMENT → Settings → Notifications → Connect Telegram untuk menghubungkan akunmu.');
  if (cmd === '/stop') { run('UPDATE users SET tg_chat_id=NULL WHERE id=?', u.id); core.pushUser(u.id, { type: 'tg', linked: false }); return sendText(chat, 'Notifikasi dimatikan. Hubungkan lagi kapan saja dari Settings.'); }
  if (cmd === '/deadline') return sendText(chat, deadlines(u.id));
  if (cmd === '/catat' || cmd === '/masuk') {
    // "/catat 25000 makan siang" -> expense, "/masuk 5000000 gaji" -> income
    const x = m.text.trim().match(/^\/\w+(?:@\w+)?\s+([\d.,]+)\s+([\s\S]{1,120})$/);
    const amount = x && Number(x[1].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (!x || !(amount > 0 && amount <= 1e13)) return sendText(chat, `Format: ${cmd} <nominal> <keterangan>\nContoh: ${cmd} 25000 ${cmd === '/catat' ? 'makan siang' : 'gaji bulan ini'}`);
    const inc = cmd === '/masuk', d = new Date(), date = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10), title = x[2].trim();
    run('INSERT INTO personal(user_id,kind,title,status,amount,category,date,created_at) VALUES(?,?,?,?,?,?,?,?)', u.id, 'tx', title, inc ? 'income' : 'expense', amount, 'Lainnya', date, now());
    core.pushUser(u.id, { type: 'personal' });
    return sendText(chat, `${inc ? 'Pemasukan' : 'Pengeluaran'} dicatat: Rp${Math.round(amount).toLocaleString('id-ID')} — ${title}`);
  }
  return sendText(chat, 'Perintah:\n/deadline — deadline 14 hari ke depan\n/catat <nominal> <keterangan> — catat pengeluaran\n/masuk <nominal> <keterangan> — catat pemasukan\n/stop — putuskan notifikasi');
}
async function start() {
  if (!TOKEN) return console.log('[telegram] TELEGRAM_BOT_TOKEN kosong: fitur Telegram nonaktif');
  try { botName = (await call('getMe', {})).username; console.log(`[telegram] bot @${botName} aktif`); } catch (e) { console.error('[telegram] token tidak valid:', e.message); return; }
  let offset = 0;
  for (;;) {
    try {
      const ups = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, null, 40000);
      for (const u of ups) { offset = u.update_id + 1; await handle(u.message).catch(e => console.error('[telegram]', e.message)); }
    } catch (e) { console.error('[telegram] polling:', e.message); await new Promise(r => setTimeout(r, /Conflict|Unauthorized/.test(e.message) ? 30000 : 5000)); }
  }
}
module.exports = { enabled, botName: () => botName, start, sendText, handle };
