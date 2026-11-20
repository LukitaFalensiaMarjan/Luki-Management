# LUKI MANAGEMENT — Dokumentasi Project

## 1. Deskripsi project

**LUKI MANAGEMENT** adalah aplikasi web untuk mengelola **kerja tim** dan **kehidupan pribadi** dalam satu tempat.

- **Area tim** (dipakai bersama semua anggota): dashboard, kanban task, kalender, analitik, chat realtime antar anggota, laporan PDF otomatis saat project selesai.
- **Ruang pribadi** (hanya pemilik akun yang bisa melihat, admin pun tidak): keuangan, catatan, tugas pribadi, wishlist, rencana travel.
- **Pengingat Telegram**: deadline task, project, tugas pribadi, dan travel di H-7, H-3, H-2, H-1. Ada juga pengingat tepat waktu untuk catatan/tagihan, dan pencatatan pengeluaran langsung dari chat bot.
- **Akun**: daftar dengan email + password (wajib verifikasi email) atau dengan Google. Ada halaman admin untuk mengelola user.
- **Tampilan**: desain mengikuti video referensi dan responsif untuk desktop, tablet, iPhone, dan Android.

**Teknologi**

| Bagian | Teknologi |
|---|---|
| Server | Node.js ≥ 22.13, Express 5 |
| Database | SQLite bawaan Node (`node:sqlite`), file `data/luki.db` |
| PDF | PDFKit |
| Email | Nodemailer (SMTP) |
| Realtime | Server-Sent Events (SSE) |
| Frontend | HTML/CSS/JavaScript murni (tanpa build), folder `public/` |

**Struktur folder**

```
LUKI MANAGEMENT/
├─ server/
│  ├─ index.js      # entry server: auth, Google OAuth, project, task, chat, analitik
│  ├─ core.js       # skema database + migrasi + notifikasi + SSE
│  ├─ http.js       # helper validasi, sesi, rate limit
│  ├─ personal.js   # API ruang pribadi
│  ├─ admin.js      # API admin
│  ├─ mail.js       # kirim email verifikasi
│  ├─ telegram.js   # bot Telegram
│  ├─ reminders.js  # penjadwal pengingat
│  ├─ report.js     # generator laporan PDF
│  └─ seed.js       # data contoh (opsional)
├─ public/
│  ├─ index.html    # landing page + login/register + shell aplikasi
│  ├─ style.css     # semua tampilan + responsif mobile
│  ├─ app.js        # inti aplikasi (dashboard, tasks, kalender, analitik, tim, settings, auth)
│  ├─ personal.js   # ruang pribadi
│  └─ admin.js      # halaman admin
├─ data/luki.db     # database (dibuat otomatis, jangan dibagikan)
├─ .env.example     # contoh konfigurasi
└─ package.json
```

---

## 2. Rincian yang sudah dikerjakan

### Tahap 1 — Website dari video referensi
- **Dashboard:** kartu statistik, grafik task selesai, reminder, daftar project, kolaborasi tim, gauge progress, time tracker.
- **Tasks:** kanban 4 kolom (drag & drop dan menu), filter, buat/hapus task.
- **Calendar:** grid bulanan, agenda harian, "Coming up", tambah/hapus event. Deadline muncul otomatis.
- **Analytics:** KPI dengan sparkline, grafik throughput dengan hover, donut waktu per project, heatmap aktivitas, kontributor teratas, export CSV.
- **Team:** filter divisi, kartu anggota, profil (drawer), assign task.
- **Settings:** profil, notifikasi, tampilan (4 warna aksen dan hari awal minggu).
- **Animasi:** transisi halaman, angka berhitung, bar tumbuh, ripple menu, modal blur, toast.

### Tahap 2 — Backend & fitur tim
- Perbaikan bug kartu task "mengambang" setelah dipindah.
- Database SQLite: data tersimpan permanen dan dipakai bersama.
- Login & register. Password di-hash (scrypt), sesi memakai cookie `HttpOnly`.
- Chat realtime antar user, dengan badge belum dibaca dan status online.
- Laporan PDF lengkap dibuat otomatis saat project ditandai selesai, lalu dikirim ke anggota project. Isinya ringkasan, ketepatan waktu, rincian task, kontribusi, dan linimasa.
- Bot Telegram dengan pengingat deadline H-7/H-3/H-2/H-1 untuk task dan project.

