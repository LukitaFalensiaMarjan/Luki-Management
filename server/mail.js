'use strict';
/* Outgoing email via SMTP (nodemailer). Without SMTP config, emails are printed to the server console (local dev only). */
const nodemailer = require('nodemailer');
const H = process.env.SMTP_HOST, PORT = +process.env.SMTP_PORT || 587;
const tx = H ? nodemailer.createTransport({ host: H, port: PORT, secure: PORT === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined }) : null;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function send(to, subject, html, text) {
  if (!tx) { console.log(`\n[mail] SMTP belum diatur — email TIDAK dikirim. Isi SMTP_* di .env.\n  Ke: ${to}\n  Subjek: ${subject}\n  ${text}\n`); return false; }
  await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html, text });
  return true;
}
const sendVerify = (to, name, link) => send(to, 'Verifikasi email akun LUKI MANAGEMENT',
  `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
    <div style="background:#0b1f5c;color:#fff;border-radius:14px;padding:20px 22px"><b style="font-size:18px">LUKI MANAGEMENT</b></div>
    <h2 style="margin:22px 0 8px">Halo ${esc(name)},</h2>
    <p style="color:#475569;line-height:1.6">Terima kasih sudah mendaftar. Klik tombol di bawah untuk memverifikasi email kamu. Tautan berlaku 24 jam.</p>
    <p style="margin:24px 0"><a href="${esc(link)}" style="background:#1e47b8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:99px;font-weight:bold">Verifikasi email</a></p>
    <p style="color:#94a3b8;font-size:12px">Jika tombol tidak berfungsi, salin tautan ini:<br>${esc(link)}</p>
    <p style="color:#94a3b8;font-size:12px">Bukan kamu yang mendaftar? Abaikan email ini.</p></div>`,
  `Halo ${name}, verifikasi email akun LUKI MANAGEMENT kamu (berlaku 24 jam): ${link}`);

const sendInvite = (to, inviterName, link, teamName = 'Tim') => send(to, `${inviterName} mengundangmu bergabung ke ${teamName} di LUKI MANAGEMENT`,
  `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
    <div style="background:#0b1f5c;color:#fff;border-radius:14px;padding:20px 22px"><b style="font-size:18px">LUKI MANAGEMENT</b></div>
    <h2 style="margin:22px 0 8px">Undangan Bergabung ke ${esc(teamName)}</h2>
    <p style="color:#475569;line-height:1.6">Halo, <b>${esc(inviterName)}</b> mengundang kamu untuk bergabung ke <b>${esc(teamName)}</b> di ruang kerja <b>LUKI MANAGEMENT</b>.</p>
    <p style="margin:24px 0"><a href="${esc(link)}" style="background:#1e47b8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:99px;font-weight:bold">Terima Undangan & Daftar</a></p>
    <p style="color:#94a3b8;font-size:12px">Jika tombol di atas tidak berfungsi, salin tautan pendaftaran ini:<br>${esc(link)}</p>
    <p style="color:#94a3b8;font-size:12px">Bukan kamu yang seharusnya menerima email ini? Abaikan pesan ini.</p></div>`,
  `Halo, ${inviterName} mengundangmu bergabung ke ${teamName} di LUKI MANAGEMENT: ${link}`);

const sendReset = (to, name, link) => send(to, 'Atur ulang kata sandi akun LUKI MANAGEMENT',
  `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
    <div style="background:#0b1f5c;color:#fff;border-radius:14px;padding:20px 22px"><b style="font-size:18px">LUKI MANAGEMENT</b></div>
    <h2 style="margin:22px 0 8px">Atur Ulang Kata Sandi</h2>
    <p style="color:#475569;line-height:1.6">Halo <b>${esc(name)}</b>, kami menerima permintaan untuk mengatur ulang kata sandi akun kamu. Tautan ini berlaku selama 1 jam.</p>
    <p style="margin:24px 0"><a href="${esc(link)}" style="background:#1e47b8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:99px;font-weight:bold">Atur Ulang Kata Sandi</a></p>
    <p style="color:#94a3b8;font-size:12px">Jika kamu tidak meminta pengaturan ulang kata sandi, abaikan email ini. Akunmu tetap aman.</p>
    <p style="color:#94a3b8;font-size:12px">Atau salin tautan ini:<br>${esc(link)}</p></div>`,
  `Halo ${name}, atur ulang kata sandi LUKI MANAGEMENT kamu (berlaku 1 jam): ${link}`);

module.exports = { send, sendVerify, sendInvite, sendReset, enabled: () => !!tx };
