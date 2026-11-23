---
title: Luki Management
emoji: 📋
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# LUKI MANAGEMENT

Kelola kerja tim (project, kanban, kalender, analitik, chat, laporan PDF) dan kehidupan pribadi (keuangan, catatan, tugas, wishlist, travel) dalam satu aplikasi web, dengan pengingat via Telegram.

```bash
npm install
cp .env.example .env   # lalu isi
npm start              # http://localhost:3000
```

Data contoh (database kosong saja): `npm run seed` → login `noah@luki.app` / `demo12345`.

Dokumentasi lengkap — fitur, cara dapat API key (Google, SMTP, Telegram), isi `.env`, deploy, rencana, dan rekomendasi fitur: **[DOKUMENTASI.md](DOKUMENTASI.md)**.

Daftar checklist pekerjaan & rencana pengembangan yang belum selesai: **[ROADMAP.md](ROADMAP.md)**.