### Tahap 3 — Pekerjaan terbaru
- **Landing page baru:** hero dengan mockup, fitur, ruang pribadi, Telegram, FAQ, footer, dan menu mobile.
- **Login/Register di landing page:**
  - Email + password **wajib verifikasi email**. Link berlaku 24 jam dan bisa dikirim ulang. Login ditolak sebelum verifikasi.
  - **Login dengan Google** (OAuth 2.0 + PKCE). Hanya email yang sudah diverifikasi Google yang diterima.
  - Tombol Google otomatis disembunyikan selama belum dikonfigurasi.
- **Halaman Admin (`#/admin`):**
  - Statistik workspace dan grafik pendaftaran 30 hari.
  - Daftar user dengan pencarian dan filter (belum verifikasi, nonaktif, admin, Google).
  - Aksi per user: verifikasi manual, jadikan/cabut admin, nonaktifkan/aktifkan (sesi langsung diputus), hapus.
  - Kirim pengumuman ke semua user lewat notifikasi dan Telegram.
  - Admin tidak bisa mengubah atau menghapus akunnya sendiri, supaya tidak terkunci.
- **Ruang Pribadi (`#/personal`)**, data per user dan privat:
  - **Ringkasan:** saldo bulan ini, budget, tugas aktif, wishlist, pengingat mendatang, perjalanan berikutnya, catatan tersemat.
  - **Keuangan:** pemasukan/pengeluaran per bulan, kategori, budget bulanan dengan indikator, grafik per kategori.
  - **Catatan:** warna, sematkan, pengingat.
  - **Tugas pribadi:** tenggat, prioritas, label, tandai selesai.
  - **Wishlist:** harga, link, prioritas, target tanggal, tandai sudah dibeli.
  - **Travel:** tanggal berangkat/pulang, budget, rencana, countdown.
  - Semua item bisa diberi **pengingat tanggal & jam**, yang dikirim ke notifikasi aplikasi dan Telegram.
- **Tambahan Telegram:**
  - Pengingat H-7/H-3/H-2/H-1 untuk tugas pribadi dan keberangkatan travel.
  - Pengingat tepat waktu, dicek tiap menit.
  - Perintah bot: `/catat 25000 makan siang` (pengeluaran), `/masuk 5000000 gaji` (pemasukan), `/deadline` (termasuk item pribadi), `/stop`.
- **Tampilan mobile dirombak:**
  - Menu samping di HP **sama dengan sidebar desktop** (slide dari kiri).
  - Form tampil sebagai bottom sheet, tabel admin berubah jadi kartu, kanban dan tab bisa digeser.
  - Mendukung safe area (notch iPhone).
  - Diuji otomatis di lebar 375 px (iPhone), 412 px (Android), 768 px (tablet), dan 1366 px (desktop). Hasilnya **tidak ada elemen yang keluar layar atau terpotong** di semua halaman dan tab.
- **Keamanan:**
  - Proteksi CSRF dan header keamanan (CSP dan lainnya).
  - Rate limit untuk login, daftar, kirim ulang verifikasi, dan chat.
  - Setiap query data pribadi dibatasi ke pemiliknya.
  - Semua input divalidasi di server.
- **Migrasi otomatis:** database lama diperbarui sendiri. User lama dianggap sudah terverifikasi, dan user pertama jadi admin.

---

## 3. Cara menjalankan (lokal)

1. Install Node.js versi 22.13 atau lebih baru (disarankan 24 LTS) dari https://nodejs.org
2. Buka terminal di folder project, lalu jalankan:
   ```bash
   npm install
   ```
3. Salin `.env.example` menjadi `.env`, lalu isi bagian yang dibutuhkan (lihat bagian 4).
4. Opsional, isi data contoh. Ini hanya jalan di database kosong:
   ```bash
   npm run seed
   ```
   Login demo: `noah@luki.app` / `demo12345` (Noah adalah admin).
5. Jalankan server:
   ```bash
   npm start
   ```
6. Buka http://localhost:3000

> Tanpa SMTP, email verifikasi **tidak terkirim**. Tautan verifikasi dicetak di terminal server, khusus untuk uji lokal.

---

## 4. Cara mendapatkan API key & mengisi `.env`

File `.env` ada di folder utama project, sejajar dengan `package.json`. Formatnya `NAMA=nilai`, satu per baris.

