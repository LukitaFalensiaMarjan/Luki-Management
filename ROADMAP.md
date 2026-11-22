# ROADMAP & PENGEMBANGAN: LUKI MANAGEMENT

Dokumen ini merangkum seluruh daftar pekerjaan, perbaikan, dan fitur baru yang belum dikerjakan atau perlu ditingkatkan pada project **LUKI MANAGEMENT**, diorganisir ke dalam 5 pilar utama lengkap dengan checklist implementasi teknis dan file-file yang terdampak.

---

## Daftar Isi
1. [Pilar 1: Konfigurasi Kredensial & Integrasi Layanan Eksternal](#pilar-1-konfigurasi-kredensial--integrasi-layanan-eksternal)
2. [Pilar 2: Penyempurnaan Fungsional & Antarmuka Pengguna (UI/UX)](#pilar-2-penyempurnaan-fungsional--antarmuka-pengguna-uiux)
3. [Pilar 3: Fitur Akun, Keamanan, & Manajemen Pengguna](#pilar-3-fitur-akun-keamanan--manajemen-pengguna)
4. [Pilar 4: Fitur Kolaborasi Tim & Ruang Pribadi Tingkat Lanjut](#pilar-4-fitur-kolaborasi-tim--ruang-pribadi-tingkat-lanjut)
5. [Pilar 5: Kesiapan Menuju Produksi, Pengujian, & Deployment](#pilar-5-kesiapan-menuju-produksi-pengujian--deployment)

---

## Pilar 1: Konfigurasi Kredensial & Integrasi Layanan Eksternal

> **Prioritas:** Mendesak (Prasyarat Operasional)  
> **Status:** SELESAI (100% Terkonfigurasi dan Terverifikasi)

### Checklist Pekerjaan
- [x] **1.1 Konfigurasi Email SMTP (Nodemailer)**
  - Masukkan kredensial SMTP di `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
  - *Status:* Berhasil terhubung dan terverifikasi dengan server Google SMTP.
- [x] **1.2 Konfigurasi Google OAuth 2.0 (PKCE)**
  - Buat project di Google Cloud Console -> Google Auth Platform -> Web Application client.
  - Daftarkan Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`.
  - Masukkan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` ke `.env`.
  - *Status:* Client ID & Secret sudah terpasang dan aktif di server (`google: true`).
- [x] **1.3 Konfigurasi Bot Telegram**
  - Buat bot baru di Telegram melalui `@BotFather` (`@LukiManagementBot`) dan ambil tokennya.
  - Masukkan `TELEGRAM_BOT_TOKEN` dan tentukan `REMINDER_HOUR` di `.env`.
  - Daftarkan perintah bot via `@BotFather` (`/setcommands`): `deadline`, `catat`, `masuk`, `stop`.
  - *Status:* Bot `@LukiManagementBot` aktif dan polling `ok: true`.
- [x] **1.4 Penetapan Akses Admin Akun Utama**
  - Tambahkan email pemilik akun di baris `.env`: `ADMIN_EMAILS=nanolukii17@gmail.com,lukitafalensiamarjan@gmail.com`.
  - *Status:* Akun `nanolukii17@gmail.com` telah otomatis mendapatkan hak akses Admin (`is_admin = 1`).
- [x] **1.5 Inisialisasi Version Control Git**
  - Jalankan `git init` di root project.
  - Pastikan `.gitignore` tetap mengecualikan `node_modules/`, `data/`, `.env`, dan `*.log`.
  - Buat commit awal (*initial commit*) dan siap dihubungkan ke remote repository GitHub.
  - *Status:* Git repo lokal dan initial commit sudah selesai dibuat.

**File Terkait:**
* `.env`
* `server/mail.js`
* `server/telegram.js`
* `server/core.js`

---

## Pilar 2: Penyempurnaan Fungsional & Antarmuka Pengguna (UI/UX)

> **Prioritas:** Tinggi  
> **Status:** SELESAI SEBAGIAN (Modal Edit/Delete Task & Project, Invite Team, RBAC Aktif)

### Checklist Pekerjaan
- [x] **2.1 Modal & Form Edit Task (Papan Kanban)**
  - Opsi `"Edit task"` di menu kartu task (`data-act="menu"`).
  - Modal form terisi awal (Title, Tag, Priority, Project, Due date, Assignees).
  - Terhubung langsung ke API `PATCH /api/tasks/:id`.
- [x] **2.2 Modal Edit & Hapus Project di Dashboard**
  - Tombol ikon edit dan hapus pada baris project untuk owner/admin.
  - Modal ubah nama & due date serta konfirmasi modal hapus project (`DELETE /api/projects/:id`).
- [x] **2.3 Fitur Edit Jadwal / Event Kalender**
  - Pada tampilan kalender (`vCal`), modal edit untuk mengubah judul, tanggal, jam, dan kategori event (`meeting`, `team`, `review`, `deadline`, `social`).
  - Terhubung ke endpoint `PATCH /api/events/:id` dengan validasi server.
- [ ] **2.4 Drag & Drop di Layar Sentuh / Mobile UX**
  - Optimalkan interaksi pemindahan kartu kanban pada perangkat seluler.

---

## Pilar 3: Fitur Akun, Keamanan, & Manajemen Pengguna

> **Prioritas:** Sedang - Tinggi  
> **Status:** SELESAI SEBAGIAN (Profil Baru Lengkap, Avatar/Upload, Username Unik, RBAC Ketua Tim, Ganti Password Selesai)

### Checklist Pekerjaan
- [x] **3.1 Menu Profil Baru & Lengkap**
  - Pemilihan avatar ikon preset (12 pilihan menarik) atau upload gambar foto profil mandiri.
  - Username unik per user (`@username`) dengan validasi anti-duplikasi.
  - Dropdown divisi lengkap + pilihan kustom isi sendiri (`_custom`).
  - Jabatan dihilangkan dari form pendaftaran & edit profil.
  - Tempat lahir, tanggal lahir, domisili/alamat, dan switch opsional berbagi tanggal lahir ke tim.
  - Notifikasi ucapan selamat ulang tahun otomatis ke seluruh tim saat hari ulang tahun tiba.
- [x] **3.2 Fitur Ganti Password di Menu Pengaturan (Settings)**
  - Tab baru **"Kata Sandi"** di halaman `#/settings`.
  - Form Kata Sandi Saat Ini, Kata Sandi Baru, dan Konfirmasi (atau buat sandi baru bagi login Google).
  - Endpoint `POST /api/me/password` dengan enkripsi `scrypt`.
- [x] **3.3 Sistem Role Tim & RBAC (Role-Based Access Control)**
  - Pembuat workspace / Admin otomatis menjadi **Ketua Tim**.
  - Ketua Tim dapat mengatur role anggota tim: **Ketua Tim**, **Project Manager**, **Member**, **Viewer**.
  - Modal penetapan role di menu Team via `PATCH /api/team/members/:id/role`.
- [x] **3.4 Fitur Lupa Kata Sandi (Forgot / Reset Password)**
  - Panel form permintaan reset kata sandi (`#forgotPanel`) terintegrasi di landing page auth.
  - Endpoint `POST /api/auth/forgot-password` mengirimkan email pemulihan berisi token bertenggat 1 jam via Nodemailer Gmail.
  - Halaman penerimaan token (`#resetPanel` via parameter URL `?resetToken=...`) dengan validasi kata sandi baru (min. 8 karakter) via `POST /api/auth/reset-password`.
- [ ] **3.5 Fitur Hapus Akun Sendiri & Manajemen Sesi Aktif**

**File Terkait:**
* `server/index.js`
* `server/mail.js`
* `server/core.js`
* `public/app.js` (fungsi `vSet`, form auth di landing page)
* `public/index.html`

---

## Pilar 4: Fitur Kolaborasi Tim & Ruang Pribadi Tingkat Lanjut

> **Prioritas:** Sedang (Peningkatan Nilai Produk)  
> **Status Saat Ini:** Fitur inti tim dan ruang pribadi sudah berfungsi, tetapi masih dalam format ringkas/sederhana.

### Checklist Kolaborasi Tim
- [x] **4.1 Modal Detail Task & Kolaborasi**
  - Kolom `description` pada tabel `tasks` (tersimpan via `PATCH /api/tasks/:id`).
  - Drawer detail task (`openTaskDetail`) yang dapat diakses dengan mengklik kartu task atau menu ⋯ `Detail & Diskusi`.
  - **Sub-task / Checklist:** Pecah task menjadi checklist item yang bisa dicentang satu per satu dengan indikator progres persentase (`GET/POST /api/tasks/:id/checklists`, `PATCH/DELETE /api/checklists/:id`).
  - **Diskusi / Komentar Task:** Kolom komentar realtime berurutan di dalam task agar anggota dapat berdiskusi (`GET/POST /api/tasks/:id/comments`, `DELETE /api/comments/:id`).
- [ ] **4.2 Chat Tim Berbasis Grup / Channel Project**
  - Buat tabel database untuk grup obrolan (`channels` dan `channel_members`).
  - Sediakan channel bawaan untuk setiap project yang dibuat (misal: `#project-billing-portal`).
  - Izinkan anggota project berdiskusi bersama, bukan hanya lewat pesan privat (1-on-1).
- [x] **4.3 Multi-Team & Per-Team RBAC (Multi-Ruang Kerja Tim)**
  - Dukungan membuat tim lebih dari satu (`teams` table dengan nama, logo/ikon preset, deskripsi, dan pembuat tim).
  - Role tim bersifat independen per tim (`team_members` table dengan role `Ketua Tim`, `Project Manager`, `Member`, `Viewer`): seorang user bisa menjadi Ketua di Tim A dan Member di Tim B.
  - Dropdown switcher tim instan di tampilan Team (`vTeam`) dan modal CRUD tim (`POST/PATCH/DELETE /api/teams`, `PATCH /api/teams/:id/members/:userId/role`).

### Checklist Ruang Pribadi (Personal Space)
- [ ] **4.4 Transaksi Keuangan Berulang (Recurring Transactions)**
  - Tambahkan penanda transaksi rutin (gaji bulanan, tagihan wifi/listrik, langganan digital).
  - Penjadwal otomatis untuk membuat catatan transaksi atau mengirim pengingat Telegram saat tanggal jatuh tempo tagihan tiba.
- [ ] **4.5 Multi-Dompet / Akun Finansial**
  - Kemampuan mencatat kategori sumber dana (misal: Rekening Bank BCA, Dompet Tunai, E-Wallet GoPay/OVO).
  - Fitur transfer saldo antar dompet.
- [ ] **4.6 Export Laporan Keuangan Pribadi**
  - Sediakan tombol export laporan keuangan bulanan ke format CSV / Excel / PDF di Ruang Pribadi.
- [ ] **4.7 Detail & Itinerary Perjalanan (Travel Planner)**
  - Tambahkan checklist barang bawaan (*packing list*) untuk setiap rencana liburan.
  - Tambahkan jadwal kegiatan harian (*daily itinerary* / rundown per hari).

**File Terkait:**
* `server/core.js` (migrasi tabel tasks, channels, personal)
* `server/index.js` & `server/personal.js`
* `public/app.js` & `public/personal.js`

---

## Pilar 5: Kesiapan Menuju Produksi, Pengujian, & Deployment

> **Prioritas:** Tinggi (Sebelum Publikasi Online)  
> **Status Saat Ini:** Siap dijalankan di localhost, namun belum dilengkapi pengujian otomatis dan konfigurasi deploy server cloud.

### Checklist Pekerjaan
- [ ] **5.1 Otomatisasi Backup Database SQLite**
  - Buat skrip cadangan berkala (misal `scripts/backup.js`) menggunakan perintah safe backup SQLite:
    ```bash
    node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('data/luki.db'); db.exec(\"VACUUM INTO 'data/backup-' + Date.now() + '.db'\");"
    ```
  - Pasang jadwal cron harian pada server VPS untuk mencadangkan database ke penyimpanan terpisah (Google Drive / S3 / rsync).
- [ ] **5.2 Pengujian Otomatis (Automated Unit & Integration Tests)**
  - Buat folder `test/` dan gunakan Node.js built-in test runner (`node --test`).
  - Tulis skenario pengujian:
    - Autentikasi (registrasi, token verifikasi, login salah, rate limit).
    - Validasi hak akses (otorisasi data pribadi agar tidak bocor ke user lain).
    - Perhitungan analitik & formula KPI.
  - Tambahkan script `"test": "node --test"` di `package.json`.
- [ ] **5.3 Konfigurasi Deployment Server (VPS / Cloud)**
  - Buat berkas `ecosystem.config.js` untuk menjalankan proses Node.js dengan **PM2** di latar belakang:
    - Auto restart jika server mengalami crash.
    - Manajemen log aplikasi.
  - Jika deploy menggunakan Docker, buat `Dockerfile` dan `docker-compose.yml` dengan persistent volume pada folder `data/`.
  - Pasang reverse proxy (Caddy atau Nginx) untuk mengelola sertifikat SSL/HTTPS gratis (Let's Encrypt).
  - Aktifkan flag produksi di `.env`:
    ```ini
    HOST=0.0.0.0
    APP_URL=https://domain-anda.com
    COOKIE_SECURE=1
    TRUST_PROXY=1
    ```
- [ ] **5.4 Monitoring & Error Tracking**
  - Buat endpoint health check sederhana (`GET /api/health`).
  - Tambahkan pencatatan error yang rapi untuk menangkap kegagalan pengiriman email atau webhook Telegram.

**File Terkait:**
* `package.json`
* `.env`
* `ecosystem.config.js` / `Dockerfile`
* `server/index.js`

---

## Ringkasan Matriks Prioritas Kerja

| No | Modul / Pekerjaan | Estimasi Kompleksitas | Tingkat Prioritas |
|---|---|---|---|
| 1 | Pengisian kredensial `.env` (Google, SMTP, Telegram, Admin) | Rendah (Hanya konfigurasi) | P0 (Segera) |
| 2 | Inisialisasi Git & Remote Repository | Rendah | P0 (Segera) |
| 3 | Modal Edit & Hapus Task di Frontend Kanban | Rendah - Sedang | P1 (Tinggi) |
| 4 | Modal Edit & Hapus Project di Dashboard | Rendah | P1 (Tinggi) |
| 5 | Alur Lupa Password & Ganti Password | Sedang | P1 (Tinggi) |
| 6 | Skrip Otomasi Backup SQLite & Deploy PM2/HTTPS | Sedang | P2 (Penting) |
| 7 | Detail Task: Deskripsi, Checklist, Komentar | Sedang | P2 (Penting) |
| 8 | Chat Grup per Project & Pengiriman File | Sedang - Tinggi | P3 (Pengembangan) |
| 9 | Transaksi Berulang & Multi-Dompet Ruang Pribadi | Sedang | P3 (Pengembangan) |
| 10 | Pengujian Otomatis (CI / Test Runner) | Sedang | P3 (Pengembangan) |
