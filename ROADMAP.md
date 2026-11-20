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
> **Status Saat Ini:** Kode backend sudah siap, namun variabel di file `.env` masih kosong sehingga fitur berjalan dalam mode lokal/terbatas.

### Checklist Pekerjaan
- [ ] **1.1 Konfigurasi Email SMTP (Nodemailer)**
  - Masukkan kredensial SMTP di `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
  - *Dampak:* Saat ini email verifikasi registrasi hanya dicetak di terminal server. Setelah diisi, tautan aktivasi akan terkirim langsung ke kotak masuk pengguna asli.
- [ ] **1.2 Konfigurasi Google OAuth 2.0 (PKCE)**
  - Buat project di Google Cloud Console -> Credentials -> OAuth 2.0 Client ID (Web Application).
  - Daftarkan Authorized redirect URI: `http://localhost:3000/api/auth/google/callback` (dan domain produksi saat online).
  - Masukkan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` ke `.env`.
  - *Dampak:* Tombol "Lanjut dengan Google" di landing page akan otomatis muncul.
- [ ] **1.3 Konfigurasi Bot Telegram**
  - Buat bot baru di Telegram melalui `@BotFather` (perintah `/newbot`) dan ambil tokennya.
  - Masukkan `TELEGRAM_BOT_TOKEN` dan tentukan `REMINDER_HOUR` di `.env`.
  - Daftarkan perintah bot via `@BotFather` (`/setcommands`): `deadline`, `catat`, `masuk`, `stop`.
  - *Dampak:* Polling bot akan aktif, pengingat deadline otomatis terkirim, dan user dapat mencatat pengeluaran langsung dari chat.
- [ ] **1.4 Penetapan Akses Admin Akun Utama**
  - Tambahkan email pemilik akun di baris `.env`: `ADMIN_EMAILS=nanolukii17@gmail.com`.
  - *Dampak:* Saat server menyala, akun tersebut otomatis mendapatkan peran Admin (`is_admin = 1`).
- [ ] **1.5 Inisialisasi Version Control Git**
  - Jalankan `git init` di root project.
  - Pastikan `.gitignore` tetap mengecualikan `node_modules/`, `data/`, `.env`, dan `*.log`.
  - Buat commit awal (*initial commit*) dan hubungkan ke remote repository (GitHub / GitLab / Bitbucket).

**File Terkait:**
* `.env`
* `server/mail.js`
* `server/telegram.js`
* `server/core.js`

---

## Pilar 2: Penyempurnaan Fungsional & Antarmuka Pengguna (UI/UX)

> **Prioritas:** Tinggi  
> **Status Saat Ini:** Backend REST API sudah menyediakan rute lengkap untuk pembaruan data (`PATCH`), namun antarmuka frontend belum menyediakan modal/tombol untuk aksi edit.

### Checklist Pekerjaan
- [ ] **2.1 Modal & Form Edit Task (Papan Kanban)**
  - Di file `public/app.js`, tambahkan opsi `"Edit"` pada menu kartu task (`data-act="menu"`).
  - Buat fungsi modal form edit task dengan nilai awal terisi (*pre-filled*):
    - Judul Task
    - Project Terkait
    - Tag / Kategori
    - Prioritas (High, Medium, Low)
    - Target Selesai (*Due date*)
    - Penugasan Anggota (*Assignees*)
  - Hubungkan submit form ke API `PATCH /api/tasks/:id`.
- [ ] **2.2 Modal Edit & Hapus Project di Dashboard**
  - Di daftar project pada Dashboard, tambahkan tombol aksi menu (titik tiga atau ikon pensil/tempat sampah) untuk owner project / admin.
  - Sediakan modal untuk mengubah nama project dan target tanggal selesai (*due date*).
  - Sediakan tombol konfirmasi hapus project yang memanggil API `DELETE /api/projects/:id`.
- [ ] **2.3 Fitur Edit Jadwal / Event Kalender**
  - Pada tampilan kalender (`vCal`), saat event diklik, sediakan opsi untuk mengedit waktu, judul, dan tipe event selain tombol hapus yang sudah ada.
  - Tambahkan endpoint `PATCH /api/events/:id` di `server/index.js` untuk mendukung pembaruan jadwal event.
- [ ] **2.4 Drag & Drop di Layar Sentuh / Mobile UX**
  - Optimalkan interaksi pemindahan kartu kanban pada perangkat seluler atau sediakan tombol geser cepat antar kolom tanpa harus membuka menu dropdown.

**File Terkait:**
* `public/app.js` (fungsi `vTasks`, `vDash`, `vCal`, objek aksi `ACT`)
* `server/index.js` (endpoint `/api/tasks/:id`, `/api/projects/:id`, `/api/events/:id`)

---

## Pilar 3: Fitur Akun, Keamanan, & Manajemen Pengguna

> **Prioritas:** Sedang - Tinggi  
> **Status Saat Ini:** Alur login dan registrasi sudah berjalan dengan verifikasi email, namun alur pemulihan akun (lupa password) dan pengelolaan keamanan profil belum lengkap.

### Checklist Pekerjaan
- [ ] **3.1 Fitur Lupa Kata Sandi (Forgot / Reset Password)**
  - *Backend:*
    - Buat tabel atau kolom token reset password (`reset_hash`, `reset_exp`) di database SQLite.
    - Endpoint `POST /api/auth/forgot-password`: Menerima email, membuat token acak berbatas waktu (misal 1 jam), dan mengirimkan email berisi tautan reset via Nodemailer.
    - Endpoint `POST /api/auth/reset-password`: Menerima token dan password baru, memvalidasi masa berlaku, lalu memperbarui hash password (`scrypt`).
  - *Frontend:*
    - Tambahkan tombol "Lupa kata sandi?" di form login landing page.
    - Buat tampilan input email pemulihan dan halaman/modal untuk memasukkan password baru.
- [ ] **3.2 Fitur Ganti Password di Menu Pengaturan (Settings)**
  - Tambahkan tab baru **"Security"** atau bagian khusus di halaman `#/settings`.
  - Sediakan form: Password Lama, Password Baru (minimal 8 karakter), dan Konfirmasi Password Baru.
  - Buat endpoint `POST /api/me/change-password` di backend dengan validasi password lama menggunakan `verifyPw`.
