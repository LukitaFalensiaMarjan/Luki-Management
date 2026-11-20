'use strict';
/* Admin page: workspace stats, signups, broadcast, user management. Server enforces admin rights; this only renders. */
let ADM = null, AF = 'all';
LOADERS.admin = async () => { ADM = S.me.admin ? await api('GET', '/api/admin/overview') : null; };

function vAdmin() {
  if (!S.me.admin || !ADM) return head('Admin', 'Halaman ini khusus admin.') + '<div class="empty">Kamu tidak punya akses admin.</div>';
  const { stats: s, signups, users } = ADM, me = S.me.id;
  const cards = [['Total user', s.users, `${s.google} via Google`, 1], ['Terverifikasi', s.verified, `${s.users - s.verified} belum verifikasi`], ['Online sekarang', s.online, `${s.disabled} akun nonaktif`], ['Terhubung Telegram', s.telegram, `${s.admins} admin`],
    ['Projects', s.projects, 'semua project'], ['Tasks', s.tasks, 'semua task'], ['Pesan chat', s.messages, 'total pesan'], ['Item pribadi', s.personal, 'isi tidak bisa dilihat admin']];
  const mx = Math.max(1, ...signups);
  const F = { all: () => true, unverified: u => !u.verified, disabled: u => u.disabled, admin: u => u.admin, google: u => u.google };
  const rows = users.filter(u => F[AF](u) && hasQ(`${u.name} ${u.email}`.toLowerCase()));
  const tabs = [['all', 'Semua'], ['unverified', 'Belum verifikasi'], ['disabled', 'Nonaktif'], ['admin', 'Admin'], ['google', 'Google']].map(([k, l]) => `<button class="tab ${AF === k ? 'on' : ''}" data-act="af" data-k="${k}">${l} ${users.filter(F[k]).length}</button>`).join('');
  const st = u => u.disabled ? '<span class="pill s-pending">Nonaktif</span>' : u.verified ? '<span class="pill s-ended">Aktif</span>' : '<span class="pill s-running">Belum verifikasi</span>';
  const btn = (id, f, v, l, cls = '') => `<button class="btn sm ${cls}" data-act="adm-set" data-id="${id}" data-f="${f}" data-v="${v}">${l}</button>`;
  const tr = u => `<tr><td data-label="User"><div class="ucell">${av(u)}<span><b>${esc(u.name)}${u.id === me ? ' <small class="mut">(kamu)</small>' : ''}</b><small>${esc(u.email)}</small></span></div></td>
    <td data-label="Status">${st(u)}${u.admin ? ' <span class="pill rep">Admin</span>' : ''}</td>
    <td data-label="Login">${u.google ? 'Google' : 'Email'}${u.tg ? ' · Telegram' : ''}</td>
    <td data-label="Terakhir aktif">${u.on ? '<span class="on-dot"></span>Online' : u.lastLogin ? ago(u.lastLogin) : '—'}</td>
    <td data-label="Bergabung">${short(iso(new Date(u.createdAt)))}</td>
    <td data-label="Aksi" class="acts-c">${u.id === me ? '<small class="mut">—</small>' : `${u.verified ? '' : btn(u.id, 'verified', 1, 'Verifikasi')}${btn(u.id, 'admin', u.admin ? 0 : 1, u.admin ? 'Cabut admin' : 'Jadikan admin')}${btn(u.id, 'disabled', u.disabled ? 0 : 1, u.disabled ? 'Aktifkan' : 'Nonaktifkan')}<button class="btn sm danger" data-act="adm-del" data-id="${u.id}">${ic('trash')}</button>`}</td></tr>`;
  return head('Admin', 'Kelola user dan pantau workspace.', `<button class="btn" data-act="adm-reload">${ic('refresh')}Muat ulang</button>`) +
  `<div class="grid g4 mb">${cards.map(([t, v, sub, on]) => `<div class="card stat ${on ? 'on' : ''}"><h4>${t}</h4><div class="n sm">${fmtN(v)}</div><small>${sub}</small></div>`).join('')}</div>
  <div class="grid g21 mb"><div class="card"><h3>Pendaftaran 30 hari terakhir <small class="mut">${signups.reduce((a, b) => a + b, 0)} user</small></h3><div class="sbars">${signups.map((c, i) => `<i style="height:${Math.max(4, c / mx * 100)}%" title="${short(off(i - 29))}: ${c}"></i>`).join('')}</div><div class="sb-l"><span>${short(off(-29))}</span><span>Hari ini</span></div></div>
  <div class="card"><h3>Kirim pengumuman</h3><p class="mut" style="font-size:12px;margin-bottom:10px">Dikirim ke semua user aktif lewat notifikasi aplikasi dan Telegram.</p><textarea class="in" id="bc" maxlength="500" placeholder="Tulis pengumuman…"></textarea><div class="fa" style="margin-top:10px"><button class="btn primary" data-act="adm-bc">${ic('send')}Kirim</button></div></div></div>
  <div class="tabs">${tabs}<span class="cnt">${rows.length} user</span></div>
  <div class="card tblw"><table class="tbl"><thead><tr><th>User</th><th>Status</th><th>Login</th><th>Terakhir aktif</th><th>Bergabung</th><th>Aksi</th></tr></thead><tbody>${rows.map(tr).join('') || '<tr><td colspan="6" class="mut">Tidak ada user.</td></tr>'}</tbody></table></div>`;
}
ROUTES.admin = [vAdmin, 'Admin', 'Cari user (nama atau email)'];

const admReload = async msg => { try { await LOADERS.admin(); READY.admin = true; paint(false); if (msg) toast(msg); } catch (e) { if (e.message !== 'auth') toast(e.message); } };
Object.assign(ACT, {
  af: b => { AF = b.dataset.k; paint(false); },
  'adm-reload': () => admReload('Data admin dimuat ulang'),
  'adm-set': async b => {
    const { id, f, v } = b.dataset;
    try { await api('PATCH', '/api/admin/users/' + id, { [f]: v === '1' }); await admReload({ verified: 'User diverifikasi', admin: v === '1' ? 'User dijadikan admin' : 'Hak admin dicabut', disabled: v === '1' ? 'Akun dinonaktifkan' : 'Akun diaktifkan' }[f]); }
    catch (e) { if (e.message !== 'auth') toast(e.message); }
  },
  'adm-del': b => { const u = ADM.users.find(x => x.id === +b.dataset.id);
    layer('modal', `${modalHead('Hapus user?')}<p style="font-size:13px;line-height:1.5"><b>${esc(u.name)}</b> (${esc(u.email)}) akan dihapus permanen beserta chat, notifikasi, dan data pribadinya. Project miliknya tetap ada tanpa owner. Tindakan ini tidak bisa dibatalkan.</p><div class="fa"><button class="btn" data-act="close">Batal</button><button class="btn primary danger-bg" data-act="adm-del-ok" data-id="${u.id}">Hapus permanen</button></div>`); },
  'adm-del-ok': async b => { try { await api('DELETE', '/api/admin/users/' + b.dataset.id); closeLayer(); await load(); await admReload('User dihapus'); } catch (e) { if (e.message !== 'auth') toast(e.message); } },
  'adm-bc': async () => { const t = $('#bc'), text = t.value.trim(); if (!text) return toast('Tulis pengumuman dulu');
    try { const r = await api('POST', '/api/admin/broadcast', { text }); t.value = ''; toast(`Pengumuman dikirim ke ${r.sent} user`); } catch (e) { if (e.message !== 'auth') toast(e.message); } },
});
