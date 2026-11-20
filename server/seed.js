'use strict';
/* Optional demo data: `npm run seed`. Creates 8 demo users (shared demo password) + projects/tasks/events/chat. Refuses to run on a non-empty DB. */
const core = require('./core');
const { run, one, tx, now, today, addDays, hashPw } = core;
const DAY = 864e5;
let seedN = 7; const rnd = () => { seedN |= 0; seedN = seedN + 0x6D2B79F5 | 0; let t = Math.imul(seedN ^ seedN >>> 15, 1 | seedN); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

(async () => {
  if (one('SELECT COUNT(*) c FROM users').c) { console.log('Database sudah berisi data. Hapus data/luki.db untuk seed ulang.'); return; }
  const pw = process.env.SEED_PASSWORD || 'demo12345', hash = await hashPw(pw);
  const U = [['Noah Castell', 'noah', 'Project Lead', 'Management', 'Jakarta'], ['Priya Raman', 'priya', 'Product Designer', 'Design', 'Lisbon'], ['Mateo Silva', 'mateo', 'Backend Engineer', 'Engineering', 'Sao Paulo'], ['Hana Kobayashi', 'hana', 'Frontend Engineer', 'Engineering', 'Osaka'],
    ['Owen Mercer', 'owen', 'Frontend Developer', 'Engineering', 'Berlin'], ['Sofia Sato', 'sofia', 'QA Engineer', 'Engineering', 'Tokyo'], ['Maya Kovac', 'maya', 'Brand Designer', 'Design', 'Zagreb'], ['Liam Reyes', 'liam', 'Marketing Lead', 'Marketing', 'Manila']];
  const names = ['Billing Portal', 'Onboarding Emails', 'Analytics Pipeline', 'Help Center', 'Admin Console', 'Partner API', 'Brand Refresh', 'Pricing Page', 'Data Warehouse', 'Notifications v2', 'Mobile Auth', 'Release Tooling', 'SSO Rollout', 'Docs Revamp', 'Performance Budget', 'A11y Audit', 'Referral Program', 'Status Page', 'Internal Wiki', 'Payments API v2', 'Mobile Onboarding', 'Design System Audit', 'Search Revamp', 'Q4 Launch Site'];
  const TPL = [['Kickoff and scope', 'Marketing'], ['Design mockups', 'Design'], ['Implementation', 'Frontend'], ['API endpoints', 'Backend'], ['QA regression pass', 'QA'], ['Stakeholder demo', 'Marketing'], ['Release notes', 'Marketing'], ['Performance tuning', 'Frontend']];
  tx(() => {
    U.forEach(([n, e, r, d, l], i) => run('INSERT INTO users(name,email,pass_hash,role,division,location,created_at,email_verified,is_admin,budget) VALUES(?,?,?,?,?,?,?,1,?,?)', n, `${e}@luki.app`, hash, r, d, l, now() - (120 - i * 9) * DAY, i ? 0 : 1, i ? 0 : 5000000));
    // personal space samples for Noah (user 1)
    const P = (kind, o) => run('INSERT INTO personal(user_id,kind,title,body,amount,category,date,date2,url,status,priority,color,pinned,remind_at,created_at) VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      kind, o.title, o.body || '', o.amount ?? null, o.category ?? null, o.date ?? null, o.date2 ?? null, o.url ?? null, o.status ?? null, o.priority ?? null, o.color ?? null, o.pinned ? 1 : 0, o.remind ?? null, now());
    const T = today(), mStart = T.slice(0, 8) + '01', inMonth = d => { const x = addDays(T, d); return x < mStart ? mStart : x; };
    [['Gaji bulanan', 'income', 8500000, 'Gaji', -16], ['Freelance landing page', 'income', 1500000, 'Freelance', -6], ['Makan siang', 'expense', 25000, 'Makan & Minum', 0], ['Transport kantor', 'expense', 40000, 'Transport', -1],
      ['Listrik & internet', 'expense', 650000, 'Tagihan', -10], ['Belanja bulanan', 'expense', 1200000, 'Belanja', -8], ['Nonton bioskop', 'expense', 100000, 'Hiburan', -3], ['Vitamin', 'expense', 150000, 'Kesehatan', -5], ['Kursus online', 'expense', 450000, 'Pendidikan', -12]]
      .forEach(([title, status, amount, category, d]) => P('tx', { title, status, amount, category, date: inMonth(d) }));
    [['Gaji bulan lalu', 'income', 8500000, 'Gaji'], ['Belanja bulan lalu', 'expense', 1500000, 'Belanja']].forEach(([title, status, amount, category]) => P('tx', { title, status, amount, category, date: addDays(mStart, -10) }));
    P('note', { title: 'Ide project sampingan', body: 'Aplikasi pencatat resep keluarga.\n- Login Google\n- Foto resep\n- Daftar belanja otomatis', color: 'blue', pinned: 1 });
    P('note', { title: 'Password wifi kantor?', body: 'Tanya ke tim IT hari Senin.', color: 'yellow', remind: now() + 2 * 3600e3 });
    P('note', { title: 'Buku yang ingin dibaca', body: 'Atomic Habits\nDeep Work\nThe Pragmatic Programmer', color: 'green' });
    [['Bayar BPJS', 2, 'High', 'Tagihan'], ['Servis motor', 5, 'Medium', 'Rumah'], ['Perpanjang SIM', 12, 'Low', 'Dokumen'], ['Beli kado ulang tahun Ibu', 7, 'High', 'Keluarga']]
      .forEach(([title, d, priority, category]) => P('ptask', { title, date: addDays(T, d), priority, category, status: 'todo' }));
    P('ptask', { title: 'Daftar ulang gym', date: addDays(T, -3), priority: 'Low', status: 'done' });
    P('wish', { title: 'Mechanical keyboard', amount: 1350000, priority: 'High', url: 'https://example.com/keyboard', status: 'want' });
    P('wish', { title: 'Sepatu lari', amount: 900000, priority: 'Medium', date: addDays(T, 30), status: 'want' });
    P('wish', { title: 'Headphone ANC', amount: 2500000, priority: 'Low', status: 'bought' });
    P('trip', { title: 'Bali', date: addDays(T, 7), date2: addDays(T, 11), amount: 6000000, body: 'Tiket pesawat sudah dibeli\nHotel di Ubud\nSewa motor', status: 'planned' });
    P('trip', { title: 'Yogyakarta', date: addDays(T, 45), date2: addDays(T, 48), amount: 2500000, status: 'planned' });
    const uid = () => between(1, 8);
    names.forEach((name, i) => {
      const ended = i < 10, pending = i >= 22, owner = (i % 8) + 1;
      const created = now() - (ended ? between(70, 120) : pending ? 2 : between(15, 50)) * DAY;
      const completed = ended ? created + between(14, 55) * DAY : null;
      const due = ended ? addDays(today(), Math.round((completed - now()) / DAY) + between(-6, 4)) : addDays(today(), pending ? between(25, 40) : [3, 7, 2, 12, 20, 9, 30, 5, 14, 1, 25, 18][i % 12]);
      const p = run('INSERT INTO projects(name,due,status,owner_id,created_at,completed_at) VALUES(?,?,?,?,?,?)', name, due, ended ? 'ended' : pending ? 'pending' : 'running', owner, created, completed).lastInsertRowid;
      run('INSERT INTO activity(user_id,project_id,text,created_at) VALUES(?,?,?,?)', owner, p, `${U[owner - 1][0]} membuat project "${name}"`, created);
      const k = pending ? 2 : between(3, 5);
      for (let j = 0; j < k; j++) {
        const [title, tag] = TPL[(i + j * 3) % TPL.length];
        const doneT = ended || (!pending && rnd() < .45);
        const stage = doneT ? 'done' : pending ? 'todo' : pick(['todo', 'progress', 'progress', 'review']);
        const cAt = doneT ? Math.round(completed ? created + rnd() * (completed - created) : now() - between(0, 38) * DAY - rnd() * DAY) : null;
        const tdue = doneT ? addDays(today(), Math.round(((cAt || now()) - now()) / DAY) + between(-2, 3)) : addDays(today(), [1, 2, 3, 7, 5, 9, 12, 4, 15][(i + j) % 9]);
        const t = run('INSERT INTO tasks(project_id,title,tag,prio,stage,due,prog,created_by,created_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?)', p, title, tag, pick(['High', 'Medium', 'Medium', 'Low']), stage, tdue, { todo: 0, progress: 50, review: 90, done: 100 }[stage], owner, (cAt || now()) - between(2, 10) * DAY, cAt).lastInsertRowid;
        const who = new Set([uid(), rnd() < .4 ? uid() : 0].filter(Boolean));
        who.forEach(w => run('INSERT INTO task_assignees(task_id,user_id) VALUES(?,?)', t, w));
        if (doneT) { const w = [...who][0]; run('INSERT INTO time_entries(user_id,project_id,seconds,started_at) VALUES(?,?,?,?)', w, p, between(1, 6) * 3600, cAt); run('INSERT INTO activity(user_id,project_id,text,created_at) VALUES(?,?,?,?)', w, p, `${U[w - 1][0]} memindahkan "${title}" ke Done`, cAt); }
      }
    });
    [['Daily stand-up', 0, '10:00', 'team'], ['Check-in with Halcyon Labs', 0, '14:00', 'meeting'], ['Design review - auth flow', 1, '11:00', 'review'], ['Sprint planning', 2, '09:30', 'meeting'], ['Roadmap sync', 4, '13:00', 'meeting'], ['Retro and learnings', 7, '16:00', 'team'], ['Investor update', 9, '10:00', 'social'], ['Brand shoot', 14, '09:00', 'social']]
      .forEach(([t, d, tm, ty]) => run('INSERT INTO events(title,date,time,type,created_by) VALUES(?,?,?,?,?)', t, addDays(today(), d), tm, ty, 1));
    [[2, 1, 'Hi Noah, design login screens are ready for review.', 50], [1, 2, 'Great, I will check them this afternoon.', 45], [2, 1, 'Thanks! Ping me if anything is unclear.', 40]]
      .forEach(([f, t, b, m]) => run('INSERT INTO messages(from_id,to_id,body,created_at,read_at) VALUES(?,?,?,?,?)', f, t, b, now() - m * 6e4, f === 1 ? now() : null));
  });
  console.log(`Seed selesai. Login demo: noah@luki.app / ${pw} (juga priya, mateo, hana, owen, sofia, maya, liam @luki.app).`);
})();