- **Setiap kali `.env` diubah, restart server**: tekan `Ctrl+C`, lalu `npm start`.
- Jangan pernah membagikan atau meng-upload file `.env`.

### 4.1 Login Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
1. Buka https://console.cloud.google.com dan login.
2. Buat project baru: pojok kiri atas → **New Project**, beri nama `LUKI MANAGEMENT`.
3. Buka menu **APIs & Services → OAuth consent screen**:
   - User type **External**. Isi nama aplikasi, email dukungan, dan email developer, lalu Save.
   - Di Scopes, tambahkan `openid`, `.../auth/userinfo.email`, dan `.../auth/userinfo.profile`.
   - Selama status masih **Testing**, tambahkan email yang boleh login di **Test users** (maks 100). Untuk umum, klik **Publish app**.
4. Buka menu **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** `http://localhost:3000`, dan nanti domain online (mis. `https://luki.domainmu.com`).
   - **Authorized redirect URIs:** `http://localhost:3000/api/auth/google/callback`, dan nanti `https://luki.domainmu.com/api/auth/google/callback`.
   - Klik **Create**, lalu salin **Client ID** dan **Client secret**.
5. Isi di `.env`:
   ```
   APP_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
   ```
   `APP_URL` harus **sama persis** dengan alamat di redirect URI: sama http/https, sama port, tanpa `/` di akhir.

### 4.2 Email verifikasi (SMTP)
Pilih salah satu.

**A. Gmail.** Gratis, cocok untuk uji atau skala kecil (sekitar 500 email/hari).
1. Aktifkan **Verifikasi 2 Langkah** di https://myaccount.google.com/security
2. Buka https://myaccount.google.com/apppasswords, buat App Password (nama: LUKI), lalu salin 16 karakternya.
3. Isi di `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=emailkamu@gmail.com
   SMTP_PASS=abcdefghijklmnop
   MAIL_FROM="LUKI MANAGEMENT <emailkamu@gmail.com>"
   ```

**B. Layanan email transaksional.** Disarankan saat sudah online: Brevo, Resend, Mailgun, atau SendGrid.
1. Daftar, lalu verifikasi domain kamu dengan menambahkan record DNS SPF/DKIM yang diberikan. Tanpa ini email mudah masuk spam.
2. Ambil kredensial **SMTP** dari dashboard: host, port, username, dan password/API key.
3. Contoh untuk Brevo:
   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=login-smtp-dari-brevo
   SMTP_PASS=kunci-smtp-dari-brevo
   MAIL_FROM="LUKI MANAGEMENT <no-reply@domainmu.com>"
   ```

### 4.3 Bot Telegram (`TELEGRAM_BOT_TOKEN`)
1. Di Telegram, cari **@BotFather** lalu kirim `/newbot`.
2. Isi nama bot (mis. `LUKI Reminder`) dan username yang diakhiri `bot` (mis. `luki_reminder_bot`).
3. Salin token yang diberikan (formatnya `123456789:AA...`).
4. Isi di `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456789:AAxxxxxxxxxxxxxxxxxxxxxxxx
   REMINDER_HOUR=8
   ```
5. Opsional: di BotFather kirim `/setcommands`, pilih bot, lalu tempel:
   ```
   deadline - Deadline 14 hari ke depan
   catat - Catat pengeluaran: /catat 25000 makan siang
   masuk - Catat pemasukan: /masuk 5000000 gaji
   stop - Putuskan notifikasi
   ```
6. Restart server. Di aplikasi, buka **Settings → Notifications → Connect Telegram**, lalu tekan **Start** di bot.

### 4.4 Admin
- User **pertama** yang mendaftar otomatis menjadi admin.
- Bisa juga ditetapkan lewat `.env`: `ADMIN_EMAILS=kamu@email.com,rekan@email.com`. Ini diterapkan setiap server start.

---

## 5. Rencana selanjutnya

### Wajib sebelum dipakai banyak orang
1. **Isi `.env`:** SMTP (agar email verifikasi terkirim), Google OAuth, dan Telegram.
2. **Online-kan (deploy).** Pilihan:
   - **VPS** (DigitalOcean, Contabo, IDCloudHost, Biznet Gio): paling fleksibel. Pasang Node 24, jalankan dengan **PM2**, dan pasang **Caddy** atau **Nginx** untuk HTTPS gratis (Let's Encrypt).
   - **Railway / Render / Fly.io**: lebih mudah, tapi **wajib pakai persistent volume** untuk folder `data/` supaya database tidak hilang saat redeploy.
   - Setelah online, set di server: `HOST=0.0.0.0`, `APP_URL=https://domainmu`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`.
   - Tambahkan domain online ke **Authorized redirect URIs** Google.
