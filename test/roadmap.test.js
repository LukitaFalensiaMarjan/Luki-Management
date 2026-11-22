const http = require('http');
const crypto = require('crypto');
const { db } = require('../server/core');
const { sha, COOKIE } = require('../server/http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let parsed = null;
        try { parsed = JSON.parse(raw.toString('utf8')); } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          raw,
          text: raw.toString('utf8'),
          json: () => parsed
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== START INTEGRATION TESTS FOR ROADMAP FEATURES ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Health check (Pilar 5)
  try {
    const res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/health',
      method: 'GET'
    });
    const data = res.json();
    assert(res.statusCode === 200 && data.status === 'ok' && typeof data.uptime === 'number', 'GET /api/health returns 200 with status ok and uptime');
  } catch (err) {
    assert(false, `Health check error: ${err.message}`);
  }

  // Setup user session for user 9
  const sid = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha(sid);
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(tokenHash, 9, now + 30 * 86400000);

  const authHeaders = {
    'Cookie': `luki_sid=${sid}`,
    'x-luki': '1',
    'Content-Type': 'application/json'
  };

  // 2. Personal Finance: Multi-wallet & Recurring (Pilar 4.4, 4.5)
  try {
    // Add income in Bank
    let res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/personal',
      method: 'POST',
      headers: authHeaders
    }, {
      kind: 'tx',
      title: 'Gaji Pokok November',
      status: 'income',
      amount: 1500000,
      category: 'Gaji',
      date: '2026-11-22',
      wallet: 'bank',
      recurring: 'monthly',
      body: 'Gaji bulanan masuk rekening'
    });
    assert(res.statusCode === 201, 'POST /api/personal creates income with wallet=bank and recurring=monthly');
    const incomeTx = res.json();
    assert(incomeTx && incomeTx.wallet === 'bank' && incomeTx.recurring === 'monthly', 'Created income has wallet=bank and recurring=monthly');

    // Transfer from bank to ewallet
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/personal/transfer',
      method: 'POST',
      headers: authHeaders
    }, {
      fromWallet: 'bank',
      toWallet: 'ewallet',
      amount: 250000,
      date: '2026-11-22',
      body: 'Top up Gopay bulanan'
    });
    assert(res.statusCode === 201, 'POST /api/personal/transfer creates atomic transfer');
    const transferResult = res.json();
    assert(transferResult.ok && transferResult.outId && transferResult.inId, 'Transfer returns outId and inId confirmation');

    // Verify list of personal items
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/personal',
      method: 'GET',
      headers: authHeaders
    });
    const items = res.json();
    assert(Array.isArray(items), 'GET /api/personal returns array of personal records');
    const transferOut = items.find(t => t.kind === 'tx' && t.title.includes('Transfer ke E-Wallet'));
    const transferIn = items.find(t => t.kind === 'tx' && t.title.includes('Transfer dari Rekening Bank'));
    assert(!!transferOut && !!transferIn, 'Found both transfer-out and transfer-in linked records in personal database');

    // 3. Finance Export CSV (Pilar 4.6)
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/personal/export?format=csv',
      method: 'GET',
      headers: authHeaders
    });
    assert(res.statusCode === 200, 'GET /api/personal/export?format=csv returns 200');
    assert(res.headers['content-type'].includes('text/csv'), 'CSV Content-Type is text/csv');
    assert(res.text.includes('Tanggal,Judul,Kategori,Dompet,Jenis'), 'CSV has correct Indonesian column headers');
    assert(res.text.includes('Top up Gopay bulanan'), 'CSV contains transfer transaction note');

    // 4. Finance Export PDF (Pilar 4.6)
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/personal/export?format=pdf',
      method: 'GET',
      headers: authHeaders
    });
    assert(res.statusCode === 200, 'GET /api/personal/export?format=pdf returns 200');
    assert(res.headers['content-type'].includes('application/pdf'), 'PDF Content-Type is application/pdf');
    assert(res.raw.slice(0, 4).toString('ascii') === '%PDF', 'PDF buffer starts with %PDF magic header');

  } catch (err) {
    assert(false, `Finance & Export test error: ${err.message}`);
  }

  // 5. Travel Planner (Packing List & Itinerary) (Pilar 4.7)
  try {
    const tripPayload = {
      kind: 'trip',
      title: 'Labuan Bajo 2026',
      date: '2026-12-15',
      date_end: '2026-12-20',
      amount: 5000000,
      body: JSON.stringify({
        notes: 'Liburan akhir tahun bersama tim',
        packingList: [
          { id: 'p1', item: 'Kamera DSLR', packed: true },
          { id: 'p2', item: 'Baju Renang', packed: false },
          { id: 'p3', item: 'Sunblock & Obat', packed: false }
        ],
        itinerary: [
          { day: 'Hari 1', agenda: 'Tiba di Komodo Airport, check-in hotel' },
          { day: 'Hari 2', agenda: 'Island hopping: Pulau Padar & Pink Beach' }
        ]
      })
    };

    let res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/personal',
      method: 'POST',
      headers: authHeaders
    }, tripPayload);
    assert(res.statusCode === 201, 'POST /api/personal creates trip record');
    const createdTrip = res.json();
    assert(createdTrip.tripData && createdTrip.tripData.packingList && createdTrip.tripData.packingList.length === 3, 'Created trip has parsed packingList with 3 items');
    assert(createdTrip.tripData && createdTrip.tripData.itinerary && createdTrip.tripData.itinerary.length === 2, 'Created trip has parsed itinerary with 2 items');

    // Update trip packing toggle
    const updatedTripData = { ...createdTrip.tripData };
    updatedTripData.packingList[1].packed = true;
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/personal/${createdTrip.id}`,
      method: 'PATCH',
      headers: authHeaders
    }, {
      body: JSON.stringify(updatedTripData)
    });
    assert(res.statusCode === 200, 'PATCH /api/personal/:id updates trip packing list status');
    const patchedTrip = res.json();
    assert(patchedTrip.tripData.packingList[1].packed === true, 'Trip packing list item #2 is now marked packed');

  } catch (err) {
    assert(false, `Travel Planner test error: ${err.message}`);
  }

  // 6. Channel Chat (#team:1 and #project) (Pilar 4.2)
  try {
    // Post to team:1
    let res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/messages/channel/team:1',
      method: 'POST',
      headers: authHeaders
    }, {
      body: 'Halo anggota Luki Core Team, fitur roadmap pilar 4 sudah aktif!'
    });
    assert(res.statusCode === 200 || res.statusCode === 201, 'POST /api/messages/channel/team:1 posts channel message');
    const postedMsg = res.json();
    assert(postedMsg && postedMsg.channel === 'team:1' && postedMsg.body.includes('pilar 4'), 'Returned message confirms channel team:1');

    // Get messages from team:1
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/messages/channel/team:1',
      method: 'GET',
      headers: authHeaders
    });
    assert(res.statusCode === 200, 'GET /api/messages/channel/team:1 returns 200');
    const msgs = res.json();
    assert(Array.isArray(msgs) && msgs.some(m => m.id === postedMsg.id), 'Channel message list contains our posted message');

    // Post reply to the message (WhatsApp-style quote reply test)
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/messages/channel/team:1',
      method: 'POST',
      headers: authHeaders
    }, {
      body: 'Ini balasan dari pesan sebelumnya!',
      replyToId: postedMsg.id
    });
    assert(res.statusCode === 200 || res.statusCode === 201, 'POST /api/messages/channel/team:1 with replyToId returns 201');
    const replyMsg = res.json();
    assert(replyMsg && replyMsg.reply_to_id === postedMsg.id && replyMsg.reply_body.includes('pilar 4'), 'Reply message carries correct reply_to_id and reply_body metadata');
  } catch (err) {
    assert(false, `Channel chat test error: ${err.message}`);
  }

  // 7. Session Management (Pilar 3.5)
  try {
    // Insert dummy second session for user 9
    const dummySid = crypto.randomBytes(32).toString('base64url');
    const dummyHash = sha(dummySid);
    db.prepare(`
      INSERT INTO sessions (token_hash, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(dummyHash, 9, now + 30 * 86400000);

    // List sessions
    let res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/me/sessions',
      method: 'GET',
      headers: authHeaders
    });
    assert(res.statusCode === 200, 'GET /api/me/sessions returns 200');
    const sessList = res.json();
    assert(Array.isArray(sessList) && sessList.length >= 2, 'Sessions list contains current and second dummy session');
    const cur = sessList.find(s => s.isCurrent);
    assert(!!cur, 'Current session correctly flagged with isCurrent: true');

    // Logout others
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/me/sessions/logout-others',
      method: 'POST',
      headers: authHeaders
    }, {});
    assert(res.statusCode === 200, 'POST /api/me/sessions/logout-others returns 200');

    // Verify dummy session is gone
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/me/sessions',
      method: 'GET',
      headers: authHeaders
    });
    const updatedSess = res.json();
    assert(updatedSess.length === 1 && updatedSess[0].isCurrent, 'Only current session remains after logout-others');

  } catch (err) {
    assert(false, `Session management test error: ${err.message}`);
  }

  // 6. File Upload & Serve Test (Option 2)
  try {
    const sampleContent = 'Hello LUKI attachment test file!';
    const base64Data = 'data:text/plain;base64,' + Buffer.from(sampleContent).toString('base64');
    let res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/upload',
      method: 'POST',
      headers: authHeaders
    }, {
      name: 'luki-notes.txt',
      data: base64Data
    });

    assert(res.statusCode === 200, 'POST /api/upload returns 200');
    const upData = res.json();
    assert(upData && upData.ok && upData.url.startsWith('/uploads/'), 'Upload response returns valid /uploads/ URL');

    // Fetch the uploaded file back
    res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: upData.url,
      method: 'GET'
    });
    assert(res.statusCode === 200, `GET ${upData.url} serves static uploaded file with 200`);
    assert(res.text === sampleContent, 'Served file content matches uploaded bytes');
  } catch (err) {
    assert(false, `File upload test error: ${err.message}`);
  }

  // 7. Backup script verification (Option 1)
  try {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const out = execSync('node --disable-warning=ExperimentalWarning scripts/backup.js', { encoding: 'utf8' });
    assert(out.includes('[BACKUP SUCCESS]'), 'scripts/backup.js completes and outputs [BACKUP SUCCESS]');
    const files = fs.readdirSync('data/backups');
    assert(files.length > 0 && files.some(f => f.startsWith('luki-backup-')), 'Backup directory contains created SQLite snapshot');
  } catch (err) {
    assert(false, `Backup script test error: ${err.message}`);
  }

  console.log(`\n=== FINAL RESULT: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