- [ ] **3.3 Fitur Hapus Akun Sendiri (Self Account Deletion)**
  - Sediakan tombol *"Hapus Akun"* di pengaturan akun pengguna dengan konfirmasi modal ganda (memasukkan password akun sebelum penghapusan diproses).
  - Buat endpoint `DELETE /api/me` yang menghapus sesi, data pribadi, dan menonaktifkan/menghapus user terkait.
- [ ] **3.4 Manajemen Sesi Aktif & Logout Seluruh Perangkat**
  - Tampilkan daftar sesi perangkat yang sedang aktif di tab Security.
  - Sediakan opsi *"Keluar dari semua perangkat lain"* (`DELETE FROM sessions WHERE user_id=? AND token_hash!=?`).

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
- [ ] **4.1 Modal Detail Task & Kolaborasi**
  - Tambahkan kolom `description` pada tabel `tasks`.
  - Buat drawer atau modal detail task yang menampilkan deskripsi lengkap, linimasa aktivitas task, dan status pengerjaan.
  - **Sub-task / Checklist:** Kemampuan memecah task besar menjadi beberapa checklist item yang bisa dicentang satu per satu.
  - **Diskusi / Komentar Task:** Kolom komentar di dalam task agar anggota yang ditugaskan dapat mendiskusikan progres.
- [ ] **4.2 Chat Tim Berbasis Grup / Channel Project**
  - Buat tabel database untuk grup obrolan (`channels` dan `channel_members`).
  - Sediakan channel bawaan untuk setiap project yang dibuat (misal: `#project-billing-portal`).
  - Izinkan anggota project berdiskusi bersama, bukan hanya lewat pesan privat (1-on-1).
- [ ] **4.3 Multi-Workspace / Pembagian Tim (Opsional)**
  - Menambahkan konsep `workspaces` atau `organizations` jika di masa depan aplikasi ingin digunakan oleh lebih dari satu perusahaan/tim tanpa saling melihat project tim lain.

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