3. **Backup database rutin.** Salin `data/luki.db`, mis. lewat cron harian ke Google Drive/S3. Perintah ini aman dijalankan saat server hidup:
   ```bash
   sqlite3 data/luki.db ".backup backup-$(date +%F).db"
   ```
4. **Verifikasi domain email** (SPF/DKIM/DMARC) agar email tidak masuk spam.
5. **Uji di HP asli** (Safari iPhone dan Chrome Android), terutama login Google dan drag & drop kanban. Di layar sentuh, pakai menu ⋯ untuk memindah kartu.

### Disarankan
6. **Lupa password / reset password** via email. Infrastruktur email sudah ada.
7. **Ganti password** dan **hapus akun sendiri** di Settings.
8. **Workspace terpisah** (multi-tim/organisasi). Saat ini semua user berbagi satu workspace.
9. **Peran yang lebih rinci** per project: owner, manager, member, guest.
10. **Uji otomatis** (unit/integration test) dan CI di GitHub Actions.
11. **Monitoring & log:** mis. Sentry untuk error dan Uptime Kuma untuk uptime.
12. Kalau user aktif bersamaan lebih dari sekitar 1.000: pindah ke **PostgreSQL**, dan Redis untuk realtime.

---

## 6. Rekomendasi fitur tambahan

**Produktivitas tim**
- Komentar dan lampiran file di task, serta mention `@nama` dengan notifikasi.
- Sub-task/checklist di dalam task, dan dependensi antar task.
- Tampilan **Gantt/timeline** project dan **sprint** (velocity, burndown chart).
- Chat **grup per project**, plus kirim gambar/file di chat.
- Template project (mis. "Launch produk", "Event").
- Integrasi Google Calendar untuk sinkron event dan deadline.

**Ruang pribadi**
- **Transaksi berulang** (gaji, langganan, cicilan) dengan pengingat tagihan bulanan otomatis.
- **Target tabungan** (mis. untuk wishlist atau travel) dengan progress bar.
- Banyak dompet/rekening (cash, bank, e-wallet) dan transfer antar dompet.
- Export keuangan ke **Excel/PDF**, dan laporan bulanan otomatis ke Telegram.
- **Foto struk** yang terisi otomatis (OCR), serta upload foto untuk catatan dan travel.
- **Habit tracker** dan **jurnal harian**.
- Itinerary per hari dan checklist barang bawaan untuk travel.
- Catatan berformat (bold, list, checkbox) dan kunci PIN untuk catatan sensitif.

**Telegram & AI**
- Perintah baru:
  - `/hari_ini`: ringkasan agenda pagi otomatis.
  - `/saldo`: ringkasan keuangan.
  - `/tugas Bayar listrik besok`: tambah tugas dari chat.
- Asisten AI: ringkasan mingguan, saran budget, dan membuat task dari teks bebas.

**Platform**
- **PWA**: bisa di-install di HP seperti aplikasi, dengan notifikasi push dan mode offline.
- **Dark mode**.
- **Login 2FA** (OTP aplikasi authenticator) untuk admin.
- Multi-bahasa (Indonesia/Inggris).
- Log aktivitas admin (audit log) dan ekspor data akun (hak privasi pengguna).

---

## 7. Batasan yang perlu diketahui
- Login Google tidak mengirim email verifikasi tambahan, karena email akun Google sudah diverifikasi oleh Google.
- Tanpa SMTP, email verifikasi hanya dicetak di console server (khusus uji lokal).
- Laporan PDF memakai font standar, jadi nama dengan huruf non-Latin (mis. aksara Jepang) tampil sebagai `?`.
- Drag & drop kanban tidak bekerja di layar sentuh. Pakai menu ⋯ pada kartu.
- Semua anggota berbagi satu workspace tim. Ruang pribadi tetap terpisah per user.
- Pengingat H-x dikirim setelah jam `REMINDER_HOUR` waktu server. Kalau server mati seharian, pengingat hari itu terlewat.
