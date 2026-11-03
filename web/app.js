/* MEDİGROUP Sifariş və Anbar İzləmə */
'use strict';
const AUTH_LINK = (() => { const h = new URLSearchParams(location.hash.slice(1)); return h.get('access_token') ? (h.get('type') || 'link') : null; })();
let needPassword = AUTH_LINK === 'invite' || AUTH_LINK === 'recovery';
const sb = supabase.createClient(window.APP_CONFIG.url, window.APP_CONFIG.key);
const $app = document.getElementById('app');
const state = { user: null, products: null, customers: null };

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => '₼ ' + Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(',', '.');
// qiymət: 2–4 onluq rəqəm (lazım olduğu qədər); məbləğlər həmişə 2 rəqəm
const p4 = v => Math.round(Number(v || 0) * 10000) / 10000;
const moneyP = v => '₼ ' + Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).replace(',', '.');
const money0 = v => '₼ ' + Math.round(Number(v || 0)).toLocaleString('ru-RU');
const qtyf = v => Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 3 });
const dfmt = d => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('ru-RU'); };
// tarix + saat (yalnız ekranda; çap formalarında saat yoxdur). 1C-dən gələnlərdə saat bilinmir — yalnız tarix
const tfmt = x => { if (!x) return ''; const t = new Date(x); return isNaN(t) ? '' : t.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Baku', hour: '2-digit', minute: '2-digit' }); };
const dtfmt = (d, at) => dfmt(d) + (at ? ' <span class="tm">' + tfmt(at) + '</span>' : '');
// sənəd siyahısı üçün yaranma vaxtları (tətbiqdə yaradılan sənədlər)
async function docTimes(rows) {
  const m = new Map(); const app = rows.filter(x => x.doc && x.doc !== '—' && !/^MGP/.test(x.doc));
  const grp = [['sales_lines', 'doc', ['SQ', 'QA']], ['purchase_lines', 'doc', ['AQ', 'QT']], ['ledger', 'doc_no', ['PM', 'PX']]];
  const jobs = [];
  for (const [tb, col, ts] of grp) { const docs = [...new Set(app.filter(x => ts.includes(x.typ)).map(x => x.doc))];
    for (let i = 0; i < docs.length; i += 50) jobs.push(sb.from(tb).select(`${col},created_at`).in(col, docs.slice(i, i + 50)).order('created_at').then(({ data }) => (data || []).forEach(r => { if (!m.has(r[col])) m.set(r[col], r.created_at); }))); }
  await Promise.all(jobs); return m;
}
const today = () => new Date().toISOString().slice(0, 10);
const norm = s => String(s || '').toLocaleLowerCase('az').replace(/i̇/g, 'i').replace(/\s+/g, ' ').trim();
function toast(msg, err) { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 3200); }
function fail(e) { console.error(e); toast('Xəta: ' + (e?.message || e), true); }
async function fetchAll(make) {
  const out = []; const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await make().range(from, from + step - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < step) return out;
  }
}
async function loadProducts(force) { if (!state.products || force) state.products = await fetchAll(() => sb.from('v_products').select('*').order('name').order('id')); return state.products; }
async function loadCustomers(force) { if (!state.customers || force) state.customers = await fetchAll(() => sb.from('v_customers').select('*').order('name').order('id')); return state.customers; }
function invalidate() { state.products = null; state.customers = null; }

const ICON = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  doc: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
};
const ico = (n, s = 22) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

const ORDER_STEPS = [['teklif', 'Təklif'], ['tesdiq', 'Təsdiqləndi'], ['sifaris', 'Tədarükçüdən sifariş'], ['catdirildi', 'Çatdırıldı']];
const ORDER_LABEL = { teklif: 'Qaralama', tesdiq: 'Qaralama', sifaris: 'Qaralama', catdirildi: 'Qaimə keçirilib', legv: 'Ləğv edildi' };
const ORDER_TAG = { teklif: 't-blue', tesdiq: 't-blue', sifaris: 't-blue', catdirildi: 't-ok', legv: 't-grey' };
const STOCK = {
  normal: ['Normal', 't-ok', 'var(--ok-bar)'],
  qirmizi: ['Azalır', 't-red', 'var(--red-bar)'],
  bitib_tecili: ['BİTİB', 't-urgent', 'var(--yellow)'],
  bitib: ['Bitib', 't-grey', '#A9B4BF'],
  menfi: ['Mənfi qalıq', 't-warn', 'var(--warn)']
};
const MOVE = { baslangic: 'Başlanğıc qalıq', medaxil: 'Mədaxil', satis: 'Satış', qaytarma_alici: 'Alıcıdan qaytarma', qaytarma_tedarukcu: 'Tədarükçüyə qaytarma', duzelis: 'Düzəliş' };
const LEDGER = { kohne: 'Köhnə borc', baslangic: 'Başlanğıc saldo', satis: 'Satış', odenis: 'Ödəniş', duzelis: 'Düzəliş', alis: 'Alış (tədarükçüdən)', tediye: 'Tədarükçüyə ödəniş' };
const BTYPE = { borclu: ['Bizə borcludur', 't-brand'], biz_borcluyuq: ['Biz borcluyuq', 't-violet'], avans: ['Avans', 't-blue'], menfi: ['Mənfi saldo', 't-grey'] };

function stockTag(p) {
  const s = STOCK[p.status] || STOCK.normal;
  const label = p.status === 'qirmizi' ? `${p.pct}% · Azalır` : (p.status === 'normal' && p.pct != null ? `${p.pct}%` : s[0]);
  return `<span class="tag ${s[1]}">${esc(label)}</span>`;
}
function stockBar(p) {
  const s = STOCK[p.status] || STOCK.normal;
  const w = p.pct == null ? (p.qty > 0 ? 100 : 0) : Math.max(0, Math.min(100, p.pct));
  return `<div class="bar"><i style="width:${w}%;background:${s[2]}"></i></div>`;
}

/* ---------- shell ---------- */
const NAV = [['panel', 'Panel', 'home'], ['sifarisler', 'Sifarişlər', 'list'], ['senedler', 'Sənədlər', 'doc'], ['anbar', 'Anbar', 'box'], ['musteriler', 'Müştərilər', 'users'], ['odenisler', 'Ödənişlər', 'card'], ['hesabatlar', 'Hesabat', 'chart']];
// mobil alt menyuya sığmayanlar — «Daha» səhifəsində
const MORE = [['hesabatlar', 'Hesabat', 'chart'], ['teklifler', 'Qiymət təklifləri', 'doc'], ['muqavileler', 'Müqavilələr və sənədlər', 'doc'], ['hesab', 'Hesab və şifrə', 'users']];
async function viewMore() {
  const al = await alerts();
  mount('daha', `<h1>Daha</h1><section class="card tight"><div class="list">${MORE.map(([k, l, i]) => `<a class="li" href="#${k}"><span style="color:var(--brand)">${ico(i)}</span><span class="m"><span class="t">${l}</span></span></a>`).join('')}</div></section>
    <div class="row"><span class="note">${esc(state.user?.email || '')}</span><button class="btn" id="logout2">Çıxış</button></div>`, al);
}
function shell(active, body, alerts = {}) {
  const side = NAV.map(([k, l]) => `<a href="#${k}" class="${k === active ? 'on' : ''}">${l}${alerts[k] ? `<span class="badge">${alerts[k]}</span>` : ''}</a>`).join('');
  const moreOn = active === 'daha' || MORE.some(m => m[0] === active);
  const bottom = NAV.filter(([k]) => k !== 'hesabatlar').map(([k, l, i]) => `<a href="#${k}" class="${k === active ? 'on' : ''}">${ico(i)}${l}${alerts[k] ? '<span class="dot"></span>' : ''}</a>`).join('')
    + `<a href="#daha" class="${moreOn ? 'on' : ''}">${ico('more')}Daha</a>`;
  return `<div class="shell">
    <aside class="side"><div class="brand"><b>MEDİGROUP</b><span>Sifariş və anbar izləmə</span></div>
      <nav aria-label="Əsas menyu">${side}<a href="#teklifler" class="${active === 'teklifler' ? 'on' : ''}">Qiymət təklifləri</a><a href="#muqavileler" class="${active === 'muqavileler' ? 'on' : ''}">Müqavilələr və sənədlər</a></nav>
      <div class="who"><span>${esc(state.user?.email)}</span><a href="#hesab" class="acc">${isAdmin() ? 'Hesab və istifadəçilər' : 'Hesab / şifrəni dəyiş'}</a><button id="logout">Çıxış</button></div></aside>
    <main class="main"><div class="wrap">${body}</div></main>
    <nav class="bottom" aria-label="Əsas menyu">${bottom}</nav></div>`;
}
let alertCache = null;
async function alerts() {
  if (alertCache) return alertCache;
  const [p, c] = await Promise.all([loadProducts(), loadCustomers()]);
  alertCache = { anbar: p.filter(x => x.status === 'qirmizi' || x.status === 'bitib_tecili').length, odenisler: c.filter(x => x.overdue >= 1).length };
  return alertCache;
}
function mount(active, body, al) {
  $app.innerHTML = shell(active, body, al);
  azInputs($app);
  document.querySelectorAll('#logout,#logout2').forEach(b => b.onclick = async () => { await sb.auth.signOut(); });
}
const ADMIN_EMAIL = 'bashirov@medigroup.az';
const isAdmin = () => (state.user?.email || '').toLowerCase() === ADMIN_EMAIL;

/* ---------- Azərbaycan dilində tarix seçimi və fayl düyməsi (telefonun dilindən asılı olmadan) ---------- */
const AZ_AY = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const AZ_GUN = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'];
const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const azD = v => v ? v.slice(8, 10) + '.' + v.slice(5, 7) + '.' + v.slice(0, 4) : '';
let calOpen = null;
document.addEventListener('click', e => { if (calOpen && !calOpen.contains(e.target) && !e.target.closest('.dbtn')) { calOpen.remove(); calOpen = null; } });
function azInputs(root) {
  root.querySelectorAll('input[type="date"]').forEach(inp => {
    inp.type = 'hidden';
    const wrap = document.createElement('div'); wrap.className = 'dwrap';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'inp dbtn';
    const show = () => { btn.innerHTML = `<span class="${inp.value ? '' : 'ph'}">${inp.value ? azD(inp.value) : 'gün.ay.il'}</span>${ico('cal', 18)}`; };
    show(); inp.after(wrap); wrap.append(inp, btn);
    const set = v => { inp.value = v; show(); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };
    btn.onclick = e => {
      e.preventDefault();
      if (calOpen) { const was = calOpen.parentNode === wrap; calOpen.remove(); calOpen = null; if (was) return; }
      let cur = inp.value ? new Date(inp.value + 'T12:00:00') : new Date(); cur.setDate(1);
      const cal = document.createElement('div'); cal.className = 'cal';
      const draw = () => {
        const y = cur.getFullYear(), m = cur.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate(), t = today();
        let cells = ''; for (let i = 0; i < first; i++) cells += '<span></span>';
        for (let d = 1; d <= days; d++) { const v = isoD(new Date(y, m, d)); cells += `<button type="button" data-v="${v}" class="${v === inp.value ? 'on' : ''} ${v === t ? 'td' : ''}">${d}</button>`; }
        cal.innerHTML = `<div class="ch"><button type="button" data-n="-1">‹</button><b>${AZ_AY[m]} ${y}</b><button type="button" data-n="1">›</button></div>
          <div class="cg">${AZ_GUN.map(g => `<i>${g}</i>`).join('')}${cells}</div>
          <div class="cf"><button type="button" data-v="${t}">Bu gün</button><button type="button" data-v="">Təmizlə</button></div>`;
      };
      cal.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.n) { cur.setMonth(cur.getMonth() + +b.dataset.n); draw(); return; }
        if ('v' in b.dataset) { set(b.dataset.v); cal.remove(); calOpen = null; }
      };
      draw(); wrap.append(cal); calOpen = cal;
      const r = cal.getBoundingClientRect(); if (r.right > innerWidth - 8) cal.style.left = Math.round(innerWidth - 8 - r.right) + 'px';
    };
  });
  root.querySelectorAll('input[type="file"]').forEach(inp => {
    if (inp.dataset.az) return; inp.dataset.az = 1; inp.classList.add('fhide');
    const lab = document.createElement('label'); lab.className = 'fpick';
    const nm = document.createElement('span'); nm.textContent = 'Fayl seçilməyib';
    lab.innerHTML = '<span class="btn">Fayl seç</span>'; lab.append(nm);
    inp.after(lab); lab.prepend(inp);
    inp.addEventListener('change', () => { nm.textContent = inp.files[0]?.name || 'Fayl seçilməyib'; });
  });
}

/* ---------- login ---------- */
function renderLogin(msg) {
  $app.innerHTML = `<div class="login"><form id="lf">
    <div class="logo">MEDİGROUP<span>Sifariş və anbar izləmə</span></div>
    <label class="f">E-poçt<input class="inp" type="email" name="email" autocomplete="username" required></label>
    <label class="f">Şifrə<input class="inp" type="password" name="password" autocomplete="current-password" required></label>
    ${msg ? `<div class="warnbox">${esc(msg)}</div>` : ''}
    <button class="btn p" type="submit">Daxil ol</button>
    <button class="btn" type="button" id="forgot">Şifrəni unutmusunuz?</button></form></div>`;
  document.getElementById('lf').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    if (error) renderLogin('E-poçt və ya şifrə səhvdir.');
  };
  document.getElementById('forgot').onclick = async () => {
    const email = document.querySelector('[name=email]').value.trim();
    if (!email) return toast('Əvvəlcə e-poçtunuzu yazın', true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) return fail(error);
    toast('Şifrə yeniləmə linki e-poçtunuza göndərildi');
  };
}
function renderSetPassword() {
  $app.innerHTML = `<div class="login"><form id="pf">
    <div class="logo">MEDİGROUP<span>Xoş gəlmisiniz! Özünüz üçün şifrə təyin edin.</span></div>
    <div class="note">${esc(state.user?.email || '')}</div>
    <label class="f">Yeni şifrə (ən azı 8 simvol)<input class="inp" type="password" name="p1" minlength="8" autocomplete="new-password" required></label>
    <label class="f">Şifrəni təkrarlayın<input class="inp" type="password" name="p2" minlength="8" autocomplete="new-password" required></label>
    <button class="btn p" type="submit">Şifrəni saxla</button></form></div>`;
  document.getElementById('pf').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    if (f.get('p1') !== f.get('p2')) return toast('Şifrələr eyni deyil', true);
    const { error } = await sb.auth.updateUser({ password: f.get('p1') });
    if (error) return fail(error);
    needPassword = false; toast('Şifrə saxlanıldı'); location.hash = '#panel'; route();
  };
}

/* ---------- picker (search dropdown) ---------- */
function picker(el, items, label, onPick) {
  const inp = el.querySelector('input'); const dd = document.createElement('div'); dd.className = 'dd'; dd.hidden = true; el.appendChild(dd);
  const show = () => {
    const q = norm(inp.value); if (!q) { dd.hidden = true; return; }
    const res = items.filter(x => x._s.includes(q)).slice(0, 30);
    dd.innerHTML = res.length ? res.map((x, i) => `<button type="button" data-i="${i}">${label(x)}</button>`).join('') : '<div class="empty">Tapılmadı</div>';
    dd.querySelectorAll('button').forEach(b => b.onclick = () => { dd.hidden = true; onPick(res[+b.dataset.i]); });
    dd.hidden = false;
  };
  inp.addEventListener('input', show); inp.addEventListener('focus', show);
  document.addEventListener('click', e => { if (!el.contains(e.target)) dd.hidden = true; });
}
const withSearch = arr => arr.map(x => (x._s ??= norm(`${x.name} ${x.code ?? ''} ${x.article ?? ''}`), x));

/* ---------- PANEL ---------- */
async function viewPanel() {
  const [p, c, al] = await Promise.all([loadProducts(), loadCustomers(), alerts()]);
  const monthStart = today().slice(0, 8) + '01';
  const [{ data: orders }, rep] = await Promise.all([
    sb.from('v_orders').select('*').in('status', ['teklif', 'tesdiq', 'sifaris']).order('created_at', { ascending: false }),
    reportData(monthStart, today(), null)
  ]);
  const red = p.filter(x => x.status === 'qirmizi'), urgent = p.filter(x => x.status === 'bitib_tecili').sort((a, b) => b.sold_12m - a.sold_12m);
  const late = c.filter(x => x.overdue >= 1).sort((a, b) => b.overdue - a.overdue);
  const overdue = late.reduce((s, x) => s + Number(x.overdue), 0);
  const recv = c.filter(x => x.balance >= 1).reduce((s, x) => s + Number(x.balance), 0);
  const monthSales = rep.salesTotal;
  const AZ_WD = ['bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə'];
  const nowD = new Date(), d = `${azDateLong(today())}, ${AZ_WD[nowD.getDay()]}`;
  const alertRows = [
    ...late.slice(0, 5).map(x => `<a class="li" href="#musteri/${x.id}"><span class="dotc" style="background:var(--red-bar)"></span><span class="m"><span class="t">Ödəniş gecikir · ${x.max_late} gün</span><span class="d">${esc(x.name)}</span></span><span class="amt">${money0(x.overdue)}</span></a>`),
    ...urgent.slice(0, 5).map(x => `<a class="li urgent" href="#mehsul/${x.id}"><span class="dotc" style="background:var(--yellow)"></span><span class="m"><span class="t">${esc(x.name)}</span><span class="d">BİTİB · son 12 ayda ${qtyf(x.sold_12m)} ${esc(x.unit)} satılıb</span></span></a>`),
    ...red.slice(0, 5).map(x => `<a class="li" href="#mehsul/${x.id}"><span class="dotc" style="background:var(--red-bar)"></span><span class="m"><span class="t">${esc(x.name)}</span><span class="d">${qtyf(x.qty)} / ${qtyf(x.base_qty)} ${esc(x.unit)} · ${x.pct}%${x.days_left != null ? ` · ~${x.days_left} günə bitər` : ''}</span></span></a>`)
  ].join('');
  mount('panel', `
    <div class="head"><div><h1>Panel</h1><div class="sub">${esc(d)}</div></div></div>
    <div class="kpis">
      <a class="kpi brand" href="#sifarisler"><span class="l">Keçirilməmiş sifarişlər</span><span class="v">${orders?.length || 0}</span><span class="s">qaralama</span></a>
      <a class="kpi ${overdue >= 1 ? 'red' : ''}" href="#odenisler"><span class="l">Gecikən ödəniş</span><span class="v">${money0(overdue)}</span><span class="s">${late.length} müştəri · cəmi alınacaq ${money0(recv)}</span></a>
      <a class="kpi ${al.anbar ? 'red' : ''}" href="#anbar"><span class="l">Anbar xəbərdarlığı</span><span class="v">${al.anbar} məhsul</span><span class="s">${red.length} azalır · ${urgent.length} bitib</span></a>
      <a class="kpi" href="#hesabatlar"><span class="l">Bu ay satış</span><span class="v">${money0(monthSales)}</span><span class="s">ödənilib: ${money0(rep.paidIn)} · hesabata bax</span></a>
    </div>
    <div class="grid2">
      <section class="card tight"><div class="card" style="border:0;padding-bottom:8px"><h2>Diqqət tələb edir</h2></div><div class="list">${alertRows || '<div class="empty">Hər şey qaydasındadır</div>'}</div></section>
      <section class="card tight"><div class="card" style="border:0;padding-bottom:8px"><div class="head"><h2>Keçirilməmiş sifarişlər</h2><a href="#sifarisler">Hamısı</a></div></div>
        <div class="list">${(orders || []).slice(0, 8).map(orderRow).join('') || '<div class="empty">Keçirilməmiş sifariş yoxdur.</div>'}</div></section>
    </div>
    <div class="accbar"><span>${esc(state.user?.email || '')}</span><a class="btn" href="#hesab">${isAdmin() ? 'Hesab və istifadəçilər' : 'Şifrəni dəyiş'}</a><button class="btn" id="logout2">Çıxış</button></div>`, al);
}
function orderRow(o) {
  return `<a class="li" href="#sifaris/${o.id}"><span class="m"><span class="d">${esc(o.no)} · ${dtfmt(o.order_date, o.created_at)}</span><span class="t">${esc(o.customer_name)}</span></span>
    <span class="r"><span class="tag ${ORDER_TAG[o.status]}">${ORDER_LABEL[o.status]}</span><span class="amt">${money(o.total)}</span>${o.open_amount > 0.005 ? `<span class="d" style="color:var(--red)">ödənilməyib ${money0(o.open_amount)}</span>` : ''}</span></a>`;
}

/* ---------- SİFARİŞLƏR ---------- */
async function viewOrders(params) {
  const f = params.get('f') || 'hamisi'; const q = params.get('q') || ''; const d1 = params.get('from') || ''; const d2 = params.get('to') || '';
  if (f === '1c') return viewOrders1C(f, q, d1, d2);
  let qb = sb.from('v_orders').select('*').order('created_at', { ascending: false }).limit(500);
  if (f === 'qaralama') qb = qb.in('status', ['teklif', 'tesdiq', 'sifaris']);
  else if (f === 'hamisi') qb = qb.neq('status', 'legv');
  else qb = qb.eq('status', f);
  if (d1) qb = qb.gte('order_date', d1);
  if (d2) qb = qb.lte('order_date', d2);
  const [{ data, error }, al] = await Promise.all([qb, alerts()]); if (error) throw error;
  const rows = (data || []).filter(o => !q || norm(o.customer_name + ' ' + o.no).includes(norm(q)));
  const total = rows.filter(o => o.status !== 'legv').reduce((s, o) => s + Number(o.total), 0);
  const hq = o => '#sifarisler?' + new URLSearchParams(Object.fromEntries(Object.entries({ f, q, from: d1, to: d2, ...o }).filter(([, v]) => v))).toString();
  const chips = ORDER_CHIPS;
  mount('sifarisler', `
    <div class="head"><div><h1>Sifarişlər</h1><div class="sub">${rows.length} sifariş · cəmi ${money0(total)}</div></div><a class="btn p" href="#yeni-sifaris">+ Yeni sifariş</a></div>
    <div class="fgrid" style="align-items:end">
      <label class="f" style="grid-column:span 2">Müştəri və ya nömrə<input class="inp" id="q" type="search" placeholder="Ad yazın…" value="${esc(q)}"></label>
      <label class="f">Tarixdən<input class="inp" type="date" id="d1" value="${d1}"></label>
      <label class="f">Tarixədək<input class="inp" type="date" id="d2" value="${d2}"></label>
      <div class="row"><button class="btn p" id="go">Göstər</button>${q || d1 || d2 ? `<a class="btn" href="#sifarisler?f=${f}">Təmizlə</a>` : ''}</div>
    </div>
    <div class="chips">${chips.map(([k, l]) => `<a class="chip ${k === f ? 'on' : ''}" href="${hq({ f: k })}">${l}</a>`).join('')}</div>
    <section class="card tight"><div class="list">${rows.map(orderRow).join('') || '<div class="empty">Sifariş yoxdur</div>'}</div></section>`, al);
  const go = () => location.hash = hq({ q: document.getElementById('q').value.trim(), from: document.getElementById('d1').value, to: document.getElementById('d2').value });
  document.getElementById('go').onclick = go; document.getElementById('q').onkeydown = e => { if (e.key === 'Enter') go(); };
}

const ORDER_CHIPS = [['hamisi', 'Hamısı'], ['qaralama', 'Qaralama'], ['catdirildi', 'Qaimə keçirilib'], ['legv', 'Ləğv edilən'], ['1c', '1C arxivi (2023–16.10.2026)']];
// 1C-dən köçürülmüş alıcı sifarişləri — yalnız baxış; anbar və borca təsir etmir
async function viewOrders1C(f, q, d1, d2) {
  const qq = q.replace(/[,()*]/g, ' ').trim();
  const [data, al] = await Promise.all([fetchAll(() => {
    let qb = sb.from('orders_1c').select('*').order('order_date', { ascending: false }).order('doc', { ascending: false });
    if (d1) qb = qb.gte('order_date', d1); if (d2) qb = qb.lte('order_date', d2);
    if (qq) qb = qb.or(`customer_name.ilike.*${qq}*,doc.ilike.*${qq}*,invoice_doc.ilike.*${qq}*`);
    return qb;
  }), alerts()]);
  const sum = data.reduce((t, o) => t + Number(o.amount), 0), linked = data.filter(o => o.invoice_doc).length;
  const hq = o => '#sifarisler?' + new URLSearchParams(Object.fromEntries(Object.entries({ f, q, from: d1, to: d2, ...o }).filter(([, v]) => v))).toString();
  const row = o => { const inv = '#sifaris1c/' + o.id;
    return `<${inv ? `a href="${inv}"` : 'div'} class="li"><span class="m"><span class="d"><b>${esc(o.doc)}</b> · ${dfmt(o.order_date)} <span class="tag t-grey">1C</span></span><span class="t">${esc(o.customer_name)}</span></span>
      <span class="r"><span class="amt">${money(o.amount)}</span>${o.invoice_doc ? `<span class="tag t-ok">qaimə ${esc(o.invoice_doc)} · ${dfmt(o.invoice_date)}</span>` : '<span class="tag t-grey">qaiməsiz</span>'}</span></${inv ? 'a' : 'div'}>`; };
  const lim = 200;
  mount('sifarisler', `
    <div class="head"><div><h1>Sifarişlər</h1><div class="sub">1C arxivi · ${data.length} sifariş · cəmi ${money0(sum)} · ${linked} qaiməyə bağlı</div></div><a class="btn p" href="#yeni-sifaris">+ Yeni sifariş</a></div>
    <div class="fgrid" style="align-items:end">
      <label class="f" style="grid-column:span 2">Müştəri, sifariş və ya qaimə №<input class="inp" id="q" type="search" placeholder="Ad və ya nömrə yazın…" value="${esc(q)}"></label>
      <label class="f">Tarixdən<input class="inp" type="date" id="d1" value="${d1}"></label>
      <label class="f">Tarixədək<input class="inp" type="date" id="d2" value="${d2}"></label>
      <div class="row"><button class="btn p" id="go">Göstər</button>${q || d1 || d2 ? `<a class="btn" href="#sifarisler?f=1c">Təmizlə</a>` : ''}</div>
    </div>
    <div class="chips">${ORDER_CHIPS.map(([k, l]) => `<a class="chip ${k === f ? 'on' : ''}" href="${hq({ f: k })}">${l}</a>`).join('')}</div>
    <div class="note">1C-dən köçürülmüş alıcı sifarişləri (yalnız baxmaq üçün): məhsullar, göndərilən və qalan miqdar, bağlı satış qaiməsi. Anbar qalığına və borclara təsir etmir.</div>
    <section class="card tight"><div class="list">${data.slice(0, lim).map(row).join('') || '<div class="empty">Sifariş tapılmadı</div>'}</div>
    ${data.length > lim ? `<div class="more"><button class="btn sm" id="more">Daha çox (${data.length - lim})</button></div>` : ''}</section>`, al);
  let shown = lim; const mb = document.getElementById('more');
  if (mb) mb.onclick = () => { const list = mb.closest('section').querySelector('.list'); list.insertAdjacentHTML('beforeend', data.slice(shown, shown + 200).map(row).join('')); shown += 200; if (shown >= data.length) mb.parentElement.remove(); else mb.textContent = `Daha çox (${data.length - shown})`; };
  const go = () => location.hash = hq({ q: document.getElementById('q').value.trim(), from: document.getElementById('d1').value, to: document.getElementById('d2').value });
  document.getElementById('go').onclick = go; document.getElementById('q').onkeydown = e => { if (e.key === 'Enter') go(); };
}

async function viewOrder1C(id) {
  const [{ data: o, error }, { data: ls, error: e2 }, al] = await Promise.all([
    sb.from('orders_1c').select('*').eq('id', id).maybeSingle(), sb.from('orders_1c_lines').select('*').eq('order_id', id).order('id'), alerts()]);
  if (error || e2) throw error || e2;
  const back = `<a class="back" href="#sifarisler?f=1c">${ico('back', 16)} 1C sifarişləri</a>`;
  if (!o) { mount('sifarisler', back + '<div class="empty">Sifariş tapılmadı</div>', al); return; }
  const inv = o.invoice_doc ? '#sened?' + new URLSearchParams({ t: 'SQ', d: o.invoice_doc, y: o.invoice_yr, p: o.customer_id ?? '' }) : '';
  const open = (ls || []).reduce((t, l) => t + Number(l.open_qty), 0);
  mount('sifarisler', back + `<div class="head"><div><h1>Sifariş ${esc(o.doc)} <span class="tag t-grey">1C</span></h1><div class="sub">${dfmt(o.order_date)} · ${o.customer_id ? `<a href="#musteri/${o.customer_id}">${esc(o.customer_name)}</a>` : esc(o.customer_name)}</div></div>
      <div class="row">${inv ? `<a class="btn p" href="${inv}">Satış qaiməsi ${esc(o.invoice_doc)}</a>` : '<span class="tag t-grey">qaiməyə bağlanmayıb</span>'}</div></div>
    ${open > 0 ? `<div class="warnbox">Bu sifarişin bir hissəsi 1C-də göndərilməyib (qalıq ${qtyf(open)}).</div>` : ''}
    <section class="card tight"><div class="scroll"><table class="t"><thead><tr><th>№</th><th>Məhsul</th><th class="n">Sifariş</th><th class="n">Göndərilib</th><th class="n">Qalıq</th><th class="n">Məbləğ</th></tr></thead><tbody>
      ${(ls || []).map((l, i) => `<tr><td>${i + 1}</td><td>${l.product_id ? `<a href="#mehsul/${l.product_id}">${esc(l.product_name)}</a>` : esc(l.product_name)}</td><td class="n">${qtyf(l.qty)} ${esc(l.unit || '')}</td><td class="n">${qtyf(l.shipped_qty)}</td><td class="n" style="${Number(l.open_qty) > 0 ? 'color:var(--red);font-weight:600' : ''}">${qtyf(l.open_qty)}</td><td class="n amt">${money(l.amount)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Məhsul sətirləri yüklənməyib</td></tr>'}
    </tbody><tfoot><tr><td></td><td><b>Cəmi</b></td><td></td><td></td><td></td><td class="n amt"><b>${money(o.amount)}</b></td></tr></tfoot></table></div></section>`, al);
}

async function viewNewOrder() {
  const [c, al] = await Promise.all([loadCustomers(), alerts()]);
  mount('sifarisler', `<a class="back" href="#sifarisler">${ico('back', 16)} Sifarişlər</a>
    <h1>Yeni sifariş</h1>
    <section class="card"><label class="f">Müştəri<div class="pick" id="cp"><input class="inp" placeholder="Müştəri adını yazın…" autocomplete="off"></div></label>
    <div id="chosen" class="note">Müştəri seçilməyib</div>
    <label class="f">ƏDV<select class="inp" id="vat"><option value="18">ƏDV 18% (qiymətin üstünə gəlir)</option><option value="0">ƏDV-siz</option></select></label>
    <label class="f">Qeyd<textarea class="inp" id="note"></textarea></label>
    <div class="row"><button class="btn p" id="create" disabled>Sifarişi yarat</button><a class="btn" href="#musteri-yeni">+ Yeni müştəri</a></div></section>`, al);
  let cust = null;
  picker(document.getElementById('cp'), withSearch(c.filter(x => x.is_buyer)), x => `<span>${esc(x.name)}</span><small>${x.balance >= 1 ? 'borc ' + money0(x.balance) : ''}</small>`, x => {
    cust = x; document.querySelector('#cp input').value = x.name; document.getElementById('chosen').textContent = 'Seçildi: ' + x.name; document.getElementById('create').disabled = false;
  });
  document.getElementById('create').onclick = async () => {
    const { data, error } = await sb.from('orders').insert({ customer_id: cust.id, vat_rate: +document.getElementById('vat').value, note: document.getElementById('note').value || null }).select().single();
    if (error) return fail(error);
    location.hash = '#sifaris/' + data.id;
  };
}

async function viewOrder(id) {
  const [{ data: o, error }, { data: items }, { data: open }, p, al] = await Promise.all([
    sb.from('v_orders').select('*').eq('id', id).single(),
    sb.from('order_items').select('*').eq('order_id', id).order('id'),
    sb.from('v_open_items').select('*').eq('order_id', id),
    loadProducts(), alerts()]);
  if (error) throw error;
  const pm = new Map(p.map(x => [x.id, x]));
  const locked = o.status === 'catdirildi' || o.status === 'legv';
  const next = !locked;
  const openAmt = (open || []).reduce((s, x) => s + Number(x.open_amount), 0);
  const need = new Map(); for (const i of items || []) need.set(i.product_id, (need.get(i.product_id) || 0) + Number(i.qty));
  const short = [...need].filter(([k, q]) => { const pr = pm.get(k); return pr && pr.kind !== 'xidmət' && Number(pr.qty) < q; }).map(([k, q]) => ({ product_id: k, qty: q }));
  mount('sifarisler', `<a class="back" href="#sifarisler">${ico('back', 16)} Sifarişlər</a>
    <div class="head"><div><h1>Sifariş ${esc(o.no)}</h1><div class="sub">${dtfmt(o.order_date, o.created_at)} · <a href="#musteri/${o.customer_id}">${esc(o.customer_name)}</a></div></div>
      <div class="row"><span class="tag ${ORDER_TAG[o.status]}">${ORDER_LABEL[o.status]}</span>${(items || []).length && o.status !== 'legv' ? docBtns('order=' + o.id) + `<a class="btn" href="#muqavile/yeni?order=${o.id}">Müqavilə</a>` : ''}${(items || []).length ? `<a class="btn" href="#qaime/${o.id}">${ico('print', 16)} ${o.invoice_code ? 'Qaimə ' + o.invoice_code : 'Qaimə (ilkin)'}</a>` : ''}</div></div>
    <section class="card"><h2>Status</h2>
      ${o.status === 'legv' ? '<div class="note">Bu sifariş ləğv edilib.</div>' : ''}
      ${next ? `<div class="fgrid"><label class="f">Qaimə tarixi<input class="inp" type="date" id="ddt" value="${today()}"></label></div>
        <div class="note">«Qaiməni keçir» basanda qaiməyə SQ nömrəsi veriləcək, məhsullar anbardan çıxılacaq və müştərinin borcu yaranacaq (ödəniş müddəti 30 gün). Səhv olarsa, keçirildikdən sonra «Keçirməni geri al» ilə düzəldilir.</div>${short.length ? `<div class="errbox">Anbarda kifayət qədər yoxdur — qaimə keçirilə bilməz: ${short.map(i => `${esc(pm.get(i.product_id)?.name)} (qalıq ${qtyf(pm.get(i.product_id)?.qty)}, lazım ${qtyf(i.qty)})`).join(', ')}. Əvvəl mal mədaxilini vurun və ya miqdarı azaldın.</div>` : ''}
        <div class="row"><button class="btn p" id="next" ${short.length ? 'disabled' : ''}>Qaiməni keçir</button><button class="btn danger" id="cancel">Ləğv et</button></div>` : ''}
      ${o.status === 'catdirildi' ? `<dl class="kv"><dt>Qaimə</dt><dd><b>${esc(o.invoice_code || '')}</b> · ${dfmt(o.delivered_at)}</dd><dt>Ödəniş müddəti</dt><dd>${dfmt(o.due_date)}</dd><dt>Ödənilməyib</dt><dd class="amt" style="color:${openAmt > 0.005 ? 'var(--red)' : 'var(--ok)'}">${openAmt > 0.005 ? money(openAmt) : 'Ödənilib'}</dd></dl>
        <div class="row"><a class="btn" href="#qaytarma?t=QA&p=${o.customer_id}&base=${encodeURIComponent(o.invoice_code || '')}&y=${String(o.delivered_at || '').slice(0, 4)}">Alıcıdan qaytarma</a><button class="btn danger" id="unpost">Keçirməni geri al (düzəliş / ləğv)</button></div>` : ''}
      ${!locked && o.invoice_code ? `<div class="warnbox">Qaimə ${esc(o.invoice_code)} düzəliş rejimindədir: mal anbara qaytarılıb, borc silinib. Düzəlişdən sonra «Qaiməni keçir» basın — nömrə eyni qalacaq. Satış ümumiyyətlə olmayıbsa, «Ləğv et» basın.</div>` : ''}
    </section>
    <section class="card"><h2>Məhsullar</h2>
      <div class="scroll"><table class="t"><thead><tr><th>Məhsul</th><th class="n">Miqdar</th><th class="n">Qiymət</th><th class="n">Cəmi</th><th class="n">Anbarda</th>${locked ? '' : '<th></th>'}</tr></thead><tbody>
      ${(items || []).map(i => { const pr = pm.get(i.product_id) || {}; return `<tr><td>${esc(pr.name)}<div class="note">kod ${esc(pr.code ?? '')}</div></td><td class="n">${qtyf(i.qty)}</td><td class="n">${moneyP(i.price)}</td><td class="n amt">${money(i.qty * i.price)}</td><td class="n">${stockTag(pr)} ${qtyf(pr.qty)}</td>${locked ? '' : `<td class="n"><button class="btn sm" data-del="${i.id}" aria-label="Sil">Sil</button></td>`}</tr>`; }).join('') || `<tr><td colspan="6" class="empty">Məhsul əlavə edilməyib</td></tr>`}
      </tbody><tfoot>
        <tr><td colspan="3">Cəmi (ƏDV-siz)</td><td class="n">${money(o.subtotal)}</td><td colspan="2"></td></tr>
        <tr><td colspan="3">${Number(o.vat_rate) ? 'ƏDV ' + Number(o.vat_rate) + '%' : 'ƏDV-siz'}${locked ? '' : ` <select class="inp sm" id="vat" style="width:auto;height:32px;margin-left:8px"><option value="18" ${Number(o.vat_rate) === 18 ? 'selected' : ''}>18%</option><option value="0" ${Number(o.vat_rate) === 0 ? 'selected' : ''}>ƏDV-siz</option></select>`}</td><td class="n">${money(o.vat_amount)}</td><td colspan="2"></td></tr>
        <tr><td colspan="3"><b>Yekun</b></td><td class="n amt"><b>${money(o.total)}</b></td><td colspan="2"></td></tr></tfoot></table></div>
      ${locked ? '' : `<div class="fgrid" style="align-items:end">
        <label class="f" style="grid-column:span 2">Məhsul əlavə et<div class="pick" id="pp"><input class="inp" placeholder="Ad, kod və ya artikul…" autocomplete="off"></div></label>
        <label class="f">Miqdar<input class="inp" id="iq" type="number" min="0" step="any" value="1"></label>
        <label class="f">Qiymət, ƏDV-siz (₼)<input class="inp" id="ip" type="number" min="0" step="0.0001" value="0"></label>
        <button class="btn p" id="add" disabled>Əlavə et</button></div>`}
    </section>
    ${o.note ? `<section class="card"><h2>Qeyd</h2><p style="margin:0">${esc(o.note)}</p></section>` : ''}`, al);
  let prod = null;
  if (!locked) {
    picker(document.getElementById('pp'), withSearch(p), x => `<span>${esc(x.name)} <small>kod ${esc(x.code ?? '')}</small></span><small${x.kind !== 'xidmət' && !(x.qty > 0) ? ' style="color:var(--red)"' : ''}>${x.kind === 'xidmət' ? 'xidmət' : qtyf(x.qty) + ' ' + esc(x.unit)}</small>`, x => {
      if (x.kind !== 'xidmət' && !(Number(x.qty) > 0)) { document.querySelector('#pp input').value = ''; return toast(`«${x.name}» anbarda yoxdur (qalıq ${qtyf(x.qty)}). Əvvəl mal mədaxilini vurun.`, true); }
      prod = x; document.querySelector('#pp input').value = x.name; document.getElementById('add').disabled = false; document.getElementById('iq').focus();
    });
    document.getElementById('add').onclick = async () => {
      const qty = +document.getElementById('iq').value, price = p4(document.getElementById('ip').value);
      if (!(qty > 0)) return toast('Miqdar 0-dan böyük olmalıdır', true);
      if (prod.kind !== 'xidmət') { const have = (items || []).filter(i => i.product_id === prod.id).reduce((s, i) => s + Number(i.qty), 0); if (have + qty > Number(prod.qty)) return toast(`Anbarda kifayət qədər yoxdur: «${prod.name}» — qalıq ${qtyf(prod.qty)}${have ? `, sifarişdə artıq ${qtyf(have)}` : ''}`, true); }
      const { error } = await sb.from('order_items').insert({ order_id: id, product_id: prod.id, qty, price }); if (error) return fail(error);
      route();
    };
    const vs = document.getElementById('vat'); if (vs) vs.onchange = async () => { const { error } = await sb.from('orders').update({ vat_rate: +vs.value }).eq('id', id); if (error) return fail(error); route(); };
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const { error } = await sb.from('order_items').delete().eq('id', b.dataset.del); if (error) return fail(error); route(); });
    const cb = document.getElementById('cancel'); if (cb) cb.onclick = async () => { if (!confirm('Sifariş ləğv edilsin?')) return; const { error } = await sb.from('orders').update({ status: 'legv' }).eq('id', id); if (error) return fail(error); route(); };
  }
  const ub = document.getElementById('unpost');
  if (ub) ub.onclick = async () => {
    if (!confirm(`Qaimə ${o.invoice_code} keçirməsi geri alınsın?\nMal anbara qaytarılacaq, müştərinin borcu silinəcək, sifariş qaralamaya qayıdacaq. Düzəlişdən sonra eyni nömrə ilə yenidən keçirə bilərsiniz.`)) return;
    ub.disabled = true; const { error } = await sb.rpc('unpost_sale', { p_order: id }); if (error) { ub.disabled = false; return fail(error); }
    invalidate(); alertCache = null; toast(`${o.invoice_code}: keçirmə geri alındı`); route();
  };
  const nb = document.getElementById('next');
  if (nb) nb.onclick = async () => {
    if (!(items || []).length) return toast('Sifarişdə məhsul yoxdur', true);
    const ddt = document.getElementById('ddt').value || today();
    if (!confirm(`Qaimə ${dfmt(ddt)} tarixi ilə keçirilsin? Məhsullar anbardan çıxılacaq və müştəriyə borc yazılacaq.`)) return;
    nb.disabled = true;
    const { data: upd, error } = await sb.from('orders').update({ status: 'catdirildi', delivered_at: ddt }).eq('id', id).select('invoice_code').single();
    if (error) { nb.disabled = false; return fail(error); }
    invalidate(); alertCache = null; toast(`Qaimə ${upd?.invoice_code || ''} keçirildi`);
    route();
  };
}


/* ---------- QAİMƏ (çap) ---------- */
const COMPANY = { name: 'MEDİGROUP MMC', address: 'Ceyhun Səlimov 16', phone: '+994 70 272 03 02' };
function azWords(n) {
  const b = ['', 'bir', 'iki', 'üç', 'dörd', 'beş', 'altı', 'yeddi', 'səkkiz', 'doqquz'];
  const o = ['', 'on', 'iyirmi', 'otuz', 'qırx', 'əlli', 'altmış', 'yetmiş', 'səksən', 'doxsan'];
  const tri = x => { const y = Math.floor(x / 100), r = x % 100, w = []; if (y) w.push(y === 1 ? 'yüz' : b[y] + ' yüz'); if (Math.floor(r / 10)) w.push(o[Math.floor(r / 10)]); if (r % 10) w.push(b[r % 10]); return w.join(' '); };
  if (n === 0) return 'sıfır';
  const w = [], mln = Math.floor(n / 1e6), th = Math.floor(n / 1000) % 1000, rest = n % 1000;
  if (mln) w.push(tri(mln) + ' milyon'); if (th) w.push(th === 1 ? 'min' : tri(th) + ' min'); if (rest) w.push(tri(rest));
  return w.join(' ');
}
const num4 = v => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const num2 = v => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const azDateLong = d => { const x = new Date(d + 'T12:00:00'); return `${x.getDate()} ${AZ_AY[x.getMonth()].toLowerCase()} ${x.getFullYear()}`; };

/* Qaimə: ekranda çap olunacaq A5 vərəqlər (210×148 mm) göstərilir; çapda 1C kimi A4 dik səhifənin yuxarı hissəsinə düşür.
   Uzun qaimə vərəqlərə bölünür: başlıq sətri hər vərəqdə təkrarlanır, cəmlər və imzalar yalnız sonuncuda. */
let h2cLoading = null;
const loadH2C = () => h2cLoading ||= new Promise((ok, no) => {
  if (window.html2canvas) return ok();
  const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  s.onload = ok; s.onerror = () => { h2cLoading = null; no(new Error('Çap modulu yüklənmədi, internetinizi yoxlayın')); }; document.head.append(s);
});
const INV_SOC = `<div class="isoc"><span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#3E8E41" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg> <b>medishop.az</b></span><span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#D6249F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".9" fill="#D6249F"/></svg> medigroup_azerbaijan</span><span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#1877F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a20 20 0 0 0-2.4-.1c-2.3 0-3.9 1.4-3.9 4v2.2H8.7v3h2.6V21"/></svg> MEDIGROUP.AZERBAIJAN</span></div>`;
function invSheetHTML(d, { first, rows, tail, pageNo, pages }) {
  const no = d.o.invoice_code || '—', ilkin = d.o.invoice_code ? '' : ' <small>(ilkin)</small>';
  const head = first
    ? `<div class="ihead"><img src="logo.webp" alt="MEDİGROUP"><div class="co"><b>${COMPANY.name}</b><span>Ünvan: ${COMPANY.address}</span><span>Tel: ${COMPANY.phone}</span></div></div>
       <div class="trow"><h1>${d.title || 'Təhvil-təslim qaiməsi'} № ${no}${ilkin}</h1><div class="dt">${d.date}</div></div>
       ${d.parties || `<dl><dt>Satıcı:</dt><dd>${COMPANY.name}</dd><dt>Alıcı:</dt><dd><b>${esc(d.o.customer_name)}</b>${d.voen ? `, VÖEN ${esc(d.voen)}` : ''}</dd></dl>`}`
    : ''; // davam vərəqlərində yalnız cədvəlin davamı
  const table = rows.length ? `<table><thead><tr><th>№</th><th>Məhsul</th><th>Miqdar</th><th>Vahid</th><th>Qiymət</th><th>Məbləğ</th></tr></thead><tbody>${rows.map(r => r.html).join('')}</tbody></table>` : '';
  const tailHTML = tail ? `<table class="tot"><tr><td>Cəmi:</td><td>${num2(d.o.subtotal)}</td></tr><tr><td>${d.vat ? `ƏDV ${d.vat}%:` : 'ƏDV:'}</td><td>${d.vat ? num2(d.o.vat_amount) : 'ƏDV-siz'}</td></tr><tr class="g"><td>Yekun:</td><td>${num2(d.total)} AZN</td></tr></table>
    <p class="sum">Cəmi ${d.count} adda məhsul, ${num2(d.total)} AZN məbləğində<br><b>${d.words}</b></p>
    <div class="sig"><div>${(d.sig || ['Təhvil verdi'])[0]} <span></span></div><div>${(d.sig || [0, 'Təhvil aldı'])[1]} <span></span></div></div>` : '';
  const pg = pages > 1 ? `<div class="pgno">Səhifə ${pageNo} / ${pages}</div>` : '';
  // sosial şəbəkələr yalnız son vərəqdə; digər vərəqlərdə ancaq kiçik səhifə nömrəsi
  const foot = tail ? `<div class="ifoot">${INV_SOC}<div class="ithx">${pg}Sosial şəbəkələrdəki səhifələrimizi bəyənməyi unutmayın!</div></div>` : `<div class="pfoot">${pg}</div>`;
  return `<div class="inv sheet${first ? '' : ' cont'}">${head}${table}${tailHTML}${foot}</div>`;
}
async function paginateInvoice(d) {
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm'; document.body.append(box);
  const fits = opts => { box.innerHTML = invSheetHTML(d, { ...opts, pageNo: 9, pages: 9 }); const s = box.firstElementChild; const H = s.offsetHeight; s.style.height = 'auto'; return s.offsetHeight <= H - 6; }; // ~1.5 mm ehtiyat
  await new Promise(r => { box.innerHTML = invSheetHTML(d, { first: true, rows: [], tail: false, pageNo: 1, pages: 1 }); const i = box.querySelector('img'); if (!i || i.complete) r(); else i.onload = i.onerror = r; });
  const pages = []; let idx = 0;
  while (true) {
    const first = pages.length === 0; const rows = [];
    while (idx < d.rows.length) { rows.push(d.rows[idx]); if (!fits({ first, rows, tail: false }) && rows.length > 1) { rows.pop(); break; } idx++; }
    if (idx >= d.rows.length) {
      if (fits({ first, rows, tail: true })) { pages.push({ first, rows, tail: true }); break; }
      // cəmlər sığmır: son sətir cəmlərlə birlikdə növbəti vərəqə keçir (heç bir sətir itmir)
      if (rows.length > 1) { rows.pop(); idx--; }
      pages.push({ first, rows, tail: false });
      if (idx >= d.rows.length) { pages.push({ first: false, rows: [], tail: true }); break; }
      continue;
    }
    pages.push({ first, rows, tail: false });
  }
  box.remove();
  return pages.map((p, k) => invSheetHTML(d, { ...p, pageNo: k + 1, pages: pages.length }));
}
async function printInvoice() {
  const btn = document.getElementById('pr'); btn.disabled = true; const old = btn.innerHTML; btn.textContent = 'Hazırlanır…';
  try {
    await loadH2C();
    const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm'; document.body.append(box);
    let pages = [];
    for (const sh of document.querySelectorAll('.sheets .sheet')) {
      box.innerHTML = ''; const cl = sh.cloneNode(true); box.append(cl);
      await Promise.all([...cl.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      const c = await html2canvas(cl, { scale: 3, backgroundColor: '#fff', useCORS: true, logging: false });
      pages.push(c.toDataURL('image/png'));
    }
    box.remove();
    pages = [...pages, ...pages]; // hər qaimə 2 nüsxə
    let pw = document.getElementById('printwrap'); if (!pw) { pw = document.createElement('div'); pw.id = 'printwrap'; document.body.append(pw); }
    pw.className = ''; pw.innerHTML = pages.map(u => `<img src="${u}" alt="">`).join(''); await Promise.all([...pw.querySelectorAll('img')].map(i => i.decode()));
    // çap rejimi yalnız çapa təsir edir; bəzi brauzerlər çapı arxa planda etdiyi üçün səhifədən çıxana qədər saxlanılır
    document.body.classList.add('printing-inv');
    window.addEventListener('hashchange', () => document.body.classList.remove('printing-inv'), { once: true });
    await new Promise(r => setTimeout(r, 150));
    window.print();
  } catch (e) { fail(e); }
  btn.disabled = false; btn.innerHTML = old;
}
// 1C-dən gələn köhnə satış qaiməsinin çapı (sales_lines əsasında; məbləğlər ƏDV daxildir)
async function viewInvoice1C(params) {
  const doc = params.get('d'), y = params.get('y'), pid = +params.get('p'), vat = params.get('vat') === '0' ? 0 : 18;
  const [lines, c, p] = await Promise.all([docLines('SQ', doc, y, pid), loadCustomers(), loadProducts()]);
  const pos = lines.filter(l => Number(l.qty) > 0 || Number(l.amount) > 0);
  if (!pos.length) { toast('Qaimə tapılmadı', true); location.hash = '#senedler?t=SQ'; return; }
  const pm = new Map(p.map(x => [x.id, x])), cust = c.find(x => x.id === pid) || {};
  const k = 1 + vat / 100;
  const total = Math.round(pos.reduce((s, l) => s + Number(l.amount), 0) * 100) / 100;
  const netLines = pos.map(l => { const q = Number(l.qty), a = Number(l.amount), net = Math.round(a / k * 100) / 100; return { l, q, net, price: q ? net / q : 0 }; });
  const subtotal = Math.round(netLines.reduce((s, x) => s + x.net, 0) * 100) / 100, vatAmt = Math.round((total - subtotal) * 100) / 100;
  const man = Math.floor(total + 1e-9), qep = Math.round((total - man) * 100), w = azWords(man);
  const o = { invoice_code: doc, customer_name: cust.name || '—', subtotal, vat_amount: vatAmt };
  const d = { o, total, vat, voen: cust.voen, date: azDateLong(pos[0].sale_date), count: pos.length,
    words: `${w.charAt(0).toUpperCase() + w.slice(1)} manat ${String(qep).padStart(2, '0')} qəpik`,
    rows: netLines.map((x, n) => { const pr = pm.get(x.l.product_id) || {}; return { html: `<tr><td>${n + 1}</td><td>${esc(pr.name || '')}</td><td class="n">${qtyf(x.q)}</td><td>${esc(pr.unit || 'əd')}</td><td class="n">${num4(Math.round(x.price * 10000) / 10000)}</td><td class="n">${num2(x.net)}</td></tr>` }; }) };
  document.title = `Qaimə ${doc} — ${o.customer_name}`;
  const back = '#sened?' + new URLSearchParams({ t: 'SQ', d: doc, y, p: pid });
  $app.innerHTML = `<div class="invbar noprint"><a class="btn" href="${back}">${ico('back', 16)} Sənədə qayıt</a>
    <label class="note" style="display:flex;gap:6px;align-items:center">ƏDV: <select class="inp" id="vatsel" style="height:34px;width:auto"><option value="18" ${vat ? 'selected' : ''}>18% (məbləğə daxildir)</option><option value="0" ${vat ? '' : 'selected'}>ƏDV-siz</option></select></label>
    <span class="note" id="pginfo"></span><button class="btn p" id="pr">${ico('print', 16)} Çap et / PDF</button></div>
    <div class="note noprint invnote">1C-dən köçürülmüş qaimə. Məbləğlər 1C-dəki kimidir (ƏDV daxil); ƏDV seçiminə görə qiymət ƏDV-siz göstərilir, Yekun dəyişmir.</div><div class="sheets"></div>`;
  const sheets = await paginateInvoice(d);
  const wrap = $app.querySelector('.sheets'); wrap.innerHTML = sheets.join('');
  document.getElementById('pginfo').textContent = `${sheets.length} vərəq × 2 nüsxə`;
  const fit = () => { wrap.style.zoom = Math.min(1, (document.documentElement.clientWidth - 16) / (210 * 96 / 25.4)); };
  fit(); window.onresize = fit;
  document.getElementById('vatsel').onchange = e => { location.hash = '#qaime1c?' + new URLSearchParams({ d: doc, y, p: pid, vat: e.target.value }); };
  document.getElementById('pr').onclick = () => printInvoice();
  window.scrollTo(0, 0);
}
const amountWords = total => { const man = Math.floor(total + 1e-9), qep = Math.round((total - man) * 100), w = azWords(man); return `${w.charAt(0).toUpperCase() + w.slice(1)} manat ${String(qep).padStart(2, '0')} qəpik`; };
const partyDL = (l1, v1, l2, v2) => `<dl><dt>${l1}:</dt><dd>${v1}</dd><dt>${l2}:</dt><dd>${v2}</dd></dl>`;
const partyName = (x, nm) => `<b>${esc(x?.name || nm || '—')}</b>${x?.voen ? `, VÖEN ${esc(x.voen)}` : ''}`;
async function showSheets(sheets, back, title) {
  document.title = title;
  $app.innerHTML = `<div class="invbar noprint"><a class="btn" href="${back}">${ico('back', 16)} Sənədə qayıt</a><span class="note" id="pginfo"></span><button class="btn p" id="pr">${ico('print', 16)} Çap et / PDF</button></div><div class="sheets"></div>`;
  const wrap = $app.querySelector('.sheets'); wrap.innerHTML = sheets.join('');
  document.getElementById('pginfo').textContent = `${sheets.length} vərəq × 2 nüsxə`;
  const fit = () => { wrap.style.zoom = Math.min(1, (document.documentElement.clientWidth - 16) / (210 * 96 / 25.4)); };
  fit(); window.onresize = fit;
  document.getElementById('pr').onclick = () => printInvoice();
  window.scrollTo(0, 0);
}
// Alış qaiməsi, qaytarma qaimələri və kassa orderləri — çap görünüşü
async function viewDocPrint(params) {
  const t = params.get('t'), doc = params.get('d'), y = params.get('y'), pid = params.get('p') ? +params.get('p') : null;
  const [p, c] = await Promise.all([loadProducts(), loadCustomers()]);
  const pm = new Map(p.map(x => [x.id, x])), part = c.find(x => x.id === pid);
  const back = '#sened?' + new URLSearchParams({ t, d: doc, y, p: pid ?? '' });
  const head = `<div class="ihead"><img src="logo.webp" alt="MEDİGROUP"><div class="co"><b>${COMPANY.name}</b><span>Ünvan: ${COMPANY.address}</span><span>Tel: ${COMPANY.phone}</span></div></div>`;
  if (t === 'PM' || t === 'PX') {
    const { data: r, error } = await sb.from('v_docs').select('*').eq('typ', t).eq('doc', doc).eq('yr', +y).eq('partner_id', pid).limit(1).maybeSingle(); if (error) throw error;
    if (!r) { toast('Sənəd tapılmadı', true); location.hash = back; return; }
    const total = Math.abs(Number(r.amount)), pmx = t === 'PM';
    const note = (r.note || '').replace(/^1C[^:]*:\s*/, '');
    const sheet = `<div class="inv sheet">${head}<div class="trow"><h1>${pmx ? 'Mədaxil orderi' : 'Məxaric orderi'} № ${esc(doc)}</h1><div class="dt">${azDateLong(r.doc_date)}</div></div>
      ${partyDL(pmx ? 'Kimdən qəbul edilib' : 'Kimə verilib', partyName(part, r.partner_name), 'Əsas', esc(note || (pmx ? 'Ödəniş' : 'Tədarükçüyə ödəniş')))}
      <table class="tot"><tr class="g"><td>Məbləğ:</td><td>${num2(total)} AZN</td></tr></table>
      <p class="sum"><b>${amountWords(total)}</b></p>
      <div class="sig"><div>${pmx ? 'Qəbul etdi' : 'Verdi'} <span></span></div><div>${pmx ? 'Ödəyən' : 'Aldı'} <span></span></div></div>
      <div class="ifoot">${INV_SOC}<div class="ithx">Sosial şəbəkələrdəki səhifələrimizi bəyənməyi unutmayın!</div></div></div>`;
    return showSheets([sheet], back, `${pmx ? 'Mədaxil orderi' : 'Məxaric orderi'} ${doc} — ${part?.name || ''}`);
  }
  const lines = (await docLines(t, doc, y, pid)).filter(l => Math.abs(Number(l.qty)) > 0 || Math.abs(Number(l.amount)) > 0);
  if (!lines.length) { toast('Sənəd tapılmadı', true); location.hash = back; return; }
  const sale = t === 'QA';
  const total = Math.round(lines.reduce((s, l) => s + Math.abs(Number(l.amount)), 0) * 100) / 100;
  const vr = Number(lines[0].vat_rate ?? (sale ? 18 : 0)) || 0, k = 1 + vr / 100;
  const net = lines.map(l => { const q = Math.abs(Number(l.qty)), a = Math.abs(Number(l.amount)), n = Math.round(a / k * 100) / 100; return { l, q, n, pr: q ? n / q : 0 }; });
  const subtotal = Math.round(net.reduce((s, x) => s + x.n, 0) * 100) / 100;
  const o = { invoice_code: doc, customer_name: part?.name || '—', subtotal, vat_amount: Math.round((total - subtotal) * 100) / 100 };
  const date = azDateLong(sale ? lines[0].sale_date : lines[0].purchase_date);
  const me = `<b>${COMPANY.name}</b>`, them = partyName(part);
  const cfg = {
    AQ: { title: 'Alış qaiməsi', parties: partyDL('Satıcı (tədarükçü)', them + (lines[0].supplier_doc ? ` · onların qaiməsi № ${esc(lines[0].supplier_doc)}` : ''), 'Alıcı', me), sig: ['Təhvil verdi', 'Təhvil aldı'] },
    QA: { title: 'Qaytarma qaiməsi (alıcıdan)', parties: partyDL('Qaytaran (alıcı)', them, 'Qəbul edən', me), sig: ['Qaytardı', 'Qəbul etdi'] },
    QT: { title: 'Qaytarma qaiməsi (tədarükçüyə)', parties: partyDL('Qaytaran', me, 'Qəbul edən (tədarükçü)', them), sig: ['Qaytardı', 'Qəbul etdi'] } }[t];
  const d = { o, total, vat: vr, date, count: net.length, words: amountWords(total), ...cfg,
    rows: net.map((x, n) => { const pr = pm.get(x.l.product_id) || {}; return { html: `<tr><td>${n + 1}</td><td>${esc(pr.name || '')}</td><td class="n">${qtyf(x.q)}</td><td>${esc(pr.unit || 'əd')}</td><td class="n">${num4(Math.round(x.pr * 10000) / 10000)}</td><td class="n">${num2(x.n)}</td></tr>` }; }) };
  return showSheets(await paginateInvoice(d), back, `${cfg.title} ${doc} — ${part?.name || ''}`);
}
let xlsxLoading = null;
const loadXLSX = () => xlsxLoading ||= new Promise((ok, no) => {
  if (window.XLSX) return ok();
  const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = ok; s.onerror = () => { xlsxLoading = null; no(new Error('Excel modulu yüklənmədi, internetinizi yoxlayın')); }; document.head.append(s);
});
async function xlsxDownload(name, sheets) {
  await loadXLSX();
  const wb = XLSX.utils.book_new();
  for (const [title, rows, widths] of sheets) { const ws = XLSX.utils.aoa_to_sheet(rows); if (widths) ws['!cols'] = widths.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, title); }
  XLSX.writeFile(wb, name);
}
const dAZ = d => d ? String(d).slice(0, 10).split('-').reverse().join('.') : '';
const r2 = v => Math.round(Number(v || 0) * 100) / 100;
async function exportDocs(t, data, d1, d2) {
  const [p, c] = await Promise.all([loadProducts(), loadCustomers()]);
  const pm = new Map(p.map(x => [x.id, x])), cm = new Map(c.map(x => [x.id, x]));
  const money_ = t === 'PM' || t === 'PX';
  const head = [['Sənəd №', 'Tarix', 'Kontragent', 'VÖEN', 'Məbləğ, AZN', money_ ? 'Qeyd' : 'Sətir sayı', ...(t === 'AQ' || t === 'QT' ? ['Tədarükçü qaiməsi'] : []), 'Mənbə']];
  for (const x of data) head.push([x.doc, dAZ(x.doc_date), x.partner_name || '', cm.get(x.partner_id)?.voen || '', r2(Math.abs(x.amount)), money_ ? (x.note || '') : x.lines, ...(t === 'AQ' || t === 'QT' ? [x.supplier_doc || ''] : []), /^MGP/.test(x.doc) ? '1C' : 'Proqram']);
  const sheets = [['Sənədlər', head, [16, 11, 40, 12, 14, money_ ? 40 : 10, ...(t === 'AQ' || t === 'QT' ? [18] : []), 9]]];
  if (!money_) {
    const sale = t === 'SQ' || t === 'QA', tb = sale ? 'sales_lines' : 'purchase_lines', dc = sale ? 'sale_date' : 'purchase_date', pc = sale ? 'customer_id' : 'supplier_id';
    const keys = new Set(data.map(x => `${x.doc}|${x.yr}|${x.partner_id ?? ''}`));
    const ls = await fetchAll(() => { let qb = sb.from(tb).select('*').order(dc).order('id'); if (d1) qb = qb.gte(dc, d1); if (d2) qb = qb.lte(dc, d2); return qb; });
    const rows = [['Sənəd №', 'Tarix', 'Kontragent', 'Kod', 'Məhsul', 'Vahid', 'Miqdar', 'Qiymət, AZN', 'Məbləğ, AZN']];
    for (const l of ls) {
      if (!keys.has(`${l.doc}|${String(l[dc]).slice(0, 4)}|${l[pc] ?? ''}`)) continue;
      const pr = pm.get(l.product_id) || {}, q = Math.abs(Number(l.qty)), a = Math.abs(Number(l.amount));
      rows.push([l.doc, dAZ(l[dc]), cm.get(l[pc])?.name || '', pr.code ?? '', pr.name || '', pr.unit || '', q, q ? Math.round(a / q * 10000) / 10000 : 0, r2(a)]);
    }
    sheets.push(['Sətirlər', rows, [16, 11, 36, 7, 50, 7, 9, 12, 13]]);
  }
  const per = d1 || d2 ? `_${dAZ(d1) || 'əvvəldən'}-${dAZ(d2) || dAZ(today())}` : '_hamısı';
  await xlsxDownload(`MEDIGROUP_${DOC_T[t][0].replace(/\s+/g, '_')}${per}.xlsx`, sheets);
}
async function viewInvoice(id) {
  const [{ data: o, error }, { data: items }, { data: c }, p] = await Promise.all([
    sb.from('v_orders').select('*').eq('id', id).single(),
    sb.from('order_items').select('*').eq('order_id', id).order('id'),
    sb.from('orders').select('customer_id').eq('id', id).single().then(async r => r.data ? sb.from('customers').select('*').eq('id', r.data.customer_id).single() : r),
    loadProducts()]);
  if (error) throw error;
  const pm = new Map(p.map(x => [x.id, x]));
  const total = Number(o.total), man = Math.floor(total + 1e-9), qep = Math.round((total - man) * 100);
  const w = azWords(man);
  const d = { o, total, vat: Number(o.vat_rate), voen: c?.voen, date: azDateLong(o.delivered_at || o.order_date), count: (items || []).length,
    words: `${w.charAt(0).toUpperCase() + w.slice(1)} manat ${String(qep).padStart(2, '0')} qəpik`,
    rows: (items || []).map((i, n) => { const pr = pm.get(i.product_id) || {}; return { html: `<tr><td>${n + 1}</td><td>${esc(pr.name || '')}</td><td class="n">${qtyf(i.qty)}</td><td>${esc(pr.unit || 'əd')}</td><td class="n">${num4(i.price)}</td><td class="n">${num2(i.qty * i.price)}</td></tr>` }; }) };
  document.title = `Qaimə ${o.invoice_code || ''} — ${o.customer_name}`;
  $app.innerHTML = `<div class="invbar noprint"><a class="btn" href="#sifaris/${o.id}">${ico('back', 16)} Sifarişə qayıt</a><span class="note" id="pginfo"></span><button class="btn p" id="pr">${ico('print', 16)} Çap et / PDF</button></div><div class="sheets"></div>`;
  const sheets = await paginateInvoice(d);
  const wrap = $app.querySelector('.sheets'); wrap.innerHTML = sheets.join('');
  document.getElementById('pginfo').textContent = `${sheets.length} vərəq × 2 nüsxə`;
  const fit = () => { wrap.style.zoom = Math.min(1, (document.documentElement.clientWidth - 16) / (210 * 96 / 25.4)); };
  fit(); window.onresize = fit;
  document.getElementById('pr').onclick = () => printInvoice();
  window.scrollTo(0, 0);
}

/* ---------- ANBAR ---------- */
/* ---------- əlifba filtri və sıralama (Anbar, Müştərilər) ---------- */
const AZ_LETTERS = 'A B C Ç D E Ə F G Ğ H X I İ J K Q L M N O Ö P R S Ş T U Ü V W Y Z'.split(' ');
const firstLetter = s => { const t = String(s || '').replace(/^[^0-9A-Za-zÇçƏəĞğİıÖöŞşÜü]+/, ''); const c = t.charAt(0).toLocaleUpperCase('az'); return AZ_LETTERS.includes(c) ? c : '#'; };
const azCmp = (a, b) => String(a || '').replace(/^[^0-9A-Za-zÇçƏəĞğİıÖöŞşÜü]+/, '').localeCompare(String(b || '').replace(/^[^0-9A-Za-zÇçƏəĞğİıÖöŞşÜü]+/, ''), 'az', { sensitivity: 'base' });
function setHashParam(k, v) { const [r, s] = location.hash.split('?'); const p = new URLSearchParams(s || ''); if (v) p.set(k, v); else p.delete(k); location.hash = r + (p.toString() ? '?' + p : ''); }
function alphaBar(all, l, sort, sorts) {
  const has = new Set(all.map(x => firstLetter(x.name)));
  return `<div class="alpha"><label class="f" style="margin:0">Sıralama<select class="inp" id="srt">${sorts.map(([k, t]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <div class="letters"><a href="javascript:void 0" data-l="" class="${!l ? 'on' : ''}">Hamısı</a>${[...AZ_LETTERS, '#'].filter(c => has.has(c)).map(c => `<a href="javascript:void 0" data-l="${c}" class="${c === l ? 'on' : ''}">${c}</a>`).join('')}</div></div>`;
}
function bindAlphaBar() {
  const s = document.getElementById('srt'); if (s) s.onchange = () => setHashParam('s', s.value);
  document.querySelectorAll('.letters [data-l]').forEach(a => a.onclick = () => setHashParam('l', a.dataset.l));
}

async function viewStock(params) {
  const f = params.get('f') || 'xeber'; const q = params.get('q') || ''; const lim = +(params.get('n') || 100); const md1 = params.get('from') || '', md2 = params.get('to') || '';
  const L = params.get('l') || '', S = params.get('s') || 'status';
  const [p, al] = await Promise.all([loadProducts(), alerts()]);
  const by = s => p.filter(x => x.status === s).length;
  const filt = {
    xeber: x => x.status === 'qirmizi' || x.status === 'bitib_tecili',
    var: x => x.qty > 0, qirmizi: x => x.status === 'qirmizi', bitib_tecili: x => x.status === 'bitib_tecili',
    menfi: x => x.status === 'menfi', yoxla: x => x.needs_check, hamisi: () => true
  }[f] || (() => true);
  const order = { bitib_tecili: 0, menfi: 1, qirmizi: 2, normal: 3, bitib: 4 };
  let rows = p.filter(filt);
  if (q) { const nq = norm(q); rows = withSearch(rows).filter(x => x._s.includes(nq)); }
  if (md1) rows = rows.filter(x => x.last_move && String(x.last_move).slice(0, 10) >= md1);
  if (md2) rows = rows.filter(x => x.last_move && String(x.last_move).slice(0, 10) <= md2);
  const base = rows;
  if (L) rows = rows.filter(x => firstLetter(x.name) === L);
  const cmp = { status: (a, b) => (order[a.status] - order[b.status]) || ((a.pct ?? 999) - (b.pct ?? 999)) || azCmp(a.name, b.name), az: (a, b) => azCmp(a.name, b.name), za: (a, b) => azCmp(b.name, a.name), qty: (a, b) => (b.qty - a.qty) || azCmp(a.name, b.name), kod: (a, b) => (a.code ?? 1e9) - (b.code ?? 1e9) }[S] || ((a, b) => 0);
  rows = rows.slice().sort(cmp);
  const chips = [['xeber', `Xəbərdarlıq (${by('qirmizi') + by('bitib_tecili')})`], ['qirmizi', `Azalır ≤20% (${by('qirmizi')})`], ['bitib_tecili', `Bitib (${by('bitib_tecili')})`], ['var', `Qalığı olan (${p.filter(x => x.qty > 0).length})`], ['menfi', `Mənfi (${by('menfi')})`], ['yoxla', `Yoxlanılmalı (${p.filter(x => x.needs_check).length})`], ['hamisi', 'Bütün məhsullar']];
  mount('anbar', `
    <div class="head"><div><h1>Anbar</h1><div class="sub">Cəmi qalıq: ${qtyf(p.reduce((s, x) => s + Number(x.qty), 0))} · ${p.length} məhsul</div></div>
      <div class="row"><a class="btn" href="#mehsul-yeni">+ Yeni məhsul</a><a class="btn" href="#qaytarma?t=QA">Alıcıdan qaytarma</a><a class="btn" href="#qaytarma?t=QT">Tədarükçüyə qaytarma</a><a class="btn p" href="#medaxil">+ Mal mədaxili</a></div></div>
    <div class="note">Qayda: 100% = son mədaxildən sonrakı qalıq. ≤20% — <span class="tag t-red">qırmızı</span>, son 12 ayda satılan və bitən — <span class="tag t-urgent">BİTİB</span>.</div>
    <label class="search">${ico('search', 18)}<input id="q" type="search" placeholder="Ad, kod və ya artikul" value="${esc(q)}"></label>
    <div class="fgrid" style="align-items:end"><label class="f">Son hərəkət: tarixdən<input class="inp" type="date" id="md1" value="${md1}"></label><label class="f">tarixədək<input class="inp" type="date" id="md2" value="${md2}"></label>
      <div class="row"><button class="btn" id="mgo">Tarixə görə göstər</button>${md1 || md2 ? `<a class="btn" href="#anbar?f=${f}${q ? '&q=' + encodeURIComponent(q) : ''}">Tarixi təmizlə</a>` : ''}</div></div>
    <div class="chips">${chips.map(([k, l]) => `<a class="chip ${k === f ? 'on' : ''}" href="#anbar?${new URLSearchParams(Object.fromEntries(Object.entries({ f: k, q, from: md1, to: md2 }).filter(([, v]) => v)))}">${l}</a>`).join('')}</div>
    ${md1 || md2 ? `<div class="note">Son hərəkəti (satış, mədaxil, qaytarma) ${md1 ? dfmt(md1) : '…'} – ${md2 ? dfmt(md2) : '…'} arasında olan ${rows.length} məhsul</div>` : ''}
    ${q ? `<div class="note">«${esc(q)}» üzrə ${rows.length} məhsul (${chips.find(c => c[0] === f)?.[1].replace(/ \(.*/, '') || ''}) · <a href="#anbar?f=hamisi&q=${encodeURIComponent(q)}">bütün məhsullarda axtar</a></div>` : ''}
    ${alphaBar(base, L, S, [['status', 'Statusa görə'], ['az', 'Ad: A → Z'], ['za', 'Ad: Z → A'], ['qty', 'Qalıq: çoxdan aza'], ['kod', 'Daxili kod']])}
    ${L ? `<div class="note">«${esc(L)}» hərfi ilə başlayan ${rows.length} məhsul</div>` : ''}
    <section class="card tight"><div class="list">${rows.slice(0, lim).map(stockRow).join('') || '<div class="empty">Məhsul yoxdur</div>'}</div>
      ${rows.length > lim ? `<div class="more"><button class="btn sm" id="more">Daha çox (${rows.length - lim})</button></div>` : ''}</section>`, al);
  let shown = lim; const mb = document.getElementById('more');
  if (mb) mb.onclick = () => { // səhifə yenidən açılmır — növbəti məhsullar elə burada aşağıya əlavə olunur
    const list = mb.closest('section').querySelector('.list');
    list.insertAdjacentHTML('beforeend', rows.slice(shown, shown + 200).map(stockRow).join(''));
    shown += 200;
    if (shown >= rows.length) mb.parentElement.remove(); else mb.textContent = `Daha çox (${rows.length - shown})`;
  };
  bindAlphaBar();
  document.getElementById('mgo').onclick = () => { location.hash = '#anbar?' + new URLSearchParams(Object.fromEntries(Object.entries({ f: f === 'xeber' ? 'hamisi' : f, q, from: document.getElementById('md1').value, to: document.getElementById('md2').value }).filter(([, v]) => v))); };
  const qi = document.getElementById('q'); let t; qi.oninput = () => { clearTimeout(t); t = setTimeout(() => location.hash = '#anbar?' + new URLSearchParams(Object.fromEntries(Object.entries({ f: f === 'xeber' ? 'hamisi' : f, q: qi.value, from: md1, to: md2 }).filter(([, v]) => v))), 400); };
  if (q) { qi.focus(); qi.setSelectionRange(q.length, q.length); }
}
function stockRow(x) {
  const urgent = x.status === 'bitib_tecili';
  const info = x.status === 'bitib_tecili' ? `ANBARDA YOXDUR · son 12 ayda ${qtyf(x.sold_12m)} satılıb` :
    `${qtyf(x.qty)} ${esc(x.unit)}${x.base_qty ? ` / son mədaxil ${qtyf(x.base_qty)}` : ''}${x.days_left != null && x.status !== 'normal' ? ` · ~${x.days_left} günə bitər` : ''}`;
  return `<a class="li ${urgent ? 'urgent' : ''}" href="#mehsul/${x.id}"><span class="m"><span class="t">${esc(x.name)}</span><span class="d">kod ${esc(x.code ?? '—')}${x.article ? ' · ' + esc(x.article) : ''} · ${info}${x.needs_check ? ' · <b>yoxlanılmalı</b>' : ''}</span>${x.status !== 'bitib' && x.status !== 'bitib_tecili' ? stockBar(x) : ''}</span><span class="r">${stockTag(x)}</span></a>`;
}

async function viewProduct(id) {
  const [p, { data: moves }, sl, pl, cust, al] = await Promise.all([loadProducts(),
    sb.from('stock_moves').select('*').eq('product_id', id).order('moved_at', { ascending: false }).limit(500),
    fetchAll(() => sb.from('sales_lines').select('sale_date,doc,customer_id,qty,amount').eq('product_id', id).order('id')),
    fetchAll(() => sb.from('purchase_lines').select('purchase_date,doc,supplier_id,qty,amount').eq('product_id', id).order('id')),
    loadCustomers(), alerts()]);
  const x = p.find(y => y.id === +id); if (!x) throw new Error('Məhsul tapılmadı');
  const reorder = x.base_qty ? Math.max(0, x.base_qty - x.qty) : null;
  // hər hərəkəti öz sənəd sətri ilə tutuşdur (kontragent, qiymət, sənədə keçid)
  const cname = new Map(cust.map(c => [c.id, c.name]));
  const lines = [...sl.map(r => ({ tb: 's', day: r.sale_date, doc: r.doc, pid: r.customer_id, qty: +r.qty, amount: +r.amount })),
    ...pl.map(r => ({ tb: 'p', day: r.purchase_date, doc: r.doc, pid: r.supplier_id, qty: +r.qty, amount: +r.amount }))];
  const used = new Set(), KT = { satis: ['s', 1], qaytarma_alici: ['s', -1], medaxil: ['p', 1], qaytarma_tedarukcu: ['p', -1] };
  const bday = t => new Date(new Date(t).getTime() + 4 * 3600e3).toISOString().slice(0, 10);
  const match = m => {
    const k = KT[m.kind]; if (!k) return null;
    const days = [String(m.moved_at).slice(0, 10), bday(m.moved_at)], q = Math.abs(+m.qty);
    const ok = l => l.tb === k[0] && Math.sign(l.qty) === k[1];
    const tries = [l => ok(l) && l.doc === m.doc && days.includes(l.day), l => ok(l) && l.doc === m.doc, l => ok(l) && days.includes(l.day) && Math.abs(l.qty) === q, l => ok(l) && days.includes(l.day)];
    for (const f of tries) { const i = lines.findIndex((l, j) => !used.has(j) && f(l)); if (i >= 0) { used.add(i); return lines[i]; } }
    return null;
  };
  const rows = (moves || []).map(m => {
    const l = match(m), typ = l ? (l.tb === 's' ? (l.qty > 0 ? 'SQ' : 'QA') : (l.qty > 0 ? 'AQ' : 'QT')) : null;
    const pid = l ? l.pid : m.partner_id, price = l && l.qty ? Math.abs(l.amount / l.qty) : m.unit_price != null ? +m.unit_price : null;
    return { m, l, typ, pid, price, amount: l ? Math.abs(l.amount) : price != null ? Math.abs(price * m.qty) : null,
      grp: m.kind === 'medaxil' ? 'alis' : m.kind === 'satis' ? 'satis' : /^qaytarma/.test(m.kind) ? 'qaytarma' : 'diger' };
  });
  const buys = rows.filter(r => r.grp === 'alis'), sells = rows.filter(r => r.grp === 'satis');
  const sumq = a => a.reduce((t, r) => t + Math.abs(+r.m.qty), 0);
  const lastTxt = r => r ? `son: ${dfmt(r.m.moved_at)}${r.pid ? ' · ' + esc(cname.get(r.pid) || '') : ''}${r.price != null ? ' · ' + money(r.price) : ''}` : '';
  const cell = r => {
    const dn = r.l ? r.l.doc : r.m.doc || '';
    return r.typ ? `<a href="${docHref({ typ: r.typ, doc: r.l.doc, yr: r.l.day.slice(0, 4), partner_id: r.pid })}">${esc(dn)}</a>` : esc(dn);
  };
  mount('anbar', `<a class="back" href="#anbar">${ico('back', 16)} Anbar</a>
    <div class="head"><div><h1>${esc(x.name)}</h1><div class="sub">kod ${esc(x.code ?? '—')}${x.article ? ' · artikul ' + esc(x.article) : ''} · ${esc(x.kind)}</div></div>${stockTag(x)}</div>
    ${x.needs_check ? `<div class="warnbox">${esc(x.note || '1C-də bu adla bir neçə məhsul var — qalığı yoxlayın.')}</div>` : ''}
    <div class="kpis">
      <div class="kpi ${x.status === 'qirmizi' ? 'red' : ''}"><span class="l">Qalıq</span><span class="v">${qtyf(x.qty)} ${esc(x.unit)}</span><span class="s">${x.pct != null ? x.pct + '% son mədaxildən' : ''}</span></div>
      <div class="kpi"><span class="l">Alış · ${buys.length} dəfə</span><span class="v">${qtyf(sumq(buys))}</span><span class="s">${lastTxt(buys[0])}</span></div>
      <div class="kpi"><span class="l">Satış · ${sells.length} dəfə</span><span class="v">${qtyf(sumq(sells))}</span><span class="s">${lastTxt(sells[0])}</span></div>
      <div class="kpi"><span class="l">Son 12 ayda satış</span><span class="v">${qtyf(x.sold_12m)}</span><span class="s">${x.days_left != null ? `~${x.days_left} günə bitər` : ''}</span></div>
    </div>
    <div class="row"><a class="btn p" href="#medaxil?p=${x.id}">+ Mal mədaxili${reorder ? ` (${qtyf(reorder)} lazımdır)` : ''}</a></div>
    <section class="card tight"><div class="card" style="border:0;padding-bottom:6px"><h2>Hərəkətlər</h2>
      <div class="chips" id="mvf">${[['hamisi', 'Hamısı'], ['alis', 'Alış'], ['satis', 'Satış'], ['qaytarma', 'Qaytarma']].map(([k, l], i) => `<a class="chip ${i ? '' : 'on'}" href="javascript:void 0" data-g="${k}">${l}</a>`).join('')}</div></div>
      <div class="scroll"><table class="t"><thead><tr><th>Tarix</th><th>Növ</th><th>Sənəd</th><th>Kimdən / kimə</th><th class="n">Miqdar</th><th class="n">Qiymət</th><th class="n">Məbləğ</th></tr></thead><tbody>
      ${rows.map(r => { const m = r.m; return `<tr data-g="${r.grp}"><td>${m.kind === 'duzelis' || (m.doc && !/^MGP/.test(m.doc)) ? dtfmt(m.moved_at, m.moved_at) : dfmt(m.moved_at)}</td><td>${MOVE[m.kind] || m.kind}${m.note && m.kind === 'duzelis' ? `<div class="note">${esc(m.note)}</div>` : ''}</td><td>${cell(r)}</td><td>${r.pid ? `<a href="#musteri/${r.pid}">${esc(cname.get(r.pid) || '—')}</a>` : '—'}</td><td class="n amt" style="color:${m.qty > 0 ? 'var(--ok)' : 'var(--ink)'}">${m.qty > 0 ? '+' : ''}${qtyf(m.qty)}</td><td class="n">${r.price != null ? money(r.price) : ''}</td><td class="n">${r.amount != null ? money(r.amount) : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Hərəkət yoxdur</td></tr>'}
    </tbody></table></div></section>
    <div class="note">Sənəd nömrəsinə basın — sənəd açılır; firma adına basın — firmanın kartı açılır. Qiymət sənəddəki kimidir: 1C-də 0,01 ₼ ilə vurulmuş alışlar burada da 0,01 ₼ görünür.</div>`, al);
  document.querySelectorAll('#mvf .chip').forEach(c => c.onclick = () => {
    document.querySelectorAll('#mvf .chip').forEach(z => z.classList.toggle('on', z === c));
    document.querySelectorAll('tr[data-g]').forEach(tr => { tr.style.display = c.dataset.g === 'hamisi' || tr.dataset.g === c.dataset.g ? '' : 'none'; });
  });
}

async function viewNewProduct() {
  const al = await alerts();
  mount('anbar', `<a class="back" href="#anbar">${ico('back', 16)} Anbar</a><h1>Yeni məhsul</h1>
    <form class="card" id="nf"><div class="fgrid">
      <label class="f" style="grid-column:1/-1">Ad<input class="inp" name="name" required></label>
      <label class="f">Daxili kod<input class="inp" value="avtomatik veriləcək" disabled></label>
      <label class="f">Artikul (istəyə bağlı)<input class="inp" name="article" placeholder="tədarükçünün artikulu, varsa"></label>
      <label class="f">Vahid<input class="inp" name="unit" value="əd"></label>
      <label class="f">Növ<select class="inp" name="kind"><option value="mal">mal</option><option value="xidmət">xidmət</option></select></label>
    </div><div class="row"><button class="btn p">Yadda saxla</button></div></form>`, al);
  document.getElementById('nf').onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); if (!f.article) f.article = null;
    const { data, error } = await sb.from('products').insert(f).select().single(); if (error) return fail(error);
    invalidate(); toast(`Məhsul yaradıldı · daxili kod ${data.code}`); location.hash = '#mehsul/' + data.id;
  };
}

/* ---------- MƏDAXİL ---------- */
async function viewReceipt(params) {
  const [p, c, al] = await Promise.all([loadProducts(), loadCustomers(), alerts()]);
  const pm = new Map(p.map(x => [x.id, x]));
  const lines = [];
  const edit = /^AQ-\d\d-\d{4}$/.test(params.get('edit') || '') ? params.get('edit') : null;
  let sup = null, dt0 = today(), sdoc0 = '', vat0 = 18;
  if (edit) { // düzəliş: köhnə sənədin sətirləri forma dolur, eyni nömrə ilə yenidən yazılır
    const { data: ex, error } = await sb.from('purchase_lines').select('*').eq('doc', edit).eq('source', 'app').order('id'); if (error) throw error;
    if (!ex?.length) { toast('Sənəd tapılmadı', true); location.hash = '#senedler?t=AQ'; return; }
    sup = c.find(x => x.id === ex[0].supplier_id) || null; dt0 = ex[0].purchase_date; sdoc0 = ex[0].supplier_doc || ''; vat0 = ex[0].vat_rate != null ? Number(ex[0].vat_rate) : 0;
    for (const l of ex) if (pm.get(l.product_id)) lines.push({ p: pm.get(l.product_id), qty: Number(l.qty), price: l.price != null ? Number(l.price) : p4(Number(l.amount) / Number(l.qty) / (1 + vat0 / 100)) });
  }
  const pre = params.get('p'); if (!edit && pre) { const x = pm.get(+pre); if (x) lines.push({ p: x, qty: Math.max(1, (x.base_qty || 0) - x.qty) || 1, price: 0 }); }
  mount('anbar', `<a class="back" href="${edit ? '#senedler?t=AQ' : '#anbar'}">${ico('back', 16)} ${edit ? 'Sənədlər' : 'Anbar'}</a><h1>${edit ? `Alış qaiməsi ${edit} — düzəliş` : 'Anbara mədaxil (alış qaiməsi)'}</h1>
    ${edit ? '<div class="note">Dəyişiklikləri edib «Yadda saxla» basın — sənəd eyni nömrə ilə yenidən yazılacaq (anbar və tədarükçü borcu avtomatik düzələcək).</div>' : ''}
    <section class="card"><div class="fgrid">
      <label class="f">Tədarükçü<div class="pick" id="sp"><input class="inp" placeholder="Tədarükçü adı…" autocomplete="off" value="${esc(sup?.name || '')}"></div></label>
      <label class="f">Tarix<input class="inp" type="date" id="dt" value="${dt0}"></label>
      <label class="f">Tədarükçünün qaimə №<input class="inp" id="doc" placeholder="tədarükçünün sənədindəki nömrə" value="${esc(sdoc0)}"></label>
      <label class="f">ƏDV<select class="inp" id="vat"><option value="18" ${vat0 === 18 ? 'selected' : ''}>ƏDV 18% (qiymətin üstünə gəlir)</option><option value="0" ${vat0 === 0 ? 'selected' : ''}>ƏDV-siz</option></select></label></div></section>
    <section class="card"><h2>Məhsullar</h2><div id="lines"></div>
      <label class="f">Məhsul əlavə et<div class="pick" id="pp"><input class="inp" placeholder="Ad, kod və ya artikul…" autocomplete="off"></div></label>
      <div class="note">Siyahıda olmayan yeni məhsul üçün əvvəlcə <a href="#mehsul-yeni">Anbar → Yeni məhsul</a> (daxili kodu sistem özü verir).</div></section>
    <div class="head"><div id="tot"></div><div class="row">${edit ? '<button class="btn danger" id="del">Sənədi ləğv et</button>' : ''}<button class="btn p" id="save">${edit ? 'Yadda saxla' : 'Anbara vur'}</button></div></div>`, al);
  picker(document.getElementById('sp'), withSearch(c.filter(x => x.is_supplier)), x => `<span>${esc(x.name)}</span>`, x => { sup = x; document.querySelector('#sp input').value = x.name; });
  const col = (q, base) => q <= 0 ? 'var(--ink)' : (base && q / base <= 0.2 ? 'var(--red)' : 'var(--ok)');
  const vatK = () => 1 + (+document.getElementById('vat').value) / 100;
  const draw = () => {
    document.getElementById('lines').innerHTML = lines.length ? `<div class="scroll"><table class="t"><thead><tr><th>Məhsul</th><th class="n">Miqdar</th><th class="n">Qiymət, ƏDV-siz ₼</th><th class="n">Məbləğ</th><th class="n">Qalıq: indi → sonra</th><th></th></tr></thead><tbody>${lines.map((l, i) => `<tr>
      <td>${esc(l.p.name)}<div class="note">kod ${esc(l.p.code ?? '')}${l.p.article ? ' · ' + esc(l.p.article) : ''}</div></td>
      <td class="n"><input class="inp" style="width:100px;text-align:right" type="number" min="0" step="any" data-q="${i}" value="${l.qty}"></td>
      <td class="n"><input class="inp" style="width:110px;text-align:right" type="number" min="0" step="0.0001" data-pr="${i}" value="${l.price}"></td>
      <td class="n amt">${money(l.qty * l.price)}</td>
      <td class="n"><b style="color:${col(l.p.qty, l.p.base_qty)}">${qtyf(l.p.qty)}</b> → <b style="color:var(--ok)">${qtyf(Number(l.p.qty) + Number(l.qty || 0))}</b></td>
      <td class="n"><button class="btn sm" data-rm="${i}">Sil</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Məhsul əlavə edin</div>';
    const net = lines.reduce((s, l) => s + Math.round(l.qty * l.price * 100) / 100, 0), k = vatK();
    const gross = lines.reduce((s, l) => s + Math.round(l.qty * l.price * k * 100) / 100, 0);
    document.getElementById('tot').innerHTML = `Cəmi (ƏDV-siz): <b>${money(net)}</b> · ${k > 1 ? `ƏDV 18%: <b>${money(gross - net)}</b>` : 'ƏDV-siz'} · Yekun: <b>${money(gross)}</b>`;
    document.querySelectorAll('[data-q]').forEach(e => e.onchange = () => { lines[e.dataset.q].qty = +e.value; draw(); });
    document.querySelectorAll('[data-pr]').forEach(e => e.onchange = () => { lines[e.dataset.pr].price = p4(e.value); draw(); });
    document.querySelectorAll('[data-rm]').forEach(e => e.onclick = () => { lines.splice(+e.dataset.rm, 1); draw(); });
  };
  document.getElementById('vat').onchange = draw;
  picker(document.getElementById('pp'), withSearch(p), x => `<span>${esc(x.name)} <small>kod ${esc(x.code ?? '')}</small></span><small>${qtyf(x.qty)} ${esc(x.unit)}</small>`, x => {
    lines.push({ p: x, qty: 1, price: 0 }); document.querySelector('#pp input').value = ''; draw();
  });
  draw();
  const del = document.getElementById('del');
  if (del) del.onclick = async () => {
    if (!confirm(`Alış qaiməsi ${edit} ləğv edilsin?\nMal anbardan çıxılacaq, tədarükçü borcu silinəcək. Bu geri qaytarılmır.`)) return;
    del.disabled = true; const { error } = await sb.rpc('cancel_doc', { p_doc: edit }); if (error) { del.disabled = false; return fail(error); }
    invalidate(); alertCache = null; toast(`${edit} ləğv edildi`); location.hash = '#senedler?t=AQ';
  };
  document.getElementById('save').onclick = async e => {
    const good = lines.filter(l => l.qty > 0); if (!good.length) return toast('Məhsul əlavə edin', true);
    if (!sup) return toast('Tədarükçü seçin', true);
    if (good.some(l => !(l.price > 0)) && !confirm('Bəzi məhsulların qiyməti 0-dır. Yenə də yadda saxlanılsın?')) return;
    e.target.disabled = true;
    const dt = document.getElementById('dt').value || today(); const sdoc = document.getElementById('doc').value.trim() || null;
    const { data: no, error } = await sb.rpc('post_receipt', { p_date: dt, p_supplier: sup.id, p_supplier_doc: sdoc, p_lines: good.map(l => ({ product_id: l.p.id, qty: l.qty, price: l.price || 0 })), p_vat: +document.getElementById('vat').value, p_doc: edit });
    if (error) { e.target.disabled = false; return fail(error); }
    invalidate(); alertCache = null; toast(edit ? `Alış qaiməsi ${no} düzəldildi` : `Alış qaiməsi ${no}: ${good.length} məhsul anbara vuruldu`);
    location.hash = '#sened?' + new URLSearchParams({ t: 'AQ', d: no, y: dt.slice(0, 4), p: sup.id });
  };
}

/* ---------- MÜŞTƏRİLƏR ---------- */
async function viewCustomers(params) {
  const f = params.get('f') || 'borclu'; const q = params.get('q') || ''; const lim = +(params.get('n') || 100);
  const L = params.get('l') || '', S = params.get('s') || ((f === 'borclu' || f === 'gecikir') ? 'borc' : 'az');
  const [c, al] = await Promise.all([loadCustomers(), alerts()]);
  const filt = { borclu: x => x.balance >= 1, gecikir: x => x.overdue >= 1, avans: x => x.balance_type === 'avans', biz: x => x.balance_type === 'biz_borcluyuq' || x.balance_type === 'menfi', alici: x => x.is_buyer, tedarukcu: x => x.is_supplier, hamisi: () => true }[f];
  let rows = c.filter(filt); if (q) rows = withSearch(rows).filter(x => x._s.includes(norm(q)));
  const base = rows;
  if (L) rows = rows.filter(x => firstLetter(x.name) === L);
  const cmp = { borc: (a, b) => (b.overdue - a.overdue) || (b.balance - a.balance), az: (a, b) => azCmp(a.name, b.name), za: (a, b) => azCmp(b.name, a.name), saldo: (a, b) => Math.abs(b.balance) - Math.abs(a.balance), kod: (a, b) => (a.code ?? 1e9) - (b.code ?? 1e9) }[S];
  if (cmp) rows = rows.slice().sort(cmp);
  const n = k => c.filter({ borclu: x => x.balance >= 1, gecikir: x => x.overdue >= 1, avans: x => x.balance_type === 'avans', biz: x => x.balance_type === 'biz_borcluyuq' || x.balance_type === 'menfi' }[k]).length;
  const chips = [['borclu', `Borclu (${n('borclu')})`], ['gecikir', `Gecikən (${n('gecikir')})`], ['avans', `Avans (${n('avans')})`], ['biz', `Biz borcluyuq (${n('biz')})`], ['alici', 'Alıcılar'], ['tedarukcu', 'Tədarükçülər'], ['hamisi', `Hamısı (${c.length})`]];
  mount('musteriler', `<div class="head"><h1>Müştərilər</h1><div class="row"><button class="btn" id="xls">${ico('doc', 16)} Excel-ə yüklə</button><a class="btn p" href="#musteri-yeni">+ Yeni müştəri</a></div></div>
    <label class="search">${ico('search', 18)}<input id="q" type="search" placeholder="Ad və ya kod" value="${esc(q)}"></label>
    <div class="chips">${chips.map(([k, l]) => `<a class="chip ${k === f ? 'on' : ''}" href="#musteriler?f=${k}${q ? '&q=' + encodeURIComponent(q) : ''}">${l}</a>`).join('')}</div>
    ${q ? `<div class="note">«${esc(q)}» üzrə ${rows.length} nəticə · <a href="#musteriler?f=hamisi&q=${encodeURIComponent(q)}">hamısında axtar</a></div>` : ''}
    ${alphaBar(base, L, S, [['borc', 'Gecikmə və borca görə'], ['az', 'Ad: A → Z'], ['za', 'Ad: Z → A'], ['saldo', 'Saldo: böyükdən kiçiyə'], ['kod', 'Kod']])}
    ${L ? `<div class="note">«${esc(L)}» hərfi ilə başlayan ${rows.length} kontragent</div>` : ''}
    <section class="card tight"><div class="list">${rows.slice(0, lim).map(custRow).join('') || '<div class="empty">Tapılmadı</div>'}</div>
    ${rows.length > lim ? `<div class="more"><button class="btn sm" id="more">Daha çox (${rows.length - lim})</button></div>` : ''}</section>`, al);
  let shown = lim; const mb = document.getElementById('more');
  if (mb) mb.onclick = () => {
    const list = mb.closest('section').querySelector('.list');
    list.insertAdjacentHTML('beforeend', rows.slice(shown, shown + 200).map(custRow).join(''));
    shown += 200;
    if (shown >= rows.length) mb.parentElement.remove(); else mb.textContent = `Daha çox (${rows.length - shown})`;
  };
  bindAlphaBar();
  document.getElementById('xls').onclick = async e => {
    if (!rows.length) return toast('Siyahı boşdur', true);
    const b = e.currentTarget, old = b.innerHTML; b.disabled = true; b.textContent = 'Hazırlanır…';
    try {
      const out = [['Kod', 'Ad', 'VÖEN', 'Telefon', 'Növ', 'Saldo, AZN (+ bizə borcludur, − biz borcluyuq)', 'Gecikən borc, AZN', 'Ən uzun gecikmə, gün', 'Vəziyyət', 'Son sifariş']];
      for (const x of rows) out.push([x.code ?? '', x.name, x.voen || '', x.phone || '', [x.is_buyer && 'alıcı', x.is_supplier && 'tədarükçü'].filter(Boolean).join(', '), r2(x.balance), r2(x.overdue), x.overdue >= 1 ? x.max_late ?? '' : '', BTYPE[x.balance_type]?.[0] || '', dAZ(x.last_order)]);
      const chip = (chips.find(([k]) => k === f) || [0, ''])[1].replace(/\s*\(\d+\)/, '');
      await xlsxDownload(`MEDIGROUP_Musteriler_${chip.replace(/\s+/g, '_')}${L ? '_' + L : ''}_${dAZ(today())}.xlsx`, [['Müştərilər', out, [7, 42, 12, 16, 16, 18, 14, 12, 16, 12]]]);
      toast(`${rows.length} kontragent Excel-ə yükləndi`);
    } catch (er) { fail(er); }
    b.disabled = false; b.innerHTML = old;
  };
  const qi = document.getElementById('q'); let t; qi.oninput = () => { clearTimeout(t); t = setTimeout(() => location.hash = `#musteriler?f=${f === 'borclu' && !params.has('f') ? 'hamisi' : f}&q=${encodeURIComponent(qi.value)}`, 400); };
  if (q) { qi.focus(); qi.setSelectionRange(q.length, q.length); }
}
function custRow(x) {
  const bt = BTYPE[x.balance_type];
  const sub = [x.is_buyer && 'alıcı', x.is_supplier && 'tədarükçü'].filter(Boolean).join(', ');
  return `<a class="li" href="#musteri/${x.id}"><span class="m"><span class="t">${esc(x.name)}</span><span class="d">kod ${esc(x.code ?? '—')} · ${sub}${x.phone ? ' · ' + esc(x.phone) : ''}</span></span>
    <span class="r">${Math.abs(x.balance) >= 1 ? `<span class="amt">${money(Math.abs(x.balance))}</span>` : ''}${x.overdue >= 1 ? `<span class="tag t-red">gecikir ${money0(x.overdue)} · ${x.max_late} gün</span>` : bt ? `<span class="tag ${bt[1]}">${bt[0]}</span>` : ''}</span></a>`;
}

async function viewCustomer(id) {
  const [{ data: x, error }, { data: open }, { data: led }, { data: orders }, al] = await Promise.all([
    sb.from('v_customers').select('*').eq('id', id).single(),
    sb.from('v_open_items').select('*').eq('customer_id', id).order('entry_date'),
    sb.from('ledger').select('*').eq('customer_id', id).eq('voided', false).order('entry_date', { ascending: false }).order('id', { ascending: false }).limit(100),
    sb.from('v_orders').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(50), alerts()]);
  if (error) throw error;
  const bt = BTYPE[x.balance_type];
  const stateTag = o => o.state === 'gecikir' ? `<span class="tag t-red">${o.late_days} gün gecikir</span>` : o.state === 'kohne' ? '<span class="tag t-grey">2023-dən əvvəl</span>' : o.state === 'vaxti_catmayib' ? `<span class="tag t-ok">müddət ${dfmt(o.due_date)}</span>` : '';
  mount('musteriler', `<a class="back" href="#musteriler">${ico('back', 16)} Müştərilər</a>
    <div class="head"><div><h1>${esc(x.name)}</h1><div class="sub">kod ${esc(x.code ?? '—')} · ${[x.is_buyer && 'alıcı', x.is_supplier && 'tədarükçü'].filter(Boolean).join(', ')}</div></div>
      <div class="row">${x.phone ? `<a class="btn" href="tel:${esc(x.phone)}">Zəng</a><a class="btn" href="https://wa.me/${esc(x.phone.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<a class="btn p" href="#cixaris/${x.id}">Hesab çıxarışı</a><a class="btn" href="#hesabatlar?c=${x.id}&from=2023-01-01">Hesabat</a>${x.is_buyer || !x.is_supplier ? `<a class="btn" href="#odenis-yeni?c=${x.id}">+ Pul mədaxili</a>` : ''}${x.is_supplier ? `<a class="btn" href="#odenis-yeni?t=PX&c=${x.id}">+ Pul məxarici</a>` : ''}<a class="btn p" href="#yeni-sifaris?c=${x.id}">+ Sifariş</a></div></div>
    <div class="kpis">
      <div class="kpi"><span class="l">Saldo</span><span class="v">${money(Math.abs(x.balance))}</span><span class="s">${bt ? bt[0] : 'borc yoxdur'}</span></div>
      <div class="kpi ${x.overdue >= 1 ? 'red' : ''}"><span class="l">Gecikən</span><span class="v">${money(x.overdue)}</span><span class="s">${x.max_late ? 'ən çox ' + x.max_late + ' gün' : ''}</span></div>
      <div class="kpi"><span class="l">Sifariş</span><span class="v">${x.orders_count}</span><span class="s">${x.last_order ? 'son: ' + dfmt(x.last_order) : ''}</span></div>
    </div>
    <div class="grid2">
      <section class="card"><h2>Ödəniş qeyd et</h2>
        <div class="fgrid"><label class="f">Məbləğ ₼<input class="inp" id="pa" type="number" min="0" step="0.01" placeholder="0.00"></label>
        <label class="f">Tarix<input class="inp" id="pd" type="date" value="${today()}"></label></div>
        <label class="f">Qeyd<input class="inp" id="pn" placeholder="məs. bank köçürməsi"></label>
        <div class="row"><button class="btn p" id="pay">Ödənişi yaz</button></div>
        <div class="note">Ödəniş avtomatik olaraq ən köhnə borcdan bağlanır.</div></section>
      <section class="card"><h2>Əlaqə məlumatları</h2>
        <div class="fgrid"><label class="f">Telefon<input class="inp" data-k="phone" value="${esc(x.phone || '')}"></label>
        <label class="f">VÖEN<input class="inp" data-k="voen" value="${esc(x.voen || '')}"></label>
        <label class="f">Əlaqə şəxsi<input class="inp" data-k="contact" value="${esc(x.contact || '')}"></label>
        <label class="f">Ünvan<input class="inp" data-k="address" value="${esc(x.address || '')}"></label></div>
        <label class="f">Qeyd<textarea class="inp" data-k="note">${esc(x.note || '')}</textarea></label>
        <div class="row"><button class="btn" id="savec">Yadda saxla</button></div></section>
    </div>
    <section class="card tight"><div class="card" style="border:0;padding-bottom:6px"><h2>Ödənilməmiş borclar</h2></div><div class="list">
      ${(open || []).map(o => { const m = (o.note || '').match(/MGP\d+/); const inv = o.order_id ? `#qaime/${o.order_id}` : m && o.kind === 'satis' ? '#qaime1c?' + new URLSearchParams({ d: m[0], y: String(o.entry_date).slice(0, 4), p: o.customer_id }) : '';
        return `<div class="li"><span class="m"><span class="t">${o.kind === 'kohne' ? 'Köhnə borc' : 'Satış ' + dfmt(o.entry_date)}</span><span class="d">${esc(o.note || '')}</span>${inv ? `<span class="d"><a href="${inv}">${ico('print', 14)} Qaiməni aç / çap et</a></span>` : ''}</span><span class="r"><span class="amt">${money(o.open_amount)}</span>${stateTag(o)}</span></div>`; }).join('') || '<div class="empty">Ödənilməmiş borc yoxdur</div>'}</div></section>
    <section class="card tight"><div class="card" style="border:0;padding-bottom:6px"><h2>Sifarişlər</h2></div><div class="list">${(orders || []).map(orderRow).join('') || '<div class="empty">Sifariş yoxdur</div>'}</div></section>
    <section class="card tight"><div class="card" style="border:0;padding-bottom:6px"><div class="head"><h2>Hesab tarixçəsi (son 100)</h2><a href="#cixaris/${x.id}">Bütün hərəkətlər →</a></div></div><div class="scroll"><table class="t"><thead><tr><th>Tarix</th><th>Növ</th><th>Qeyd</th><th class="n">Məbləğ</th></tr></thead><tbody>
      ${(led || []).map(l => `<tr><td>${dtfmt(l.entry_date, l.doc_no && !/^MGP/.test(l.doc_no) ? l.created_at : null)}</td><td>${/^QA-/.test(l.doc_no || '') ? 'Alıcıdan qaytarma' : /^QT-/.test(l.doc_no || '') ? 'Tədarükçüyə qaytarma' : LEDGER[l.kind]}</td><td>${l.doc_no ? `<b>${esc(l.doc_no)}</b> · ` : ''}${esc(l.note || '')}</td><td class="n amt" style="color:${l.amount < 0 ? 'var(--ok)' : 'var(--ink)'}">${money(l.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Qeyd yoxdur</td></tr>'}
    </tbody></table></div></section>`, al);
  document.getElementById('pay').onclick = async e => {
    const a = +document.getElementById('pa').value; if (!(a > 0)) return toast('Məbləğ yazın', true);
    e.target.disabled = true;
    const { data: pd, error } = await sb.from('ledger').insert({ customer_id: x.id, kind: 'odenis', amount: -a, entry_date: document.getElementById('pd').value || today(), note: document.getElementById('pn').value || 'Ödəniş' }).select('doc_no').single();
    if (error) { e.target.disabled = false; return fail(error); }
    invalidate(); alertCache = null; toast(`Pul mədaxili ${pd?.doc_no || ''}: ` + money(a)); route();
  };
  document.getElementById('savec').onclick = async () => {
    const upd = {}; document.querySelectorAll('[data-k]').forEach(e => upd[e.dataset.k] = e.value.trim() || null);
    const { error } = await sb.from('customers').update(upd).eq('id', x.id); if (error) return fail(error);
    invalidate(); toast('Yadda saxlanıldı');
  };
  try { const g = $app.querySelector('.grid2'); if (g) { const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-direction:column;gap:16px'; w.innerHTML = await custDocsHTML(x.id); g.after(w); bindCustDocs(x.id); } } catch (e) { console.error(e); }
}

const NEWC_REQ = [['signer_pos', 'İmza edənin vəzifəsi', 'Direktor'], ['signer_short', 'İmza edən (qısa)', 'Soyad Ad'], ['signer_full', 'İmza edən (tam)', 'Soyad Ad Ata adı oğlu/qızı'],
  ['bank', 'Bank və filial'], ['iban', 'H/H (IBAN)'], ['corr_account', 'M/H'], ['bank_code', 'Bank kodu'], ['bank_voen', 'Bankın VÖEN-i'], ['swift', 'SWIFT'], ['legal_address', 'Hüquqi ünvan', '', 1]];
async function viewNewCustomer() {
  const al = await alerts();
  mount('musteriler', `<a class="back" href="#musteriler">${ico('back', 16)} Müştərilər</a><h1>Yeni müştəri</h1>
    <form class="card" id="nf"><div class="fgrid">
      <label class="f" style="grid-column:1/-1">Ad<input class="inp" name="name" required></label>
      <label class="f">Telefon<input class="inp" name="phone"></label><label class="f">VÖEN<input class="inp" name="voen"></label>
      <label class="f">Əlaqə şəxsi<input class="inp" name="contact"></label><label class="f">Ünvan<input class="inp" name="address"></label></div>
      <div class="row"><label><input type="checkbox" name="is_buyer" checked> Alıcı</label><label><input type="checkbox" name="is_supplier"> Tədarükçü</label></div>
      <h2 style="margin-top:18px">Sənəd rekvizitləri</h2><div class="note" style="margin-bottom:10px">Müqavilə, QRP, hesab-faktura və aktlara avtomatik yazılır. Sonra da müştəri kartında doldurmaq və dəyişmək olar.</div>
      <div class="fgrid">${NEWC_REQ.map(([k, l, ph, wide]) => `<label class="f"${wide ? ' style="grid-column:1/-1"' : ''}>${l}<input class="inp" name="${k}" placeholder="${esc(ph || '')}"></label>`).join('')}</div>
      <div class="row"><button class="btn p">Yadda saxla</button></div></form>`, al);
  document.getElementById('nf').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target); const f = {};
    ['name', 'phone', 'voen', 'contact', 'address', ...NEWC_REQ.map(x => x[0])].forEach(k => f[k] = (fd.get(k) || '').trim() || null);
    if (f.signer_full && !f.signer_short) f.signer_short = f.signer_full.split(/\s+/).slice(0, 2).join(' ');
    f.is_buyer = fd.get('is_buyer') === 'on'; f.is_supplier = fd.get('is_supplier') === 'on';
    const { data, error } = await sb.from('customers').insert(f).select().single(); if (error) return fail(error);
    invalidate(); location.hash = '#musteri/' + data.id;
  };
}

/* ---------- ÖDƏNİŞLƏR ---------- */
async function viewPayments(params) {
  const f = params.get('f') || 'gecikir'; const q = norm(params.get('q') || '');
  const [{ data: open, error }, c, al] = await Promise.all([sb.from('v_open_items').select('*').order('entry_date'), loadCustomers(), alerts()]);
  if (error) throw error;
  const groups = { gecikir: [], vaxti_catmayib: [], kohne: [] };
  const byC = {};
  (open || []).forEach(o => { const k = o.state === 'tarixsiz' ? 'vaxti_catmayib' : o.state; const key = k + ':' + o.customer_id; if (!byC[key]) { byC[key] = { k, id: o.customer_id, name: o.customer_name, sum: 0, late: 0, n: 0, due: o.due_date }; groups[k].push(byC[key]); } const g = byC[key]; g.sum += Number(o.open_amount); g.late = Math.max(g.late, o.late_days || 0); g.n++; if (o.due_date && (!g.due || o.due_date < g.due)) g.due = o.due_date; });
  groups.gecikir.sort((a, b) => b.late - a.late); groups.vaxti_catmayib.sort((a, b) => String(a.due).localeCompare(String(b.due))); groups.kohne.sort((a, b) => b.sum - a.sum);
  const tot = k => groups[k].reduce((s, x) => s + x.sum, 0);
  const avans = c.filter(x => x.balance_type === 'avans'), biz = c.filter(x => x.balance_type === 'biz_borcluyuq' || x.balance_type === 'menfi');
  const chips = [['gecikir', `Gecikən · ${money0(tot('gecikir'))}`], ['vaxti_catmayib', `Vaxtı çatmayıb · ${money0(tot('vaxti_catmayib'))}`], ['kohne', `2023-dən əvvəl · ${money0(tot('kohne'))}`], ['avans', `Avanslar (${avans.length})`], ['biz', `Biz borcluyuq (${biz.length})`]];
  let body;
  if (q) { for (const k in groups) groups[k] = groups[k].filter(g => norm(g.name).includes(q)); }
  if (f === 'avans' || f === 'biz') body = (f === 'avans' ? avans : biz).filter(x => !q || norm(x.name).includes(q)).sort((a, b) => a.balance - b.balance).map(custRow).join('');
  else body = groups[f].map(g => `<a class="li" href="#musteri/${g.id}"><span class="dotc" style="background:${f === 'gecikir' ? 'var(--red-bar)' : f === 'kohne' ? '#A9B4BF' : 'var(--ok-bar)'}"></span><span class="m"><span class="t">${esc(g.name)}</span><span class="d">${g.n} satış${f === 'vaxti_catmayib' ? ' · ən yaxın müddət ' + dfmt(g.due) : ''}</span></span><span class="r"><span class="amt">${money(g.sum)}</span>${f === 'gecikir' ? `<span class="tag t-red">${g.late} gün gecikir</span>` : ''}</span></a>`).join('');
  mount('odenisler', `<div class="head"><div><h1>Ödənişlər</h1><div class="sub">Ödəniş müddəti: satışdan 30 gün</div></div><div class="row"><a class="btn" href="#odenis-yeni?t=PX">Ödəniş et (tədarükçüyə)</a><a class="btn p" href="#odenis-yeni">+ Ödəniş qəbul et</a></div></div>
    <div class="kpis"><div class="kpi"><span class="l">Cəmi alınacaq</span><span class="v">${money0(tot('gecikir') + tot('vaxti_catmayib') + tot('kohne'))}</span></div>
      <div class="kpi red"><span class="l">Gecikən</span><span class="v">${money0(tot('gecikir'))}</span><span class="s">${groups.gecikir.length} müştəri</span></div></div>
    <label class="search">${ico('search', 18)}<input id="q" type="search" placeholder="Müştəri adı ilə axtar" value="${esc(params.get('q') || '')}"></label>
    <div class="chips">${chips.map(([k, l]) => `<a class="chip ${k === f ? 'on' : ''}" href="#odenisler?f=${k}${q ? '&q=' + encodeURIComponent(params.get('q')) : ''}">${l}</a>`).join('')}</div>
    <section class="card tight"><div class="list">${body || '<div class="empty">Siyahı boşdur</div>'}</div></section>`, al);
  const qi = document.getElementById('q'); let tm;
  qi.oninput = () => { clearTimeout(tm); tm = setTimeout(() => location.hash = `#odenisler?f=${f}&q=${encodeURIComponent(qi.value)}`, 500); };
  if (q) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
}

/* ---------- HESABATLAR (tarix + müştəri filtri) ---------- */
let salesLinesReady = null;
async function hasSalesLines() {
  if (salesLinesReady === null) {
    const { count, error } = await sb.from('sales_lines').select('id', { count: 'exact', head: true }).eq('source', '1c');
    salesLinesReady = !error && count > 0;
  }
  return salesLinesReady;
}
let purchLinesReady = null;
async function hasPurchLines() {
  if (purchLinesReady === null) {
    const { count, error } = await sb.from('purchase_lines').select('id', { count: 'exact', head: true }).eq('source', '1c');
    purchLinesReady = !error && count > 0;
  }
  return purchLinesReady;
}
async function reportData(from, to, cid) {
  const led = await fetchAll(() => { let q = sb.from('ledger').select('id,customer_id,entry_date,kind,amount,note').eq('voided', false)
    .in('kind', ['satis', 'odenis', 'alis', 'tediye']).gte('entry_date', from).lte('entry_date', to).order('id'); if (cid) q = q.eq('customer_id', cid); return q; });
  const useLines = await hasSalesLines();
  let lines = [];
  if (useLines) lines = await fetchAll(() => { let q = sb.from('sales_lines').select('id,sale_date,doc,customer_id,product_id,qty,amount').gte('sale_date', from).lte('sale_date', to).order('id'); if (cid) q = q.eq('customer_id', cid); return q; });
  const usePL = await hasPurchLines();
  let plines = [];
  if (usePL) plines = await fetchAll(() => { let q = sb.from('purchase_lines').select('id,purchase_date,doc,supplier_id,product_id,qty,amount').gte('purchase_date', from).lte('purchase_date', to).order('id'); if (cid) q = q.eq('supplier_id', cid); return q; });
  const sum = (arr, f) => arr.reduce((s, x) => s + Number(f(x) || 0), 0);
  const salesTotal = useLines ? sum(lines, x => x.amount) : sum(led.filter(x => x.kind === 'satis'), x => x.amount);
  return {
    led, lines, useLines, salesTotal, plines, usePL,
    paidIn: -sum(led.filter(x => x.kind === 'odenis'), x => x.amount),
    bought: usePL ? sum(plines, x => x.amount) : -sum(led.filter(x => x.kind === 'alis'), x => x.amount),
    paidOut: sum(led.filter(x => x.kind === 'tediye'), x => x.amount)
  };
}
function csvDownload(name, rows) {
  const txt = '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click();
}
async function viewReports(params) {
  const t = today(), y = t.slice(0, 4), m = t.slice(0, 7);
  const prev = new Date(+y, +t.slice(5, 7) - 2, 1), prevEnd = new Date(+y, +t.slice(5, 7) - 1, 0);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const presets = [['Bu ay', m + '-01', t], ['Keçən ay', iso(prev), iso(prevEnd)], ['Bu il', y + '-01-01', t], ['Keçən il', (y - 1) + '-01-01', (y - 1) + '-12-31'], ['2023-dən', '2023-01-01', t]];
  const from = params.get('from') || m + '-01', to = params.get('to') || t, cid = params.get('c') ? +params.get('c') : null, tab = params.get('tab') || 'musteri';
  const [c, p, al] = await Promise.all([loadCustomers(), loadProducts(), alerts()]);
  const cm = new Map(c.map(x => [x.id, x])), pm = new Map(p.map(x => [x.id, x]));
  const cust = cid ? cm.get(cid) : null;
  const r = await reportData(from, to, cid);
  const link = o => '#hesabatlar?' + new URLSearchParams(Object.fromEntries(Object.entries({ from, to, c: cid || '', tab, ...o }).filter(([, v]) => v !== '' && v != null))).toString();
  // aylar
  const months = {};
  const addM = (d, k, v) => { const key = d.slice(0, 7); months[key] ??= { s: 0, o: 0, a: 0 }; months[key][k] += v; };
  if (r.useLines) r.lines.forEach(x => addM(x.sale_date, 's', +x.amount)); else r.led.filter(x => x.kind === 'satis').forEach(x => addM(x.entry_date, 's', +x.amount));
  r.led.forEach(x => { if (x.kind === 'odenis') addM(x.entry_date, 'o', -x.amount); if (x.kind === 'alis' && !r.usePL) addM(x.entry_date, 'a', -x.amount); });
  if (r.usePL) r.plines.forEach(x => addM(x.purchase_date, 'a', +x.amount));
  // müştərilər
  const byC = {};
  const addC = (id, k, v) => { byC[id] ??= { s: 0, o: 0, a: 0, t: 0 }; byC[id][k] += v; };
  if (r.useLines) r.lines.forEach(x => addC(x.customer_id, 's', +x.amount)); else r.led.filter(x => x.kind === 'satis').forEach(x => addC(x.customer_id, 's', +x.amount));
  r.led.forEach(x => { if (x.kind === 'odenis') addC(x.customer_id, 'o', -x.amount); if (x.kind === 'alis' && !r.usePL) addC(x.customer_id, 'a', -x.amount); if (x.kind === 'tediye') addC(x.customer_id, 't', +x.amount); });
  if (r.usePL) r.plines.forEach(x => { if (x.supplier_id) addC(x.supplier_id, 'a', +x.amount); });
  // məhsullar
  let prodRows = [], prodNote = '';
  if (r.useLines) {
    const byP = {}; const g = id => (byP[id] ??= { q: 0, s: 0, bq: 0, b: 0 });
    r.lines.forEach(x => { const o = g(x.product_id); o.q += +x.qty; o.s += +x.amount; });
    r.plines.forEach(x => { const o = g(x.product_id); o.bq += +x.qty; o.b += +x.amount; });
    prodRows = Object.entries(byP).map(([id, v]) => ({ p: pm.get(+id), ...v })).sort((a, b) => (b.s - a.s) || (b.b - a.b));
  } else if (!cid) {
    const mv = await fetchAll(() => sb.from('stock_moves').select('id,product_id,kind,qty').in('kind', ['satis', 'medaxil']).gte('moved_at', from).lte('moved_at', to + 'T23:59:59').order('id'));
    const byP = {}; mv.forEach(x => { byP[x.product_id] ??= { out: 0, inn: 0 }; if (x.kind === 'satis') byP[x.product_id].out -= +x.qty; else byP[x.product_id].inn += +x.qty; });
    prodRows = Object.entries(byP).map(([id, v]) => ({ p: pm.get(+id), q: v.out, inn: v.inn })).sort((a, b) => b.q - a.q);
    prodNote = 'Məhsul üzrə məbləğ üçün 1C «Продажи» hesabatı yüklənməlidir; hələlik miqdar göstərilir.';
  } else prodNote = 'Müştəri üzrə məhsul siyahısı 1C «Продажи» hesabatı yükləndikdən sonra görünəcək.';
  const tabs = [['musteri', cid ? 'Əməliyyatlar' : 'Müştərilər'], ['ay', 'Aylar'], ['mehsul', 'Məhsullar']];
  let table = '', csv = [];
  if (tab === 'ay') {
    const ks = Object.keys(months).sort();
    csv = [['Ay', 'Satış', 'Daxil olan ödəniş', 'Alış'], ...ks.map(k => [k, months[k].s.toFixed(2), months[k].o.toFixed(2), months[k].a.toFixed(2)])];
    table = `<table class="t"><thead><tr><th>Ay</th><th class="n">Satış</th><th class="n">Daxil olan ödəniş</th><th class="n">Alış</th></tr></thead><tbody>${ks.map(k => `<tr><td>${k}</td><td class="n amt">${money(months[k].s)}</td><td class="n">${money(months[k].o)}</td><td class="n">${money(months[k].a)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Bu dövrdə məlumat yoxdur</td></tr>'}</tbody></table>`;
  } else if (tab === 'mehsul') {
    if (r.useLines) {
      csv = [['Kod', 'Məhsul', 'Satış miqdarı', 'Satış məbləği', 'Alış miqdarı', 'Alış məbləği'], ...prodRows.map(x => [x.p?.code, x.p?.name, x.q, x.s.toFixed(2), x.bq, x.b.toFixed(2)])];
      table = `<table class="t"><thead><tr><th>Məhsul</th><th class="n">Satılıb</th><th class="n">Satış ₼</th><th class="n">Alınıb</th><th class="n">Alış ₼</th></tr></thead><tbody>${prodRows.slice(0, 300).map(x => `<tr><td><a href="#mehsul/${x.p?.id}">${esc(x.p?.name || '—')}</a></td><td class="n">${x.q ? qtyf(x.q) : ''}</td><td class="n amt">${x.s ? money(x.s) : ''}</td><td class="n">${x.bq ? qtyf(x.bq) : ''}</td><td class="n">${x.b ? money(x.b) : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Hərəkət yoxdur</td></tr>'}</tbody></table>`;
    } else {
      csv = [['Kod', 'Məhsul', 'Satılıb (miqdar)', 'Mədaxil (miqdar)'], ...prodRows.map(x => [x.p?.code, x.p?.name, x.q, x.inn])];
      table = `<table class="t"><thead><tr><th>Məhsul</th><th class="n">Satılıb</th><th class="n">Mədaxil</th></tr></thead><tbody>${prodRows.slice(0, 300).map(x => `<tr><td><a href="#mehsul/${x.p?.id}">${esc(x.p?.name || '—')}</a></td><td class="n amt">${qtyf(x.q)}</td><td class="n">${qtyf(x.inn)}</td></tr>`).join('') || `<tr><td colspan="3" class="empty">${cid ? '' : 'Hərəkət yoxdur'}</td></tr>`}</tbody></table>`;
    }
  } else if (cid) {
    const ent = [...r.led.map(x => ({ d: x.entry_date, k: LEDGER[x.kind], a: x.kind === 'satis' ? +x.amount : x.kind === 'odenis' ? -x.amount : x.kind === 'alis' ? -x.amount : +x.amount, n: x.note }))].sort((a, b) => b.d.localeCompare(a.d));
    csv = [['Tarix', 'Növ', 'Məbləğ', 'Qeyd'], ...ent.map(x => [x.d, x.k, x.a.toFixed(2), x.n])];
    table = `<table class="t"><thead><tr><th>Tarix</th><th>Növ</th><th class="n">Məbləğ</th></tr></thead><tbody>${ent.map(x => `<tr><td>${dfmt(x.d)}</td><td>${x.k}</td><td class="n amt">${money(x.a)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Bu dövrdə əməliyyat yoxdur</td></tr>'}</tbody></table>`;
  } else {
    const rows = Object.entries(byC).map(([id, v]) => ({ c: cm.get(+id), ...v })).filter(x => x.c).sort((a, b) => (b.s - a.s) || (b.a - a.a));
    csv = [['Kod', 'Müştəri', 'Satış', 'Daxil olan ödəniş', 'Alış', 'Tədarükçüyə ödəniş', 'Cari saldo'], ...rows.map(x => [x.c.code, x.c.name, x.s.toFixed(2), x.o.toFixed(2), x.a.toFixed(2), x.t.toFixed(2), Number(x.c.balance).toFixed(2)])];
    table = `<table class="t"><thead><tr><th>Müştəri</th><th class="n">Satış</th><th class="n">Ödəniş</th><th class="n">Alış</th><th class="n">Cari saldo</th></tr></thead><tbody>${rows.slice(0, 300).map(x => `<tr><td><a href="${link({ c: x.c.id, tab: 'musteri' })}">${esc(x.c.name)}</a></td><td class="n amt">${x.s ? money(x.s) : ''}</td><td class="n">${x.o ? money(x.o) : ''}</td><td class="n">${x.a ? money(x.a) : ''}</td><td class="n">${money(x.c.balance)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Bu dövrdə əməliyyat yoxdur</td></tr>'}</tbody></table>`;
  }
  mount('hesabatlar', `<div class="head"><div><h1>Hesabat</h1><div class="sub">${dfmt(from)} – ${dfmt(to)}${cust ? ' · ' + esc(cust.name) : ''}</div></div>
      <button class="btn" id="csv">Excel-ə yüklə</button></div>
    <section class="card">
      <div class="chips">${presets.map(([l, a, b]) => `<a class="chip ${a === from && b === to ? 'on' : ''}" href="${link({ from: a, to: b })}">${l}</a>`).join('')}</div>
      <div class="fgrid" style="align-items:end">
        <label class="f">Tarixdən<input class="inp" type="date" id="f1" value="${from}"></label>
        <label class="f">Tarixədək<input class="inp" type="date" id="f2" value="${to}"></label>
        <label class="f" style="grid-column:span 2">Müştəri / tədarükçü<div class="pick" id="cp"><input class="inp" placeholder="Hamısı — ad yazın…" autocomplete="off" value="${esc(cust?.name || '')}"></div></label>
        <div class="row"><button class="btn p" id="go">Göstər</button>${cid ? `<a class="btn" href="${link({ c: '' })}">Müştərini sil</a>` : ''}</div>
      </div></section>
    <div class="kpis">
      <div class="kpi brand"><span class="l">Satış</span><span class="v">${money0(r.salesTotal)}</span><span class="s">${r.useLines ? '1C «Продажи» + tətbiq' : 'borc hərəkətlərinə görə'}</span></div>
      <div class="kpi"><span class="l">Daxil olan ödəniş</span><span class="v">${money0(r.paidIn)}</span></div>
      <div class="kpi"><span class="l">Alış (tədarükçülərdən)</span><span class="v">${money0(r.bought)}</span><span class="s">${r.usePL ? '1C «Закупки» + tətbiq' : 'borc hərəkətlərinə görə'}</span></div>
      <div class="kpi"><span class="l">Tədarükçülərə ödəniş</span><span class="v">${money0(r.paidOut)}</span></div>
    </div>
    <div class="chips">${tabs.map(([k, l]) => `<a class="chip ${k === tab ? 'on' : ''}" href="${link({ tab: k })}">${l}</a>`).join('')}</div>
    ${prodNote && tab === 'mehsul' ? `<div class="note">${prodNote}</div>` : ''}
    <section class="card tight"><div class="scroll">${table}</div></section>`, al);
  let pickC = cid;
  picker(document.getElementById('cp'), withSearch(c), x => `<span>${esc(x.name)}</span><small>${[x.is_buyer && 'alıcı', x.is_supplier && 'tədarükçü'].filter(Boolean).join(', ')}</small>`, x => { pickC = x.id; document.querySelector('#cp input').value = x.name; });
  document.querySelector('#cp input').addEventListener('input', e => { if (!e.target.value.trim()) pickC = null; });
  document.getElementById('go').onclick = () => { location.hash = link({ from: document.getElementById('f1').value || from, to: document.getElementById('f2').value || to, c: pickC || '' }); };
  document.getElementById('csv').onclick = () => csvDownload(`hesabat_${from}_${to}${cust ? '_' + cust.code : ''}_${tab}.csv`, csv);
}

/* ---------- 1C tarixçəsinin idxalı (bir dəfəlik) ---------- */
async function viewImportHistory() {
  const al = await alerts().catch(() => ({}));
  const { count } = await sb.from('ledger').select('id', { count: 'exact', head: true }).like('note', '1C tarixçə%');
  const { count: sc } = await sb.from('sales_lines').select('id', { count: 'exact', head: true }).eq('source', '1c');
  const { count: pc } = await sb.from('purchase_lines').select('id', { count: 'exact', head: true }).eq('source', '1c');
  const { count: dc } = await sb.from('ledger').select('id', { count: 'exact', head: true }).like('note', '1C: %').eq('voided', false);
  const { count: qa } = await sb.from('sales_lines').select('id', { count: 'exact', head: true }).eq('source', '1c').like('doc', 'MGP%-Q');
  const { count: qt } = await sb.from('purchase_lines').select('id', { count: 'exact', head: true }).eq('source', '1c').like('doc', 'MGP%-Q%');
  mount('panel', `<h1>1C satış, alış və ödəniş tarixçəsi</h1>
    <section class="card">
      <div class="${count ? 'note' : 'warnbox'}">1) Ödəniş tarixçəsi (MEDIGROUP_tarixce.json): ${count ? `✓ yüklənib (${count} qeyd)` : 'yüklənməyib'}</div>
      <div class="${sc ? 'note' : 'warnbox'}">2) Satış sətirləri (MEDIGROUP_satis.json): ${sc ? `✓ yüklənib (${sc} sətir)` : 'yüklənməyib'}</div>
      <div class="${pc ? 'note' : 'warnbox'}">3) Alış sətirləri (MEDIGROUP_alis.json): ${pc ? `✓ yüklənib (${pc} sətir)` : 'yüklənməyib'}</div>
      <div class="${dc ? 'note' : 'warnbox'}">4) Ödənişlər sənədlərə görə (MEDIGROUP_odenisler.json): ${dc ? `✓ yüklənib (${dc} qeyd)` : 'yüklənməyib'}</div>
      <div class="${sc && !qa ? 'warnbox' : 'note'}">5) Satış qaytarmaları ayrıca (MEDIGROUP_satis_qaytarma.json): ${qa ? `✓ yüklənib (${qa} qaytarma sətri)` : 'yüklənməyib'}</div>
      <div class="${pc && !qt ? 'warnbox' : 'note'}">6) Tədarükçüyə qaytarmalar ayrıca (MEDIGROUP_alis_qaytarma.json): ${qt ? `✓ yüklənib (${qt} qaytarma sətri)` : 'yüklənməyib'}</div>
      <div class="note">Yüklənəcək faylı seçin (hər dəfə bir fayl).</div><input type="file" id="file" accept=".json,application/json">
      <div id="log" class="note"></div></section>`, al);
  const fi = document.getElementById('file'); if (!fi) return;
  fi.onchange = async () => {
    const log = document.getElementById('log'); const say = m => log.innerHTML += esc(m) + '<br>';
    try {
      const J = JSON.parse(await fi.files[0].text());
      if (J.kind === 'ledger_docs') {
        if (dc) throw new Error('Sənədlərə görə ödənişlər artıq yüklənib');
        fi.disabled = true;
        const before = (await loadCustomers(true)).reduce((s, x) => s + Number(x.balance), 0);
        try {
          for (let i = 0; i < J.rows.length; i += 500) {
            const { error } = await sb.from('ledger').insert(J.rows.slice(i, i + 500)); if (error) throw error;
            log.innerHTML = `Yüklənir: ${Math.min(i + 500, J.rows.length)} / ${J.rows.length}<br>`;
          }
        } catch (err) { await sb.from('ledger').update({ voided: true }).like('note', '1C: %').eq('voided', false); throw err; }
        const { error: e2 } = await sb.from('ledger').update({ voided: true }).like('note', '1C tarixçə%').eq('voided', false);
        if (e2) { await sb.from('ledger').update({ voided: true }).like('note', '1C: %').eq('voided', false); throw e2; }
        invalidate(); alertCache = null;
        const after = (await loadCustomers(true)).reduce((s, x) => s + Number(x.balance), 0);
        say(`✓ ${J.rows.length} qeyd yükləndi.`); say(`Ümumi saldo: əvvəl ${money(before)}, indi ${money(after)}`);
        toast('Ödənişlər yeniləndi'); setTimeout(route, 2500); return;
      }
      if (J.kind === 'purchase_lines') {
        if (pc) throw new Error('Alış sətirləri artıq yüklənib');
        fi.disabled = true;
        for (let i = 0; i < J.rows.length; i += 500) {
          const { error } = await sb.from('purchase_lines').insert(J.rows.slice(i, i + 500)); if (error) throw error;
          log.innerHTML = `Yüklənir: ${Math.min(i + 500, J.rows.length)} / ${J.rows.length}<br>`;
        }
        purchLinesReady = null;
        const total = J.rows.reduce((s, x) => s + Number(x.amount), 0);
        say(`✓ ${J.rows.length} alış sətri yükləndi, cəmi ${money(total)}.`); toast('Alışlar yükləndi');
        setTimeout(route, 1500); return;
      }
      if (J.kind === 'orders_1c_lines') { // 1C alıcı sifarişlərinin məhsul sətirləri
        const { count } = await sb.from('orders_1c_lines').select('id', { count: 'exact', head: true });
        if (count) throw new Error(`Sifariş sətirləri artıq yüklənib (${count} sətir)`);
        fi.disabled = true;
        let n = 0;
        for (let i = 0; i < J.rows.length; i += 500) {
          const { data, error } = await sb.rpc('import_orders_1c_lines', { p_rows: J.rows.slice(i, i + 500) }); if (error) throw error;
          n += data; log.innerHTML = `Yüklənir: ${Math.min(i + 500, J.rows.length)} / ${J.rows.length}<br>`;
        }
        say(`✓ ${n} sifariş sətri yükləndi, cəmi ${money(J.rows.reduce((t, x) => t + Number(x.amount), 0))}.`); toast('Sifariş sətirləri yükləndi');
        setTimeout(() => { location.hash = '#sifarisler?f=1c'; }, 2000); return;
      }
      if (J.kind === 'purchase_lines_replace') { // 1C alışları: tədarükçüyə qaytarmalar ayrıca sətir kimi
        fi.disabled = true;
        const n = J.rows.length, sum = Math.round(J.rows.reduce((s, x) => s + Number(x.amount), 0) * 100) / 100;
        try {
          for (let i = 0; i < n; i += 500) {
            const { error } = await sb.from('purchase_lines').insert(J.rows.slice(i, i + 500).map(r => ({ ...r, source: '1c_new' }))); if (error) throw error;
            log.innerHTML = `Yüklənir: ${Math.min(i + 500, n)} / ${n}<br>`;
          }
          const { data, error } = await sb.rpc('replace_purchases_1c', { p_count: n, p_sum: sum }); if (error) throw error;
          say(`✓ ${data}. Cəmi ${money(sum)}. Tədarükçüyə qaytarma: ${J.rows.filter(x => x.qty < 0).length} sətir.`); toast('Alışlar yeniləndi');
        } catch (e) { await sb.rpc('replace_purchases_1c', { p_count: 0, p_sum: 0, p_discard: true }); throw e; }
        setTimeout(route, 2000); return;
      }
      if (J.kind === 'sales_lines_replace') { // 1C satışları: qaytarmalar ayrıca sətir kimi; köhnə 1C sətirləri yoxlamadan sonra əvəz olunur
        fi.disabled = true;
        const n = J.rows.length, sum = Math.round(J.rows.reduce((s, x) => s + Number(x.amount), 0) * 100) / 100;
        try {
          for (let i = 0; i < n; i += 500) {
            const { error } = await sb.from('sales_lines').insert(J.rows.slice(i, i + 500).map(r => ({ ...r, source: '1c_new' }))); if (error) throw error;
            log.innerHTML = `Yüklənir: ${Math.min(i + 500, n)} / ${n}<br>`;
          }
          const { data, error } = await sb.rpc('replace_sales_1c', { p_count: n, p_sum: sum }); if (error) throw error;
          salesLinesReady = null;
          say(`✓ ${data}. Cəmi ${money(sum)}. Qaytarmalar: ${J.rows.filter(x => x.amount < 0).length} sətir.`); toast('Satışlar yeniləndi');
        } catch (e) { await sb.rpc('replace_sales_1c', { p_count: 0, p_sum: 0, p_discard: true }); throw e; }
        setTimeout(route, 2000); return;
      }
      if (J.kind === 'sales_lines') {
        if (sc) throw new Error('Satış sətirləri artıq yüklənib');
        fi.disabled = true;
        for (let i = 0; i < J.rows.length; i += 500) {
          const { error } = await sb.from('sales_lines').insert(J.rows.slice(i, i + 500)); if (error) throw error;
          log.innerHTML = `Yüklənir: ${Math.min(i + 500, J.rows.length)} / ${J.rows.length}<br>`;
        }
        salesLinesReady = null;
        const total = J.rows.reduce((s, x) => s + Number(x.amount), 0);
        say(`✓ ${J.rows.length} satış sətri yükləndi, cəmi ${money(total)}.`); toast('Satışlar yükləndi');
        setTimeout(route, 1500); return;
      }
      if (J.kind !== 'ledger_history') throw new Error('Bu fayl tanınmadı');
      if (count) throw new Error('Ödəniş tarixçəsi artıq yüklənib');
      fi.disabled = true;
      const before = (await loadCustomers(true)).reduce((s, x) => s + Number(x.balance), 0);
      for (let i = 0; i < J.rows.length; i += 500) {
        const { error } = await sb.from('ledger').insert(J.rows.slice(i, i + 500)); if (error) throw error;
        log.innerHTML = `Yüklənir: ${Math.min(i + 500, J.rows.length)} / ${J.rows.length}<br>`;
      }
      const { error: e2 } = await sb.from('ledger').update({ voided: true }).like('note', '1C-dən:%').eq('voided', false); if (e2) throw e2;
      invalidate(); alertCache = null;
      const after = (await loadCustomers(true)).reduce((s, x) => s + Number(x.balance), 0);
      say(`✓ ${J.rows.length} qeyd yükləndi.`); say(`Ümumi saldo: əvvəl ${money(before)}, indi ${money(after)}`);
      say('Hazırdır.'); toast('Tarixçə yükləndi'); setTimeout(route, 2500);
    } catch (e) { fail(e); say('Xəta: ' + (e.message || e)); }
  };
}

/* ---------- SƏNƏDLƏR (jurnal) ---------- */
const DOC_T = { SQ: ['Satış', 'Satış qaiməsi'], AQ: ['Alış', 'Alış qaiməsi'], QA: ['Alıcıdan qaytarma', 'Alıcıdan qaytarma'], QT: ['Tədarükçüyə qaytarma', 'Tədarükçüyə qaytarma'], PM: ['Pul mədaxili', 'Pul mədaxili'], PX: ['Pul məxarici', 'Pul məxarici'] };
const DOC_NEW = { SQ: ['#yeni-sifaris', '+ Yeni satış'], AQ: ['#medaxil', '+ Mal mədaxili'], QA: ['#qaytarma?t=QA', '+ Alıcıdan qaytarma'], QT: ['#qaytarma?t=QT', '+ Tədarükçüyə qaytarma'], PM: ['#odenis-yeni', '+ Pul mədaxili'], PX: ['#odenis-yeni?t=PX', '+ Pul məxarici'] };
const docHref = x => '#sened?' + new URLSearchParams({ t: x.typ, d: x.doc, y: x.yr, p: x.partner_id ?? '' });
const srcTag = doc => /^MGP/.test(doc || '') ? ' <span class="tag t-grey">1C</span>' : '';

// kontragent adının hərfi: dırnaq və «F/ş» önəklərini nəzərə almadan
const pLetter = n => firstLetter(String(n || '').replace(/^[\s"'“”„«»`]+/, '').replace(/^f\s*\/?\s*ş\.?\s*/i, ''));
const pCmp = (a, b) => azCmp(String(a || '').replace(/^[\s"'“”„«»`]+/, '').replace(/^f\s*\/?\s*ş\.?\s*/i, ''), String(b || '').replace(/^[\s"'“”„«»`]+/, '').replace(/^f\s*\/?\s*ş\.?\s*/i, ''));
async function viewDocs(params) {
  const t = DOC_T[params.get('t')] ? params.get('t') : 'SQ';
  const q = (params.get('q') || '').replace(/[,()*]/g, ' ').trim();
  const d1 = params.get('from') || ''; // tarix avtomatik seçilmir — istifadəçi özü seçir
  const d2 = params.get('to') || '';
  const cid = +params.get('c') || null, L = params.get('l') || '';
  const al = await alerts();
  const all = await fetchAll(() => {
    let qb = sb.from('v_docs').select('*').eq('typ', t).order('doc_date', { ascending: false }).order('doc', { ascending: false });
    if (d1) qb = qb.gte('doc_date', d1);
    if (d2) qb = qb.lte('doc_date', d2);
    if (q) qb = qb.or(`partner_name.ilike.*${q}*,doc.ilike.*${q}*,supplier_doc.ilike.*${q}*`);
    return qb;
  });
  // hərf → həmin hərflə başlayan firmalar; firma → yalnız onun sənədləri
  const byL = L ? all.filter(x => pLetter(x.partner_name) === L) : all;
  const data = cid ? byL.filter(x => x.partner_id === cid) : byL;
  const has = new Set(all.map(x => pLetter(x.partner_name)));
  const firms = []; if (L) { const m = new Map(); byL.forEach(x => { const k = x.partner_id ?? 'x'; const f = m.get(k) || { id: x.partner_id, name: x.partner_name || '—', n: 0, s: 0 }; f.n++; f.s += Number(x.amount); m.set(k, f); }); firms.push(...[...m.values()].sort((a, b) => pCmp(a.name, b.name))); }
  const sum = data.reduce((s, x) => s + Number(x.amount), 0);
  const tm = await docTimes(data).catch(() => new Map());
  const hq = o => '#senedler?' + new URLSearchParams({ t, q, l: L, c: cid || '', from: d1, to: d2, ...o }).toString();
  const per = `${d1 ? dfmt(d1) : 'əvvəldən'} – ${d2 ? dfmt(d2) : 'bu günədək'}`;
  const firm = cid ? firms.find(x => x.id === cid) || { name: data[0]?.partner_name || '' } : null;
  mount('senedler', `
    <div class="head"><div><h1>Sənədlər</h1><div class="sub">${DOC_T[t][0]} · ${data.length} sənəd · cəmi ${money(sum)}</div></div><div class="row"><button class="btn" id="xls">${ico('doc', 16)} Excel-ə yüklə</button><a class="btn p" href="${DOC_NEW[t][0]}">${DOC_NEW[t][1]}</a></div></div>
    <div class="chips">${Object.keys(DOC_T).map(k => `<a class="chip ${k === t ? 'on' : ''}" href="${L || cid || params.has('from') ? '#senedler?' + new URLSearchParams({ t: k, l: L, c: cid || '', from: d1, to: d2 }) : '#senedler?t=' + k}">${DOC_T[k][0]}</a>`).join('')}</div>
    <div class="dfilt">
      <label class="f dq">Axtarış: ad və ya sənəd №<input class="inp" id="q" type="search" placeholder="Ad və ya nömrə yazın…" value="${esc(q)}"></label>
      <label class="f">Tarixdən<input class="inp" type="date" id="d1" value="${d1}"></label>
      <label class="f">Tarixədək<input class="inp" type="date" id="d2" value="${d2}"></label>
      <button class="btn p" id="go">Göstər</button><a class="btn" href="${hq({ from: '', to: '' })}">Bütün illər</a>${L || cid || q ? `<a class="btn" href="${hq({ l: '', c: '', q: '' })}">Filtri sıfırla</a>` : ''}
    </div>
    <div class="letters"><a href="${hq({ l: '', c: '' })}" class="${!L ? 'on' : ''}">Hamısı</a>${[...AZ_LETTERS, '#'].filter(c => has.has(c)).map(c => `<a href="${hq({ l: c, c: '' })}" class="${c === L ? 'on' : ''}">${c}</a>`).join('')}</div>
    ${L ? `<div class="chips">${firms.map(f => `<a class="chip ${f.id === cid ? 'on' : ''}" href="${hq({ c: f.id === cid ? '' : (f.id ?? '') })}">${esc(f.name)} · ${f.n}</a>`).join('')}</div>` : ''}
    ${L || cid ? `<div class="kpis"><div class="kpi"><span class="l">${cid ? esc(firm.name) : `«${esc(L)}» hərfi ilə başlayan ${firms.length} kontragent`} · ${DOC_T[t][0]}</span><span class="v">${money(sum)}</span><span class="s">${data.length} sənəd · ${per}</span></div></div>` : ''}
    <section class="card tight"><div class="list">${data.map(x => `<a class="li" href="${docHref(x)}"><span class="m"><span class="d"><b>${esc(x.doc)}</b> · ${dtfmt(x.doc_date, tm.get(x.doc))}${srcTag(x.doc)}</span><span class="t">${esc(x.partner_name || '—')}</span>${x.supplier_doc ? `<span class="d">tədarükçü qaiməsi ${esc(x.supplier_doc)}</span>` : ''}${(t === 'PM' || t === 'PX') && x.note && !/^1C/.test(x.note) ? `<span class="d">${esc(x.note)}</span>` : ''}</span>
      <span class="r"><span class="amt">${money(x.amount)}</span>${x.lines > 1 ? `<span class="d">${x.lines} sətir</span>` : ''}</span></a>`).join('') || '<div class="empty">Bu dövrdə sənəd yoxdur</div>'}</div></section>`, al);
  document.getElementById('xls').onclick = async e => {
    if (!data.length) return toast('Yükləmək üçün sənəd yoxdur', true);
    const b = e.currentTarget, old = b.innerHTML; b.disabled = true; b.textContent = 'Hazırlanır…';
    try { await exportDocs(t, data, d1, d2); toast(`${data.length} sənəd Excel-ə yükləndi`); } catch (er) { fail(er); }
    b.disabled = false; b.innerHTML = old;
  };
  const go = () => location.hash = hq({ q: document.getElementById('q').value.trim(), from: document.getElementById('d1').value, to: document.getElementById('d2').value });
  document.getElementById('go').onclick = go; document.getElementById('q').onkeydown = e => { if (e.key === 'Enter') go(); };
}
async function docLines(t, doc, y, pid) {
  const sale = t === 'SQ' || t === 'QA';
  const tb = sale ? 'sales_lines' : 'purchase_lines', dc = sale ? 'sale_date' : 'purchase_date', pc = sale ? 'customer_id' : 'supplier_id';
  let qb = sb.from(tb).select('*').eq('doc', doc).gte(dc, `${y}-01-01`).lte(dc, `${y}-12-31`).order('id');
  qb = pid ? qb.eq(pc, pid) : qb.is(pc, null);
  const { data, error } = await qb; if (error) throw error; return data || [];
}

async function viewDoc(params) {
  const t = params.get('t'), d = params.get('d'), y = +params.get('y'), pid = params.get('p') ? +params.get('p') : null;
  if (!DOC_T[t]) { location.hash = '#senedler'; return; }
  const [p, c, al] = await Promise.all([loadProducts(), loadCustomers(), alerts()]);
  const pm = new Map(p.map(x => [x.id, x])), part = c.find(x => x.id === pid);
  const back = `<a class="back" href="#senedler?t=${t}">${ico('back', 16)} Sənədlər</a>`;
  let at = null;
  const headH = (date, extra = '') => `<div class="head"><div><h1>${DOC_T[t][1]} ${esc(d)}${srcTag(d)}</h1><div class="sub">${dtfmt(date, at)} · ${part ? `<a href="#musteri/${part.id}">${esc(part.name)}</a>` : '—'}</div></div><div class="row">${extra}</div></div>`;
  if (t === 'PM' || t === 'PX') {
    const { data: r, error } = await sb.from('v_docs').select('*').eq('typ', t).eq('doc', d).eq('yr', y).eq('partner_id', pid).limit(1).maybeSingle(); if (error) throw error;
    if (!r) { mount('senedler', back + '<div class="empty">Sənəd tapılmadı</div>', al); return; }
    const app_ = /^P[MX]-/.test(d), pq = new URLSearchParams({ t, d, y, p: pid ?? '' });
    if (app_) at = (await docTimes([r])).get(d) || null;
    mount('senedler', back + headH(r.doc_date, `<a class="btn" href="#capdoc?${pq}">${ico('print', 16)} Aç / çap et</a>${app_ ? `<a class="btn" href="#odenis-yeni?${new URLSearchParams({ t, edit: d })}">Düzəlt</a>` : ''}`) + `<section class="card"><dl class="kv"><dt>Sənəd</dt><dd><b>${esc(d)}</b></dd><dt>Tarix</dt><dd>${dtfmt(r.doc_date, at)}</dd><dt>${t === 'PM' ? 'Ödəyən' : 'Alan (tədarükçü)'}</dt><dd>${esc(r.partner_name || '—')}</dd><dt>Məbləğ</dt><dd class="amt">${money(r.amount)}</dd><dt>Qeyd</dt><dd>${esc(r.note || '')}</dd></dl>
      ${app_ ? '<div class="row"><button class="btn danger" id="cdoc">Ləğv et</button></div><div class="note">Məbləğ, tarix və ya müştəri səhvdirsə — «Düzəlt» (nömrə eyni qalır). Ödəniş ümumiyyətlə olmayıbsa — «Ləğv et».</div>' : '<div class="note">1C-dən köçürülmüş sənəd — yalnız baxmaq və çap etmək olar.</div>'}</section>`, al);
    bindCancelDoc(t, d);
    return;
  }
  const lines = await docLines(t, d, y, pid);
  if (!lines.length) { mount('senedler', back + '<div class="empty">Sənəd tapılmadı</div>', al); return; }
  const sale = t === 'SQ' || t === 'QA';
  const date = sale ? lines[0].sale_date : lines[0].purchase_date;
  if (!/^MGP/.test(d)) at = lines.filter(l => l.source !== '1c' && l.created_at).map(l => l.created_at).sort()[0] || null;
  const orderId = lines.find(l => l.order_id)?.order_id;
  let note = '';
  if (!/^MGP/.test(d)) { const { data: lg } = await sb.from('ledger').select('note').eq('doc_no', d).limit(1).maybeSingle(); note = lg?.note || ''; }
  const total = lines.reduce((s, l) => s + Math.abs(Number(l.amount)), 0);
  const extra = [
    orderId ? `<a class="btn" href="#qaime/${orderId}">${ico('print', 16)} Qaiməni aç / çap et</a><a class="btn" href="#sifaris/${orderId}">Sifariş</a>` : t === 'SQ' && /^MGP\d+$/.test(d) ? `<a class="btn p" href="#qaime1c?${new URLSearchParams({ d, y, p: pid ?? '' })}">${ico('print', 16)} Qaiməni aç / çap et</a>` : '',
    t === 'SQ' ? `<a class="btn" href="#qaytarma?${new URLSearchParams({ t: 'QA', p: pid ?? '', base: d, y })}">Alıcıdan qaytarma</a>` : '',
    t === 'SQ' && pid ? docBtns(new URLSearchParams({ d, y, p: pid }).toString()) + `<a class="btn" href="#muqavile/yeni?${new URLSearchParams({ d, y, p: pid })}">Müqavilə</a>` : '',
    t === 'AQ' || t === 'QA' || t === 'QT' ? `<a class="btn${t === 'AQ' ? ' p' : ''}" href="#capdoc?${new URLSearchParams({ t, d, y, p: pid ?? '' })}">${ico('print', 16)} ${t === 'AQ' ? 'Qaiməni aç / çap et' : 'Aç / çap et'}</a>` : '',
    t === 'AQ' ? `<a class="btn" href="#qaytarma?${new URLSearchParams({ t: 'QT', p: pid ?? '', base: d, y })}">Tədarükçüyə qaytar</a>` : '',
    t === 'AQ' && /^AQ-/.test(d) ? `<a class="btn" href="#medaxil?edit=${encodeURIComponent(d)}">Düzəlt</a>` : '',
    (t === 'QA' || t === 'QT') && /^Q[AT]-/.test(d) ? `<a class="btn" href="#qaytarma?${new URLSearchParams({ t, edit: d })}">Düzəlt</a><button class="btn danger" id="cdoc">Ləğv et</button>` : '',
    t === 'SQ' && orderId ? `<a class="btn danger" href="#sifaris/${orderId}">Düzəlt / ləğv et</a>` : ''].join('');
  mount('senedler', back + headH(date, extra) + `
    ${/^MGP\d+-Q$/.test(d) ? `<div class="note">1C-dən: bu qaytarma <b>${esc(d.slice(0, -2))}</b> ${sale ? 'satış' : 'alış'} qaiməsinə əsasən edilib.</div>` : /^MGP\d+-QT$/.test(d) ? `<div class="note">1C-dən: tədarükçüyə qaytarma sənədi <b>${esc(d.slice(0, -3))}</b> (əsas alış qaiməsinə bağlanmayıb).</div>` : ''}${lines[0].supplier_doc ? `<div class="note">Tədarükçünün qaimə №: <b>${esc(lines[0].supplier_doc)}</b></div>` : ''}${note ? `<div class="note">${esc(note)}</div>` : ''}
    <section class="card tight"><div class="scroll"><table class="t"><thead><tr><th>№</th><th>Məhsul</th><th class="n">Miqdar</th><th class="n">Qiymət${sale ? ' (ƏDV daxil)' : ''}</th><th class="n">Məbləğ</th></tr></thead><tbody>
      ${lines.map((l, i) => { const pr = pm.get(l.product_id) || {}; const q = Math.abs(Number(l.qty)), a = Math.abs(Number(l.amount)); return `<tr><td>${i + 1}</td><td>${pr.id ? `<a href="#mehsul/${pr.id}">${esc(pr.name)}</a>` : '—'}<div class="note">kod ${esc(pr.code ?? '')}</div></td><td class="n">${qtyf(q)} ${esc(pr.unit || '')}</td><td class="n">${q ? moneyP(a / q) : ''}</td><td class="n amt">${money(a)}</td></tr>`; }).join('')}
    </tbody><tfoot><tr><td></td><td><b>Cəmi</b></td><td></td><td></td><td class="n amt"><b>${money(total)}</b></td></tr></tfoot></table></div></section>`, al);
  bindCancelDoc(t, d);
}
function bindCancelDoc(t, d) {
  const b = document.getElementById('cdoc'); if (!b) return;
  b.onclick = async () => {
    const what = { QA: 'Mal yenidən anbardan çıxılacaq, müştərinin borcu bərpa olunacaq.', QT: 'Mal anbara qaytarılacaq, tədarükçüyə borcumuz bərpa olunacaq.', PM: 'Ödəniş silinəcək, müştərinin borcu bərpa olunacaq.', PX: 'Ödəniş silinəcək, tədarükçüyə borcumuz bərpa olunacaq.' }[t] || '';
    if (!confirm(`${DOC_T[t][1]} ${d} ləğv edilsin?\n${what}\nBu geri qaytarılmır.`)) return;
    b.disabled = true; const { error } = await sb.rpc('cancel_doc', { p_doc: d }); if (error) { b.disabled = false; return fail(error); }
    invalidate(); alertCache = null; toast(`${d} ləğv edildi`); location.hash = '#senedler?t=' + t;
  };
}

async function viewReturn(params) {
  const t = params.get('t') === 'QT' ? 'QT' : 'QA', buyer = t === 'QA';
  const [p, c, al] = await Promise.all([loadProducts(), loadCustomers(), alerts()]);
  const pm = new Map(p.map(x => [x.id, x]));
  let part = params.get('p') ? c.find(x => x.id === +params.get('p')) : null;
  let preBase = params.get('base') || '', preY = params.get('y') || '';
  const lines = [], editDoc = params.get('edit') || '', own = new Map();
  let editDate = '', editNote = '', editLines = [];
  if (editDoc) {
    if (!new RegExp(`^${t}-\\d\\d-\\d{4}$`).test(editDoc)) { toast('Yalnız proqramda yaradılan qaytarma düzəldilə bilər', true); location.hash = '#senedler?t=' + t; return; }
    const [{ data: mv, error }, { data: lg }] = await Promise.all([
      sb.from('stock_moves').select('*').eq('doc', editDoc).in('kind', ['qaytarma_alici', 'qaytarma_tedarukcu']).order('id'),
      sb.from('ledger').select('note').eq('doc_no', editDoc).limit(1).maybeSingle()]);
    if (error) throw error;
    if (!mv?.length) { toast('Sənəd tapılmadı', true); location.hash = '#senedler?t=' + t; return; }
    part = c.find(x => x.id === mv[0].partner_id) || part;
    editDate = new Date(mv[0].moved_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Baku' });
    preBase = mv[0].note || ''; preY = '';
    editNote = (lg?.note || '').split(' — ').slice(1).join(' — ');
    editLines = mv.map(m => ({ pid: m.product_id, qty: Math.abs(Number(m.qty)), price: p4(m.unit_price) }));
    for (const l of editLines) own.set(l.pid, (own.get(l.pid) || 0) + l.qty);
  }
  const limitOf = async (pid, base) => {
    const { data, error } = await sb.rpc('returnable_qty', { p_type: t, p_partner: part.id, p_product: pid, p_base: base || null }); if (error) throw error;
    let m = Number(data) + (own.get(pid) || 0);
    if (!buyer) { const pr = pm.get(pid); if (pr && pr.kind !== 'xidmət') m = Math.min(m, Number(pr.qty) + (own.get(pid) || 0)); }
    return Math.max(0, m);
  };
  mount('senedler', `<a class="back" href="#senedler?t=${t}">${ico('back', 16)} Sənədlər</a><h1>${DOC_T[t][1]}${editDoc ? ` — düzəliş ${esc(editDoc)}` : ''}</h1>
    <section class="card"><div class="fgrid">
      <label class="f">${buyer ? 'Müştəri' : 'Tədarükçü'}<div class="pick" id="cp"><input class="inp" placeholder="Adı yazın…" autocomplete="off" value="${esc(part?.name || '')}"></div></label>
      <label class="f">Tarix<input class="inp" type="date" id="dt" value="${editDate || today()}"></label>
      <label class="f" style="grid-column:1/-1">Əsas sənəd (${buyer ? 'satış' : 'alış'} qaiməsi)<select class="inp" id="base"><option value="">— əvvəlcə ${buyer ? 'müştəri' : 'tədarükçü'} seçin —</option></select></label>
      <label class="f" style="grid-column:1/-1">Səbəb / qeyd<input class="inp" id="nt" placeholder="məs. zədəli mal, səhv göndəriş" value="${esc(editNote)}"></label>
    </div></section>
    <section class="card"><h2>Qaytarılan məhsullar</h2><div id="lines"></div>
      <label class="f">Məhsul əlavə et<div class="pick" id="pp"><input class="inp" placeholder="Ad, kod və ya artikul…" autocomplete="off"></div></label>
      <div class="note">${buyer ? 'Yalnız bu alıcıya satılmış mal qaytarıla bilər — hər məhsulun yanında ən çox nə qədər qaytarmaq olar göstərilir. Qiymət ƏDV daxil yazılır.' : 'Yalnız bu tədarükçüdən alınmış və anbarda olan mal qaytarıla bilər — hər məhsulun yanında ən çox nə qədər qaytarmaq olar göstərilir. Qiymət alış qiymətidir.'}</div></section>
    <div class="head"><b id="tot"></b><button class="btn p" id="save">${editDoc ? 'Dəyişiklikləri yadda saxla' : 'Qaytarmanı keçir'}</button></div>`, al);
  const sel = document.getElementById('base');
  const loadBases = async () => {
    sel.innerHTML = '<option value="">— əsas sənədsiz —</option>';
    if (!part) return;
    const { data } = await sb.from('v_docs').select('doc,yr,doc_date,amount').eq('typ', buyer ? 'SQ' : 'AQ').eq('partner_id', part.id).order('doc_date', { ascending: false }).limit(300);
    sel.innerHTML += (data || []).map(x => `<option value="${esc(x.doc)}|${x.yr}">${esc(x.doc)} · ${dfmt(x.doc_date)} · ${money(x.amount)}</option>`).join('');
  };
  const draw = () => {
    document.getElementById('lines').innerHTML = lines.length ? `<div class="scroll"><table class="t"><thead><tr><th>Məhsul</th><th class="n">Qaytarılır</th><th class="n">Qiymət ₼</th><th class="n">Məbləğ</th><th></th></tr></thead><tbody>${lines.map((l, i) => `<tr>
      <td>${esc(l.p.name)}<div class="note">kod ${esc(l.p.code ?? '')}${l.max != null ? ` · <b>ən çox ${qtyf(l.max)}</b>` : ''}${!buyer ? ` · anbarda ${qtyf(l.p.qty)}` : ''}</div></td>
      <td class="n"><input class="inp" style="width:90px;text-align:right" type="number" min="0" step="any" data-q="${i}" value="${l.qty}"></td>
      <td class="n"><input class="inp" style="width:110px;text-align:right" type="number" min="0" step="0.0001" data-pr="${i}" value="${l.price}"></td>
      <td class="n amt">${money(l.qty * l.price)}</td>
      <td class="n"><button class="btn sm" data-rm="${i}">Sil</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Əsas qaiməni seçin və ya məhsul əlavə edin</div>';
    document.getElementById('tot').textContent = 'Cəmi: ' + money(lines.reduce((s, l) => s + Math.round(l.qty * l.price * 100) / 100, 0));
    document.querySelectorAll('[data-q]').forEach(e => e.onchange = () => { lines[e.dataset.q].qty = +e.value; draw(); });
    document.querySelectorAll('[data-pr]').forEach(e => e.onchange = () => { lines[e.dataset.pr].price = p4(e.value); draw(); });
    document.querySelectorAll('[data-rm]').forEach(e => e.onclick = () => { lines.splice(+e.dataset.rm, 1); draw(); });
  };
  sel.onchange = async () => {
    lines.length = 0;
    if (sel.value) {
      const [doc, yr] = sel.value.split('|');
      const ls = await docLines(buyer ? 'SQ' : 'AQ', doc, yr, part.id);
      const g = new Map();
      for (const l of ls) { const k = l.product_id; const x = g.get(k) || { q: 0, a: 0 }; x.q += Number(l.qty); x.a += Number(l.amount); g.set(k, x); }
      for (const [k, x] of g) if (x.q > 0 && pm.get(k)) { const mx = await limitOf(k, doc); if (mx > 0) lines.push({ p: pm.get(k), qty: mx, max: mx, price: p4(x.a / x.q) }); }
      if (!lines.length) toast('Bu qaimə üzrə qaytarıla bilən mal qalmayıb', true);
    }
    draw();
  };
  picker(document.getElementById('cp'), withSearch(c.filter(x => buyer ? x.is_buyer : x.is_supplier)), x => `<span>${esc(x.name)}</span>`, async x => {
    part = x; document.querySelector('#cp input').value = x.name; lines.length = 0; draw(); await loadBases();
  });
  picker(document.getElementById('pp'), withSearch(p), x => `<span>${esc(x.name)} <small>kod ${esc(x.code ?? '')}</small></span><small>${qtyf(x.qty)} ${esc(x.unit)}</small>`, async x => {
    document.querySelector('#pp input').value = '';
    if (!part) return toast(buyer ? 'Əvvəl müştərini seçin' : 'Əvvəl tədarükçünü seçin', true);
    const base = sel.value ? sel.value.split('|')[0] : '';
    const mx = await limitOf(x.id, base);
    if (!(mx > 0)) return toast(buyer ? `«${x.name}» bu alıcıya${base ? ' bu qaimə ilə' : ''} satılmayıb (və ya hamısı qaytarılıb) — qaytarmaq olmaz` : `«${x.name}» bu tədarükçüdən${base ? ' bu qaimə ilə' : ''} alınmayıb və ya anbarda yoxdur — qaytarmaq olmaz`, true);
    lines.push({ p: x, qty: Math.min(1, mx), max: mx, price: 0 }); draw();
  });
  await loadBases();
  if (editDoc) {
    const opt = [...sel.options].find(o => o.value.split('|')[0] === preBase); if (opt) sel.value = opt.value;
    for (const l of editLines) { const pr = pm.get(l.pid); if (pr) lines.push({ p: pr, qty: l.qty, max: await limitOf(l.pid, preBase), price: l.price }); }
    draw();
  } else if (preBase && preY && [...sel.options].some(o => o.value === `${preBase}|${preY}`)) { sel.value = `${preBase}|${preY}`; await sel.onchange(); } else draw();
  document.getElementById('save').onclick = async e => {
    if (!part) return toast(buyer ? 'Müştəri seçin' : 'Tədarükçü seçin', true);
    const good = lines.filter(l => l.qty > 0); if (!good.length) return toast('Qaytarılan məhsul yoxdur', true);
    const agg = new Map(); for (const l of good) agg.set(l.p.id, (agg.get(l.p.id) || 0) + l.qty);
    const over = good.find(l => l.max != null && agg.get(l.p.id) > l.max + 1e-9); if (over) return toast(`«${over.p.name}»: ən çox ${qtyf(over.max)} qaytarmaq olar`, true);
    if (good.some(l => !(l.price > 0))) return toast('Hər məhsulun qiymətini yazın', true);
    const dt = document.getElementById('dt').value || today();
    const tot = good.reduce((s, l) => s + Math.round(l.qty * l.price * 100) / 100, 0);
    if (!confirm(`${DOC_T[t][1]} ${editDoc ? editDoc + ' yenidən yazılsın' : 'keçirilsin'}?\n${part.name} · ${money(tot)}\n${buyer ? 'Mal anbara qayıdacaq, müştərinin borcu azalacaq.' : 'Mal anbardan çıxacaq, tədarükçüyə borcumuz azalacaq.'}`)) return;
    e.target.disabled = true;
    const base = sel.value ? sel.value.split('|')[0] : '';
    const { data: no, error } = await sb.rpc(buyer ? 'post_return_buyer' : 'post_return_supplier', { p_date: dt, [buyer ? 'p_customer' : 'p_supplier']: part.id, p_base: base, p_lines: good.map(l => ({ product_id: l.p.id, qty: l.qty, price: l.price })), p_note: document.getElementById('nt').value.trim(), p_doc: editDoc || null });
    if (error) { e.target.disabled = false; return fail(error); }
    invalidate(); alertCache = null; toast(`${DOC_T[t][1]} ${no} ${editDoc ? 'düzəldildi' : 'keçirildi'}`);
    location.hash = '#sened?' + new URLSearchParams({ t, d: no, y: dt.slice(0, 4), p: part.id });
  };
}

/* ---------- HESAB ÇIXARIŞI (kontragentin bütün hərəkətləri, qalıqla) ---------- */
const ST_KIND = { SQ: 'Satış', QA: 'Alıcıdan qaytarma', PM: 'Pul mədaxili (ödəniş aldıq)', PX: 'Pul məxarici (ödəniş etdik)', AQ: 'Alış', QT: 'Tədarükçüyə qaytarma', kohne: 'Köhnə borc (2023-dən əvvəl)', baslangic: 'Başlanğıc qalıq', duzelis: 'Düzəliş' };
const ST_TAG = { SQ: 't-ok', QA: 't-warn', PM: 't-blue', PX: 't-violet', AQ: 't-grey', QT: 't-warn', kohne: 't-grey', baslangic: 't-grey', duzelis: 't-grey' };
async function viewStatement(id, params) {
  const d1 = params.get('from') || '', d2 = params.get('to') || '';
  const [c, led, docs, al] = await Promise.all([loadCustomers(),
    fetchAll(() => sb.from('ledger').select('id,entry_date,kind,amount,note,doc_no,order_id').eq('customer_id', id).eq('voided', false).order('entry_date').order('id')),
    fetchAll(() => sb.from('v_docs').select('typ,doc,yr,doc_date,amount').eq('partner_id', id)), alerts()]);
  const x = c.find(k => k.id === id); if (!x) { location.hash = '#musteriler'; return; }
  // ledger sətirini sənədlə tutuşdur (növ + tarix + məbləğ)
  const pool = new Map(); for (const dd of docs) { const k = `${dd.typ}|${dd.doc_date}|${Number(dd.amount).toFixed(2)}`; (pool.get(k) || pool.set(k, []).get(k)).push(dd); }
  const typOf = l => l.kind === 'satis' ? (l.amount >= 0 ? 'SQ' : 'QA') : l.kind === 'odenis' ? 'PM' : l.kind === 'tediye' ? 'PX' : l.kind === 'alis' ? (l.amount <= 0 ? 'AQ' : 'QT') : l.kind;
  let bal = 0; const all = led.map(l => { const a = Number(l.amount); bal = Math.round((bal + a) * 100) / 100; const t = typOf(l);
    const m = pool.get(`${t}|${l.entry_date}|${Math.abs(a).toFixed(2)}`); const dd = m && m.length ? m.shift() : null;
    return { ...l, a, bal, t, dd }; });
  const opening = d1 ? (all.filter(r => r.entry_date < d1).at(-1)?.bal ?? 0) : 0;
  const rows = all.filter(r => (!d1 || r.entry_date >= d1) && (!d2 || r.entry_date <= d2));
  const plus = rows.filter(r => r.a > 0).reduce((s, r) => s + r.a, 0), minus = rows.filter(r => r.a < 0).reduce((s, r) => s - r.a, 0);
  const closing = rows.length ? rows.at(-1).bal : opening;
  const balTxt = v => v > 0.005 ? `${money(v)} <small>bizə borcludur</small>` : v < -0.005 ? `${money(-v)} <small>biz borcluyuq / avans</small>` : '0';
  const docCell = r => { const dn = r.dd?.doc || r.doc_no || (r.note || '').match(/MGP\d+/)?.[0] || '';
    return r.dd ? `<a href="#sened?${new URLSearchParams({ t: r.dd.typ, d: r.dd.doc, y: r.dd.yr, p: id })}">${esc(dn)}</a>` : r.order_id ? `<a href="#sifaris/${r.order_id}">${esc(dn || 'sifariş')}</a>` : esc(dn); };
  const hq = o => `#cixaris/${id}?` + new URLSearchParams(Object.fromEntries(Object.entries({ from: d1, to: d2, ...o }).filter(([, v]) => v)));
  mount('musteriler', `<a class="back" href="#musteri/${id}">${ico('back', 16)} ${esc(x.name)}</a>
    <div class="head"><div><h1>Hesab çıxarışı</h1><div class="sub">${esc(x.name)} · bütün satış, alış, qaytarma və ödənişlər tarix ardıcıllığı ilə</div></div>
      <div class="row"><button class="btn" id="csv">Excel (CSV) yüklə</button></div></div>
    <div class="fgrid" style="align-items:end">
      <label class="f">Tarixdən<input class="inp" type="date" id="d1" value="${d1}"></label>
      <label class="f">Tarixədək<input class="inp" type="date" id="d2" value="${d2}"></label>
      <div class="row"><button class="btn p" id="go">Göstər</button>${d1 || d2 ? `<a class="btn" href="#cixaris/${id}">Bütün dövr</a>` : ''}
        <a class="btn" href="${hq({ from: today().slice(0, 4) + '-01-01', to: '' })}">Bu il</a><a class="btn" href="${hq({ from: today().slice(0, 8) + '01', to: '' })}">Bu ay</a></div>
    </div>
    <div class="kpis">
      <div class="kpi"><span class="l">Dövrün əvvəlinə qalıq</span><span class="v">${balTxt(opening)}</span></div>
      <div class="kpi"><span class="l">Artım (+)</span><span class="v">${money(plus)}</span><span class="s">satış, tədarükçüyə qaytarma, ödədiyimiz</span></div>
      <div class="kpi"><span class="l">Azalma (−)</span><span class="v">${money(minus)}</span><span class="s">ödəniş aldığımız, qaytarma, alış</span></div>
      <div class="kpi brand"><span class="l">Dövrün sonuna qalıq</span><span class="v">${balTxt(closing)}</span></div>
    </div>
    <section class="card tight"><div class="scroll"><table class="t"><thead><tr><th>Tarix</th><th>Əməliyyat</th><th>Sənəd</th><th>Qeyd</th><th class="n">Artım (+)</th><th class="n">Azalma (−)</th><th class="n">Qalıq</th></tr></thead><tbody>
      ${d1 ? `<tr><td>${dfmt(d1)}</td><td colspan="5"><i>Dövrün əvvəlinə qalıq</i></td><td class="n amt">${money(opening)}</td></tr>` : ''}
      ${rows.map(r => `<tr><td>${dfmt(r.entry_date)}</td><td><span class="tag ${ST_TAG[r.t] || 't-grey'}">${ST_KIND[r.t] || esc(r.kind)}</span></td><td>${docCell(r)}</td><td class="note" style="max-width:320px">${esc((r.note || '').replace(/^1C( tarixçə)?:\s*/, ''))}</td>
        <td class="n amt">${r.a > 0 ? money(r.a) : ''}</td><td class="n amt" style="color:var(--ok)">${r.a < 0 ? money(-r.a) : ''}</td><td class="n amt"><b>${money(r.bal)}</b></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Bu dövrdə hərəkət yoxdur</td></tr>'}
    </tbody><tfoot><tr><td colspan="4"><b>Cəmi dövr üzrə</b></td><td class="n amt"><b>${money(plus)}</b></td><td class="n amt"><b>${money(minus)}</b></td><td class="n amt"><b>${money(closing)}</b></td></tr></tfoot></table></div></section>
    <div class="note">Qalıq müsbətdirsə kontragent bizə borcludur, mənfidirsə biz ona borcluyuq (və ya onun avansı var). Sənəd nömrəsinə basanda sənədin içi açılır.</div>`, al);
  document.getElementById('go').onclick = () => location.hash = hq({ from: document.getElementById('d1').value, to: document.getElementById('d2').value });
  document.getElementById('csv').onclick = () => {
    const lines = [['Tarix', 'Əməliyyat', 'Sənəd', 'Qeyd', 'Artım', 'Azalma', 'Qalıq'], ...(d1 ? [[d1, 'Dövrün əvvəlinə qalıq', '', '', '', '', opening.toFixed(2)]] : []),
      ...rows.map(r => [r.entry_date, ST_KIND[r.t] || r.kind, r.dd?.doc || r.doc_no || '', (r.note || '').replace(/"/g, "'"), r.a > 0 ? r.a.toFixed(2) : '', r.a < 0 ? (-r.a).toFixed(2) : '', r.bal.toFixed(2)])];
    const blob = new Blob(['\uFEFF' + lines.map(l => l.map(v => `"${v}"`).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Hesab_cixarisi_${x.name.replace(/[^\wƏəÜüÖöĞğİıŞşÇç]+/g, '_')}.csv`; a.click();
  };
}

async function viewNewPayment(params) {
  const px = params.get('t') === 'PX';
  const [c0, al] = await Promise.all([loadCustomers(), alerts()]);
  const c = c0.filter(x => px ? x.is_supplier : true);
  const editDoc = params.get('edit') || '';
  let row = null;
  if (editDoc) {
    if (!/^P[MX]-\d\d-\d{4}$/.test(editDoc)) { toast('Yalnız proqramda yaradılan ödəniş düzəldilə bilər', true); location.hash = '#senedler?t=' + (px ? 'PX' : 'PM'); return; }
    const { data, error } = await sb.from('ledger').select('*').eq('doc_no', editDoc).eq('voided', false).limit(1).maybeSingle(); if (error) throw error;
    if (!data) { toast('Sənəd tapılmadı', true); location.hash = '#senedler?t=' + (px ? 'PX' : 'PM'); return; }
    row = data;
  }
  const pre = row ? c0.find(x => x.id === row.customer_id) : params.get('c') ? c0.find(x => x.id === +params.get('c')) : null;
  mount('senedler', `<a class="back" href="#senedler?t=${px ? 'PX' : 'PM'}">${ico('back', 16)} Sənədlər</a><h1>${px ? 'Pul məxarici — tədarükçüyə ödəniş' : 'Pul mədaxili — ödəniş qəbul et'}${row ? ` — düzəliş ${esc(editDoc)}` : ''}</h1>
    <section class="card"><label class="f">${px ? 'Tədarükçü' : 'Müştəri'}<div class="pick" id="cp"><input class="inp" placeholder="Adı yazın…" autocomplete="off" value="${esc(pre?.name || '')}"></div></label>
    <div id="info" class="note"></div>
    <div class="fgrid"><label class="f">Məbləğ ₼<input class="inp" id="pa" type="number" min="0" step="0.01" placeholder="0.00" value="${row ? Math.abs(Number(row.amount)) : ''}"></label>
    <label class="f">Tarix<input class="inp" id="pd" type="date" value="${row ? row.entry_date : today()}"></label></div>
    <label class="f">Qeyd<input class="inp" id="pn" placeholder="məs. bank köçürməsi, nağd" value="${esc(row?.note || '')}"></label>
    <div class="row"><button class="btn p" id="pay" ${pre ? '' : 'disabled'}>${row ? 'Dəyişiklikləri yadda saxla' : px ? 'Məxarici yaz' : 'Mədaxili yaz'}</button></div>
    <div class="note">${px ? 'Sənədə avtomatik PX nömrəsi veriləcək; tədarükçüyə borcumuz azalacaq.' : 'Sənədə avtomatik PM nömrəsi veriləcək; ödəniş müştərinin ən köhnə borcundan bağlanır.'}</div></section>`, al);
  let cust = pre;
  const info = x => { document.getElementById('info').innerHTML = !x ? '' : px ? `Bizim borcumuz: <b>${money(Math.max(0, -x.balance))}</b>` : `Borc: <b>${money(Math.max(0, x.balance))}</b>${x.overdue >= 1 ? ` · gecikən <b style="color:var(--red)">${money(x.overdue)}</b>` : ''}`; };
  info(cust);
  const list = c.slice().sort((a, b) => px ? a.balance - b.balance : b.balance - a.balance);
  picker(document.getElementById('cp'), withSearch(list), x => `<span>${esc(x.name)}</span><small>${px ? (x.balance <= -1 ? 'borcumuz ' + money0(-x.balance) : '') : (x.balance >= 1 ? 'borc ' + money0(x.balance) : '')}</small>`, x => {
    cust = x; document.querySelector('#cp input').value = x.name; info(x); document.getElementById('pay').disabled = false; document.getElementById('pa').focus();
  });
  document.getElementById('pay').onclick = async e => {
    const a = Math.round(+document.getElementById('pa').value * 100) / 100; if (!cust) return toast(px ? 'Tədarükçü seçin' : 'Müştəri seçin', true); if (!(a > 0)) return toast('Məbləğ yazın', true);
    e.target.disabled = true;
    if (row) {
      const { error } = await sb.from('ledger').update({ customer_id: cust.id, amount: px ? a : -a, entry_date: document.getElementById('pd').value || today(), note: document.getElementById('pn').value || (px ? 'Tədarükçüyə ödəniş' : 'Ödəniş') }).eq('id', row.id);
      if (error) { e.target.disabled = false; return fail(error); }
      invalidate(); alertCache = null; toast(`${editDoc} düzəldildi: ` + money(a));
      location.hash = '#sened?' + new URLSearchParams({ t: px ? 'PX' : 'PM', d: editDoc, y: (document.getElementById('pd').value || today()).slice(0, 4), p: cust.id });
      return;
    }
    const { data: pd, error } = await sb.from('ledger').insert({ customer_id: cust.id, kind: px ? 'tediye' : 'odenis', amount: px ? a : -a, entry_date: document.getElementById('pd').value || today(), note: document.getElementById('pn').value || (px ? 'Tədarükçüyə ödəniş' : 'Ödəniş') }).select('doc_no,entry_date').single();
    if (error) { e.target.disabled = false; return fail(error); }
    invalidate(); alertCache = null; toast(`${px ? 'Pul məxarici' : 'Pul mədaxili'} ${pd?.doc_no || ''}: ` + money(a));
    location.hash = '#sened?' + new URLSearchParams({ t: px ? 'PX' : 'PM', d: pd.doc_no, y: pd.entry_date.slice(0, 4), p: cust.id });
  };
}

/* ---------- İDXAL (bir dəfəlik, 1C-dən) ---------- */
async function viewImport() {
  const al = await alerts().catch(() => ({}));
  const { count } = await sb.from('products').select('id', { count: 'exact', head: true });
  mount('panel', `<h1>1C məlumatlarının idxalı</h1>
    <section class="card">${count ? `<div class="warnbox">Bazada artıq ${count} məhsul var. İdxal yalnız boş bazaya edilir.</div>` : `
      <div class="note">«MEDIGROUP_idxal.json» faylını seçin. Bu, bir dəfəlik əməliyyatdır.</div>
      <input type="file" id="file" accept=".json,application/json">
      <div id="log" class="note"></div>`}</section>`, al);
  const fi = document.getElementById('file'); if (!fi) return;
  fi.onchange = async () => {
    const log = document.getElementById('log'); const say = m => log.innerHTML += esc(m) + '<br>';
    try {
      const J = JSON.parse(await fi.files[0].text()); fi.disabled = true;
      const put = async (table, rows, size = 500, opts) => {
        for (let i = 0; i < rows.length; i += size) {
          const { error } = opts ? await sb.from(table).upsert(rows.slice(i, i + size), opts) : await sb.from(table).insert(rows.slice(i, i + size));
          if (error) throw new Error(table + ': ' + error.message);
        }
        say(`✓ ${table}: ${rows.length}`);
      };
      await put('customers', J.customers);
      await put('products', J.products);
      await put('stock_moves', J.stock_moves);
      await put('products', J.products, 500, { onConflict: 'id' }); // 100% bazasını bərpa et
      await put('ledger', J.ledger);
      invalidate(); alertCache = null;
      say('Hazırdır. Panelə keçə bilərsiniz.'); toast('İdxal tamamlandı');
    } catch (e) { fail(e); say('Xəta: ' + e.message); }
  };
}

/* ---------- hesab: öz şifrəsi; rəhbər üçün istifadəçilərin şifrəsi ---------- */
const pwFields = (id, label) => `<div class="fgrid"><label class="f">${label}<input class="inp" type="password" id="${id}1" minlength="8" autocomplete="new-password" required></label>
  <label class="f">Şifrəni təkrarlayın<input class="inp" type="password" id="${id}2" minlength="8" autocomplete="new-password" required></label></div>`;
function readPw(id) {
  const a = document.getElementById(id + '1').value, b = document.getElementById(id + '2').value;
  if (a.length < 8) { toast('Şifrə ən azı 8 simvol olmalıdır', true); return null; }
  if (a !== b) { toast('Şifrələr eyni deyil', true); return null; }
  return a;
}
async function viewAccount() {
  const al = await alerts();
  let users = [];
  if (isAdmin()) { const { data, error } = await sb.rpc('admin_users'); if (error) return fail(error); users = data || []; }
  const me = (state.user?.email || '').toLowerCase();
  const others = users.filter(u => (u.email || '').toLowerCase() !== me);
  const dt = x => x ? new Date(x).toLocaleString('ru-RU', { timeZone: 'Asia/Baku', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'hələ daxil olmayıb';
  const sealHTML = await sealCard();
  const waNum = isAdmin() ? await getSetting('wa_accountant').catch(() => '') : '';
  mount('panel', `<a class="back" href="#panel">${ico('back', 16)} Panel</a><h1>Hesab</h1>
    <section class="card"><h2>Şifrəni dəyiş</h2><div class="note" style="margin-bottom:10px">${esc(me)}</div>
      <form id="selfpw">${pwFields('sp', 'Yeni şifrə (ən azı 8 simvol)')}<div class="row"><button class="btn p">Şifrəni saxla</button><button type="button" class="btn" id="logout2">Çıxış</button></div></form></section>
    ${sealHTML}
    ${isAdmin() ? `<section class="card"><h2>Mühasibin WhatsApp nömrəsi</h2><div class="note" style="margin-bottom:10px">QRP, hesab-faktura və aktdakı «WhatsApp → mühasib» düyməsi bu nömrəyə söhbət açır (e-qaimə üçün məlumatlar).</div>
      <form id="waf" class="row"><input class="inp" id="wan" inputmode="tel" placeholder="+994 50 123 45 67" value="${esc(waNum)}" style="max-width:260px"><button class="btn p">Saxla</button></form></section>` : ''}
    ${isAdmin() ? `<section class="card"><h2>Dəyişiklik jurnalı</h2><div class="note" style="margin-bottom:10px">Kim, nə vaxt, hansı sənədi yaradıb, dəyişib və ya ləğv edib. Ləğv edilmiş sənədləri buradan bərpa etmək olar.</div><a class="btn p" href="#jurnal">Jurnalı aç</a></section>` : ''}
    ${isAdmin() ? `<section class="card"><h2>İstifadəçilər</h2>
      <div class="note" style="margin-bottom:10px">İşçi şifrəni unudubsa, burada ona yeni şifrə qoyun və şifrəni ona özünüz deyin. Onun başqa cihazlarda açıq qalan girişləri bağlanacaq.</div>
      <div class="list">${others.map((u, i) => `<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
          <span class="m"><span class="t">${esc(u.email)}</span><span class="d">son giriş: ${esc(dt(u.last_sign_in_at))}</span></span>
          <button type="button" class="btn" data-open="${i}">Yeni şifrə qoy</button></div>
        <form class="upw" data-i="${i}" hidden style="margin-top:12px">${pwFields('u' + i, 'Yeni şifrə — ' + esc(u.email))}<div class="row"><button class="btn p">Saxla</button><button type="button" class="btn" data-close="${i}">Bağla</button></div></form></div>`).join('') || '<div class="empty">Başqa istifadəçi yoxdur</div>'}</div>
      <div class="note" style="margin-top:12px">Yeni işçi əlavə etmək üçün: Supabase → Authentication → Users → <b>Add user → Create new user</b> («Auto Confirm User» işarəli). Sonra o, bu siyahıda görünəcək.</div></section>` : ''}`, al);
  bindSeal();
  const waf = document.getElementById('waf');
  if (waf) waf.onsubmit = async e => { e.preventDefault(); const raw = document.getElementById('wan').value.trim(); const n = waNorm(raw);
    if (raw && !n) return toast('Nömrəni düzgün yazın, məsələn +994 50 123 45 67', true);
    try { await setSetting('wa_accountant', n ? '+' + n : ''); document.getElementById('wan').value = n ? '+' + n : ''; toast('Nömrə saxlanıldı'); } catch (er) { fail(er); } };
  document.getElementById('selfpw').onsubmit = async e => {
    e.preventDefault(); const pw = readPw('sp'); if (!pw) return;
    const b = e.target.querySelector('button.p'); b.disabled = true;
    const { error } = await sb.auth.updateUser({ password: pw }); b.disabled = false;
    if (error) return fail(error);
    e.target.reset(); toast('Şifrəniz dəyişdirildi');
  };
  $app.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const f = $app.querySelector(`form.upw[data-i="${b.dataset.open}"]`); f.hidden = false; f.querySelector('input').focus(); });
  $app.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { const f = $app.querySelector(`form.upw[data-i="${b.dataset.close}"]`); f.reset(); f.hidden = true; });
  $app.querySelectorAll('form.upw').forEach(f => f.onsubmit = async e => {
    e.preventDefault(); const i = f.dataset.i, u = others[+i]; const pw = readPw('u' + i); if (!pw) return;
    const b = f.querySelector('button.p'); b.disabled = true;
    const { error } = await sb.rpc('admin_set_password', { p_email: u.email, p_password: pw }); b.disabled = false;
    if (error) return fail(error);
    f.reset(); f.hidden = true; toast(`${u.email} üçün yeni şifrə saxlanıldı`);
  });
}

/* ---------- Qiymət təklifləri (anbar, borc və qaimələrə təsir etmir) ---------- */
const OFFER_ST = { qaralama: ['Aktiv', 't-ok'], tesdiq: ['Aktiv', 't-ok'], legv: ['Ləğv edilib', 't-grey'] };
const OFFER_PH = { az: { unit: 'əd', d_delivery: '15 iş günüdür', d_payment: 'Razılaşma yolu ilə', d_warranty: '1 ildir', d_place: 'Bakı şəhəri' },
  en: { unit: 'pcs', d_delivery: '15 working days', d_payment: 'by agreement', d_warranty: '1 year', d_place: 'Baku' } };
const OFFER_DEF = () => ({ id: null, no: null, status: 'qaralama', offer_date: today(), customer_id: null, customer_name: '', lang: 'az', currency: 'AZN', vat_included: true,
  warranty: '', delivery: '', place: '', payment: '', valid_days: 30, extra_terms: '', groups: [{ title: '', items: [{ name: '', qty: 1, unit: '', price: '', img: null }] }] });
const imgCache = new Map();
async function offerImgs(ids) {
  const need = [...new Set(ids.filter(x => x && !imgCache.has(x)))];
  for (let i = 0; i < need.length; i += 50) {
    const { data, error } = await sb.from('offer_images').select('id,mime,w,h,data').in('id', need.slice(i, i + 50)); if (error) throw error;
    data.forEach(r => imgCache.set(r.id, r));
  }
}
const imgSrc = id => { const r = imgCache.get(id); return r ? `data:${r.mime};base64,${r.data}` : ''; };
let offerCat = null;
async function loadOfferCatalog() { if (!offerCat) offerCat = await fetchAll(() => sb.from('offer_catalog').select('id,name,name_ru,img_id').order('name')); return offerCat; }
// şəkli kiçildib JPEG-ə çevirir və bazaya yazır → offer_images id
async function storeImage(blob, src) {
  const bm = await createImageBitmap(blob);
  const s = Math.min(1, 420 / Math.max(bm.width, bm.height)); const w = Math.round(bm.width * s), h = Math.round(bm.height * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(bm, 0, 0, w, h);
  const data = c.toDataURL('image/jpeg', 0.84).split(',')[1];
  const { data: r, error } = await sb.from('offer_images').insert({ src: src || 'yükləmə', mime: 'image/jpeg', w, h, data }).select('id').single(); if (error) throw error;
  imgCache.set(r.id, { id: r.id, mime: 'image/jpeg', w, h, data }); return r.id;
}

async function viewOffers(params) {
  const f = params.get('f') || 'hamisi'; const q = (params.get('q') || '').replace(/[,()*%]/g, ' ').trim();
  let qb = sb.from('offers').select('id,no,offer_date,customer_name,status,groups,created_by,created_at,currency,lang').order('offer_date', { ascending: false }).order('id', { ascending: false }).limit(300);
  if (f === 'aktiv') qb = qb.neq('status', 'legv'); else if (f === 'legv') qb = qb.eq('status', 'legv');
  if (q) qb = qb.or(`no.ilike.*${q}*,customer_name.ilike.*${q}*`);
  const [{ data, error }, al] = await Promise.all([qb, alerts()]); if (error) throw error;
  const hq = o => '#teklifler?' + new URLSearchParams(Object.fromEntries(Object.entries({ f, q, ...o }).filter(([, v]) => v && v !== 'hamisi')));
  const cnt = o => (o.groups || []).reduce((t, g) => t + (g.items || []).length, 0);
  mount('teklifler', `
    <div class="head"><div><h1>Qiymət təklifləri</h1><div class="sub">${data.length} təklif · anbar və borclara təsir etmir</div></div><a class="btn p" href="#teklif/yeni">+ Yeni təklif</a></div>
    <div class="fgrid" style="align-items:end"><label class="f" style="grid-column:span 2">Müştəri və ya təklif №<input class="inp" id="q" type="search" value="${esc(q)}" placeholder="Ad və ya MG-2026-…"></label>
      <div class="row"><button class="btn p" id="go">Göstər</button>${q ? `<a class="btn" href="${hq({ q: '' })}">Təmizlə</a>` : ''}</div></div>
    <div class="chips">${[['hamisi', 'Hamısı'], ['aktiv', 'Aktiv'], ['legv', 'Ləğv edilən']].map(([k, l]) => `<a class="chip ${k === f ? 'on' : ''}" href="${hq({ f: k })}">${l}</a>`).join('')}</div>
    <section class="card tight"><div class="list">${data.map(o => `<a class="li" href="#teklif/${o.id}"><span class="m"><span class="d"><b>${esc(o.no)}</b> · ${dtfmt(o.offer_date, o.created_at)} · ${esc((o.created_by || '').replace('@medigroup.az', ''))}${o.lang === 'en' ? ' · EN' : ''}</span><span class="t">${esc(o.customer_name || '—')}</span></span>
      <span class="r"><span class="tag ${OFFER_ST[o.status][1]}">${OFFER_ST[o.status][0]}</span><span class="d">${cnt(o)} məhsul · ${esc(o.currency)}</span></span></a>`).join('') || '<div class="empty">Təklif yoxdur</div>'}</div></section>`, al);
  const go = () => location.hash = hq({ q: document.getElementById('q').value.trim() });
  document.getElementById('go').onclick = go; document.getElementById('q').onkeydown = e => { if (e.key === 'Enter') go(); };
}

async function viewOffer(id, params) {
  const [al, cust, cat, prods] = await Promise.all([alerts(), loadCustomers(), loadOfferCatalog(), loadProducts()]);
  let o;
  if (id === 'yeni') {
    o = OFFER_DEF();
    const from = params.get('from');
    if (from) { const { data, error } = await sb.from('offers').select('*').eq('id', +from).single(); if (error) throw error;
      o = { ...OFFER_DEF(), ...data, id: null, no: null, status: 'qaralama', offer_date: today(), groups: data.groups }; }
  } else {
    const { data, error } = await sb.from('offers').select('*').eq('id', +id).maybeSingle(); if (error) throw error;
    if (!data) { mount('teklifler', '<div class="empty">Təklif tapılmadı</div>', al); return; }
    o = data;
  }
  o.groups = JSON.parse(JSON.stringify(o.groups && o.groups.length ? o.groups : OFFER_DEF().groups));
  await offerImgs(o.groups.flatMap(g => g.items.map(i => i.img)));
  let dirty = false, active = null;
  const L = () => OFFER_PH[o.lang] || OFFER_PH.az;
  const custList = `<datalist id="custs">${cust.filter(c => c.is_buyer !== false).map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>`;
  const back = `<a class="back" href="#teklifler">${ico('back', 16)} Qiymət təklifləri</a>`;
  const ro = o.status === 'legv';
  function itemHTML(gi, ii, it, many) {
    const k = `${gi}-${ii}`;
    return `<div class="oitem" data-k="${k}">
      <div class="oimg">${it.img && imgCache.has(it.img) ? `<img src="${imgSrc(it.img)}" alt="">` : '<span>Şəkil yoxdur</span>'}
        <div class="row">${ro ? '' : `<label class="btn sm">Seç<input type="file" accept="image/*" data-file="${k}" data-az="1" hidden></label><button type="button" class="btn sm" data-paste="${k}" title="Kopyaladığınız şəkli yapışdırın (Ctrl+V)">Yapışdır</button>
          <a class="btn sm" target="_blank" rel="noopener" data-goog="${k}" href="#">Google</a>${it.img ? `<button type="button" class="btn sm" data-noimg="${k}">×</button>` : ''}`}</div></div>
      <div class="obody">
        ${many ? `<div class="note"><b>Variant ${String.fromCharCode(65 + ii)}</b></div>` : ''}
        ${ro ? '' : `<div class="sugw"><input class="inp" data-find="${k}" placeholder="Model, istehsalçı və ya ad yazın — kataloq və anbardan tapılır" autocomplete="off"><div class="sug" hidden></div></div>`}
        <textarea class="inp ta" data-f="name" data-k="${k}" rows="2" placeholder="Malın adı, məs.: Defibrillyator (Comen S5, Çin)" ${ro ? 'readonly' : ''}>${esc(it.name)}</textarea>
        <div class="orow">
          <label class="f">Miqdar<input class="inp" data-f="qty" data-k="${k}" inputmode="decimal" value="${esc(it.qty ?? '')}" ${ro ? 'readonly' : ''}></label>
          <label class="f">Vahid<input class="inp" data-f="unit" data-k="${k}" value="${esc(it.unit || '')}" placeholder="${L().unit}" ${ro ? 'readonly' : ''}></label>
          <label class="f">Qiymət, ${esc(o.currency)}<input class="inp" data-f="price" data-k="${k}" inputmode="decimal" value="${esc(it.price ?? '')}" ${ro ? 'readonly' : ''}></label>
          ${ro ? '' : `<button type="button" class="btn sm danger" data-delitem="${k}" title="Sətri sil">Sil</button>`}
        </div></div></div>`;
  }
  function groupsHTML() {
    return o.groups.map((g, gi) => `<section class="card ogroup" data-g="${gi}">
      <div class="row" style="justify-content:space-between"><h2>Sorğu ${gi + 1}</h2>${ro || o.groups.length < 2 ? '' : `<button type="button" class="btn sm danger" data-delgroup="${gi}">Sorğunu sil</button>`}</div>
      <label class="f">Başlıq (bir neçə sorğu və ya variant olanda PDF-də görünür)<input class="inp" data-gt="${gi}" value="${esc(g.title || '')}" placeholder="məs.: Defibrillyator" ${ro ? 'readonly' : ''}></label>
      ${g.items.map((it, ii) => itemHTML(gi, ii, it, g.items.length > 1)).join('')}
      ${ro ? '' : `<div><button type="button" class="btn sm" data-addv="${gi}">+ Variant əlavə et</button></div>`}</section>`).join('');
  }
  function render() {
    const st = OFFER_ST[o.status];
    mount('teklifler', back + `
      <div class="head"><div><h1>${o.no ? 'Qiymət təklifi ' + esc(o.no) : 'Yeni qiymət təklifi'}</h1><div class="sub">${o.id ? `<span class="tag ${st[1]}">${st[0]}</span>${o.approved_by ? ` · təsdiq: ${esc(o.approved_by.replace('@medigroup.az', ''))}` : ''} · hazırlayan: ${esc((o.created_by || '').replace('@medigroup.az', ''))}` : 'Nömrə yadda saxlayanda veriləcək'}</div></div>
        <div class="row">${o.id && o.status !== 'legv' ? `<a class="btn" href="#muqavile/yeni?offer=${o.id}">Müqavilə</a><a class="btn" href="#sened-yarat/hf/yeni?offer=${o.id}">Hesab-faktura</a>` : ''}${o.id ? `<a class="btn" href="#teklif/yeni?from=${o.id}">Kopyala</a>` : ''}${o.id && !ro ? '<button class="btn danger" id="cancel">Ləğv et</button>' : ''}</div></div>
      ${custList}
      <section class="card"><div class="fgrid">
        <label class="f" style="grid-column:span 2">Müştəri (Kimə)<input class="inp" id="o_cust" list="custs" value="${esc(o.customer_name || '')}" placeholder="Siyahıdan seçin və ya yazın" ${ro ? 'readonly' : ''}></label>
        <label class="f">Tarix<input class="inp" type="date" data-o="offer_date" value="${o.offer_date}" ${ro ? 'readonly' : ''}></label>
        <label class="f">Dil<select class="inp" data-o="lang" ${ro ? 'disabled' : ''}><option value="az">Azərbaycan — Qiymət təklifi</option><option value="en" ${o.lang === 'en' ? 'selected' : ''}>English — Proforma Invoice</option></select></label>
        <label class="f">Valyuta<select class="inp" data-o="currency" ${ro ? 'disabled' : ''}>${['AZN', 'USD', 'EUR'].map(c => `<option ${o.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="f">ƏDV<select class="inp" data-o="vat_included" ${ro ? 'disabled' : ''}><option value="1">Qiymətlərə ƏDV daxildir</option><option value="0" ${o.vat_included ? '' : 'selected'}>ƏDV daxil deyil</option></select></label>
      </div>
      <details ${o.warranty || o.delivery || o.place || o.payment || o.extra_terms || Number(o.valid_days) !== 30 ? 'open' : ''}><summary>Şərtlər (boş qalsa, standart yazılır)</summary><div class="fgrid" style="margin-top:10px">
        <label class="f">Çatdırılma müddəti<input class="inp" data-o="delivery" value="${esc(o.delivery || '')}" placeholder="${L().d_delivery} (anbardadırsa: 1 gündür)" ${ro ? 'readonly' : ''}></label>
        <label class="f">Ödəniş şərti<input class="inp" data-o="payment" value="${esc(o.payment || '')}" placeholder="${L().d_payment}" ${ro ? 'readonly' : ''}></label>
        <label class="f">Zəmanət<input class="inp" data-o="warranty" value="${esc(o.warranty || '')}" placeholder="${L().d_warranty}" ${ro ? 'readonly' : ''}></label>
        <label class="f">Çatdırılma yeri<input class="inp" data-o="place" value="${esc(o.place || '')}" placeholder="${L().d_place}" ${ro ? 'readonly' : ''}></label>
        <label class="f">Etibarlılıq, gün<input class="inp" data-o="valid_days" inputmode="numeric" value="${esc(o.valid_days)}" ${ro ? 'readonly' : ''}></label>
        <label class="f" style="grid-column:1/-1">Əlavə şərtlər (hər sətir ayrıca bənd)<textarea class="inp ta" data-o="extra_terms" rows="2" ${ro ? 'readonly' : ''}>${esc(o.extra_terms || '')}</textarea></label>
      </div></details></section>
      <div id="groups">${groupsHTML()}</div>
      ${ro ? '' : '<div><button type="button" class="btn" id="addg">+ Yeni sorğu (başqa məhsul)</button></div>'}
      <div class="obar">${ro ? '' : '<button class="btn" id="save">Yadda saxla</button>'}
        <button class="btn p" id="pdf">${ico('print', 18)} PDF yüklə</button></div>`, al);
    bind();
  }
  const itemOf = k => { const [g, i] = k.split('-').map(Number); return o.groups[g].items[i]; };
  const qOf = it => (it.name || '').replace(/\(.*?\)/g, ' ').trim() || (it._find || '');
  function sugg(text) {
    const t = norm(text).split(' ').filter(Boolean); if (!t.length) return [];
    const hit = s => { const n = norm(s); return t.every(w => n.includes(w)); };
    const a = cat.filter(c => hit(c.name) || (c.name_ru && hit(c.name_ru))).slice(0, 8).map(c => ({ name: o.lang === 'en' && c.name_ru ? c.name : c.name, img: c.img_id, src: 'kataloq' }));
    const b = prods.filter(p => hit(p.name) && !a.some(x => norm(x.name) === norm(p.name))).slice(0, 8 - Math.min(a.length, 6)).map(p => ({ name: p.name, unit: p.unit, img: cat.find(c => norm(c.name) === norm(p.name))?.img_id || null, src: 'anbar · qalıq ' + qtyf(p.qty) }));
    return [...a.slice(0, 6), ...b].slice(0, 10);
  }
  function bind() {
    const mark = () => { dirty = true; };
    $app.querySelectorAll('[data-o]').forEach(el => el.onchange = () => {
      const k = el.dataset.o; let v = el.value;
      if (k === 'vat_included') v = v === '1'; if (k === 'valid_days') v = parseInt(v) || 30;
      o[k] = v; mark(); if (k === 'currency' || k === 'lang') render();
    });
    const cu = document.getElementById('o_cust');
    if (cu) cu.onchange = () => { const c = cust.find(x => norm(x.name) === norm(cu.value)); o.customer_name = cu.value.trim(); o.customer_id = c ? c.id : null; mark(); };
    $app.querySelectorAll('[data-gt]').forEach(el => el.oninput = () => { o.groups[+el.dataset.gt].title = el.value; mark(); });
    $app.querySelectorAll('[data-f]').forEach(el => {
      el.oninput = () => { const it = itemOf(el.dataset.k); const f = el.dataset.f; it[f] = f === 'qty' || f === 'price' ? el.value.replace(',', '.').replace(/[^\d.]/g, '') : el.value; mark(); };
      el.onfocus = () => { active = el.dataset.k; };
    });
    $app.querySelectorAll('[data-find]').forEach(el => {
      const box = el.nextElementSibling; let list = [];
      el.onfocus = () => { active = el.dataset.find; };
      el.oninput = () => {
        list = sugg(el.value); itemOf(el.dataset.find)._find = el.value;
        box.innerHTML = list.map((s, i) => `<button type="button" data-i="${i}">${s.img ? '<i class="has"></i>' : '<i></i>'}<span>${esc(s.name)}</span><small>${esc(s.src)}</small></button>`).join('') + (el.value.trim() ? `<button type="button" data-i="-1"><i></i><span>«${esc(el.value.trim())}» — ad kimi yaz</span><small>yeni</small></button>` : '');
        box.hidden = !box.innerHTML;
      };
      el.onblur = () => setTimeout(() => box.hidden = true, 200);
      box.onmousedown = e => e.preventDefault();
      box.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return; const it = itemOf(el.dataset.find);
        if (b.dataset.i === '-1') it.name = el.value.trim();
        else { const s = list[+b.dataset.i]; it.name = s.name; if (s.unit && !it.unit) it.unit = s.unit; if (s.img) { await offerImgs([s.img]); it.img = s.img; } }
        mark(); render();
      };
    });
    const gk = k => { const [g, i] = k.split('-').map(Number); return [g, i]; };
    $app.querySelectorAll('[data-delitem]').forEach(b => b.onclick = () => { const [g, i] = gk(b.dataset.delitem); o.groups[g].items.splice(i, 1); if (!o.groups[g].items.length) { if (o.groups.length > 1) o.groups.splice(g, 1); else o.groups[g].items.push({ name: '', qty: 1, unit: '', price: '', img: null }); } mark(); render(); });
    $app.querySelectorAll('[data-delgroup]').forEach(b => b.onclick = () => { if (!confirm('Bu sorğu bütün variantları ilə silinsin?')) return; o.groups.splice(+b.dataset.delgroup, 1); mark(); render(); });
    $app.querySelectorAll('[data-addv]').forEach(b => b.onclick = () => { const g = o.groups[+b.dataset.addv]; const last = g.items[g.items.length - 1]; g.items.push({ name: '', qty: last?.qty || 1, unit: last?.unit || '', price: '', img: null }); mark(); render(); });
    const ag = document.getElementById('addg'); if (ag) ag.onclick = () => { o.groups.push({ title: '', items: [{ name: '', qty: 1, unit: '', price: '', img: null }] }); mark(); render(); };
    $app.querySelectorAll('[data-noimg]').forEach(b => b.onclick = () => { itemOf(b.dataset.noimg).img = null; mark(); render(); });
    $app.querySelectorAll('[data-goog]').forEach(a => a.onclick = () => { const it = itemOf(a.dataset.goog); const q = qOf(it); if (!q) { toast('Əvvəl malın adını və ya modelini yazın', true); return false; } a.href = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q); active = a.dataset.goog; toast('Şəkli kopyalayın (sağ klik → Şəkli kopyala), sonra «Yapışdır» basın'); });
    const putImg = async (k, blob, src) => { try { toast('Şəkil yüklənir…'); const idn = await storeImage(blob, src); itemOf(k).img = idn; mark(); render(); toast('Şəkil əlavə edildi'); } catch (e) { fail(e); } };
    $app.querySelectorAll('[data-file]').forEach(inp => inp.onchange = () => { if (inp.files[0]) putImg(inp.dataset.file, inp.files[0], 'yükləmə'); });
    $app.querySelectorAll('[data-paste]').forEach(b => b.onclick = async () => {
      active = b.dataset.paste;
      try { const items = await navigator.clipboard.read(); for (const ci of items) { const t = ci.types.find(x => x.startsWith('image/')); if (t) return putImg(active, await ci.getType(t), 'internet (kopyalama)'); } toast('Buferdə şəkil yoxdur. Şəkli kopyalayın və yenidən basın', true); }
      catch { toast('Ctrl+V basın — şəkil bu sətrə əlavə olunacaq'); }
    });
    document.onpaste = e => { if (location.hash.indexOf('#teklif/') !== 0 || !active) return; const f = [...(e.clipboardData?.items || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); putImg(active, f.getAsFile(), 'internet (kopyalama)'); } };
    $app.querySelectorAll('.oitem').forEach(d => d.onclick = () => { active = d.dataset.k; });
    const sv = document.getElementById('save'); if (sv) sv.onclick = () => save().then(ok => ok && toast(`${o.no} yadda saxlandı`)).catch(fail);
    document.getElementById('pdf').onclick = async e => { const b = e.currentTarget; b.disabled = true; try { if (!ro && (dirty || !o.id)) { if (!await save()) return; } await offerPDF(o); } catch (x) { fail(x); } finally { b.disabled = false; } };
    const ap = document.getElementById('appr'); if (ap) ap.onclick = async () => { if (dirty && !await save()) return; const { error } = await sb.from('offers').update({ status: 'tesdiq' }).eq('id', o.id); if (error) return fail(error); toast('Təsdiqləndi — PDF imza və möhürlə çıxacaq'); route(); };
    const ua = document.getElementById('unappr'); if (ua) ua.onclick = async () => { const { error } = await sb.from('offers').update({ status: 'qaralama' }).eq('id', o.id); if (error) return fail(error); route(); };
    const cn = document.getElementById('cancel'); if (cn) cn.onclick = async () => { if (!confirm(`${o.no} ləğv edilsin? (Silinmir, «Ləğv edilən» siyahısında qalır)`)) return; const { error } = await sb.from('offers').update({ status: 'legv' }).eq('id', o.id); if (error) return fail(error); toast('Ləğv edildi'); route(); };
  }
  async function save() {
    const groups = o.groups.map(g => ({ title: (g.title || '').trim(), items: g.items.filter(i => (i.name || '').trim()).map(i => ({ name: i.name.trim(), qty: i.qty === '' ? null : Number(i.qty), unit: (i.unit || '').trim(), price: i.price === '' || i.price == null ? null : p4(i.price), img: i.img || null })) })).filter(g => g.items.length);
    if (!groups.length) { toast('Ən azı bir məhsulun adını yazın', true); return false; }
    if (!(o.customer_name || '').trim() && !confirm('Müştəri yazılmayıb. Davam edilsin?')) return false;
    const noPrice = groups.flatMap(g => g.items).filter(i => i.price == null).length;
    if (noPrice && !confirm(`${noPrice} məhsulun qiyməti yazılmayıb (PDF-də boş qalacaq). Davam edilsin?`)) return false;
    const row = { offer_date: o.offer_date, customer_id: o.customer_id, customer_name: (o.customer_name || '').trim() || null, lang: o.lang, currency: o.currency, vat_included: o.vat_included,
      warranty: o.warranty || null, delivery: o.delivery || null, place: o.place || null, payment: o.payment || null, valid_days: Number(o.valid_days) || 30, extra_terms: o.extra_terms || null, groups };
    const q = o.id ? sb.from('offers').update(row).eq('id', o.id).select().single() : sb.from('offers').insert(row).select().single();
    const { data, error } = await q; if (error) { fail(error); return false; }
    const wasNew = !o.id; Object.assign(o, data); o.groups = JSON.parse(JSON.stringify(data.groups)); dirty = false;
    if (wasNew) { history.replaceState(null, '', '#teklif/' + o.id); }
    render(); return true;
  }
  render();
}

let offerLibs = null;
const loadOfferLibs = () => offerLibs ||= (async () => {
  const js = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('PDF modulu yüklənmədi, internetinizi yoxlayın')); document.head.append(s); });
  const b64 = async url => { const r = await fetch(url); if (!r.ok) throw new Error('Fayl yüklənmədi: ' + url); const u = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  if (!window.jspdf) await js('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  if (typeof buildOfferPDF === 'undefined') await js('offerpdf.js?v=4');
  const F = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans@0.2.3/';
  const [fontR, fontB, logo] = await Promise.all([b64(F + 'NotoSans_400Regular.ttf'), b64(F + 'NotoSans_700Bold.ttf'), b64('teklif-logo.png')]);
  return { fontR, fontB, logo: { data: 'data:image/png;base64,' + logo, w: 480, h: 280 } };
})().catch(e => { offerLibs = null; throw e; });
async function offerPDF(o) {
  toast('PDF hazırlanır…');
  const libs = await loadOfferLibs();
  const ids = o.groups.flatMap(g => g.items.map(i => i.img)).filter(Boolean); await offerImgs(ids);
  const img = {}; ids.forEach(id => { const r = imgCache.get(id); if (r) img[id] = { data: `data:${r.mime};base64,${r.data}`, w: r.w, h: r.h, fmt: r.mime === 'image/png' ? 'PNG' : 'JPEG' }; });
  let seal = null;
  if (o.status !== 'legv') { const { data, error } = await sb.rpc('offer_seal', { p_offer: o.id || null }); if (error) throw error; if (data) seal = { data: `data:${data.mime};base64,${data.data}`, w: data.w, h: data.h }; }
  const extra = (o.extra_terms || '').split('\n').map(s => s.trim()).filter(Boolean);
  const doc = buildOfferPDF(window.jspdf.jsPDF, { ...o, number: o.no, date: o.offer_date, customer: o.customer_name, extra_terms: extra }, { ...libs, img, seal });
  const safe = (o.customer_name || 'müştəri').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  doc.save(`Medigroup teklif - ${safe} (${o.no}).pdf`);
  if (o.status !== 'legv' && !seal) toast('PDF yükləndi. İmza və möhür şəkli hələ qoyulmayıb (Hesab bölməsi)', true); else toast('PDF yükləndi');
}
// rəhbər: imza və möhür şəkli (Hesab səhifəsində)
async function sealCard() {
  if (!isAdmin()) return '';
  const { data } = await sb.rpc('offer_seal', { p_offer: null });
  return `<section class="card"><h2>Təklif üçün imza və möhür</h2>
    <div class="note">İmzanızla möhürün birlikdə olduğu şəkil (şəffaf fonlu PNG ən yaxşısıdır; ağ kağızda skan da olar). Bütün istifadəçilərin hazırladığı təkliflərin PDF-inə avtomatik qoyulur (ləğv edilənlərdən başqa).</div>
    ${data ? `<div><img src="data:${data.mime};base64,${data.data}" alt="İmza və möhür" style="max-height:110px;max-width:100%;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:8px"></div>` : '<div class="warnbox">Hələ qoyulmayıb</div>'}
    <div class="row"><label class="btn p">${data ? 'Dəyiş' : 'Şəkil seç'}<input type="file" id="sealf" accept="image/png,image/jpeg" data-az="1" hidden></label>${data ? '<button type="button" class="btn danger" id="sealdel">Sil</button>' : ''}</div></section>`;
}
function bindSeal() {
  const f = document.getElementById('sealf'); if (!f) return;
  f.onchange = async () => {
    try {
      const bm = await createImageBitmap(f.files[0]); const s = Math.min(1, 700 / Math.max(bm.width, bm.height)); const w = Math.round(bm.width * s), h = Math.round(bm.height * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(bm, 0, 0, w, h);
      // ağ fonu şəffaf et (skan olunmuş kağız üçün)
      const id = x.getImageData(0, 0, w, h), p = id.data; for (let i = 0; i < p.length; i += 4) { const m = Math.min(p[i], p[i + 1], p[i + 2]); if (m > 235) p[i + 3] = 0; else if (m > 200) p[i + 3] = Math.round(p[i + 3] * (235 - m) / 35); } x.putImageData(id, 0, 0);
      const { error } = await sb.rpc('set_seal', { p_data: c.toDataURL('image/png').split(',')[1], p_w: w, p_h: h }); if (error) throw error;
      toast('İmza və möhür saxlanıldı'); route();
    } catch (e) { fail(e); }
  };
  const d = document.getElementById('sealdel'); if (d) d.onclick = async () => { if (!confirm('İmza və möhür şəkli silinsin?')) return; const { error } = await sb.rpc('set_seal', { p_data: null, p_w: null, p_h: null }); if (error) return fail(error); route(); };
}

/* ---------- Müqavilələr, QRP, hesab-faktura, təhvil-təslim aktı (Word + PDF; anbar və borclara təsir etmir) ---------- */
const GD_T = { qrp: ['QRP', 'Qiymətlərin razılaşdırılması protokolu'], hf: ['Hesab-faktura', 'Hesab-faktura'], akt: ['Akt', 'Təhvil-təslim aktı'] };
const KIND_AZ = { mal: 'Mal', xidmet: 'Xidmət', qarisiq: 'Mal və xidmət' };
const TERM_AZ = { uzun: 'Uzunmüddətli (1 il, avtomatik uzanır)', birdefelik: 'Birdəfəlik (mal cədvəli ilə)' };
const unitDoc = u => (!u || u === 'əd' || u === 'əd.') ? 'ədəd' : u;
let docLibs = null;
const loadDocLibs = () => docLibs ||= (async () => {
  const js = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Sənəd modulu yüklənmədi, internetinizi yoxlayın')); document.head.append(s); });
  if (!window.PizZip) await js('https://cdn.jsdelivr.net/npm/pizzip@3.1.7/dist/pizzip.min.js');
  if (!window.docxtemplater) await js('https://cdn.jsdelivr.net/npm/docxtemplater@3.47.4/build/docxtemplater.js');
  if (typeof contractTexts === 'undefined') await js('docdata.js?v=2');
  if (typeof DOCX_DOCS === 'undefined') await js('sablonlar.js?v=2');
})().catch(e => { docLibs = null; throw e; });
let pdfLibs = null;
const loadPdfLibs = () => pdfLibs ||= (async () => {
  const js = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('PDF modulu yüklənmədi, internetinizi yoxlayın')); document.head.append(s); });
  if (!window.JSZip) await js('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  if (!window.docx) await js('https://cdn.jsdelivr.net/npm/docx-preview@0.3.5/dist/docx-preview.min.js');
  if (!window.html2canvas) await js('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (!window.jspdf) await js('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  if (typeof docxToPdf === 'undefined') await js('docxpdf.js?v=1');
})().catch(e => { pdfLibs = null; throw e; });
async function fillDocx(tpl, data) {
  await loadDocLibs();
  const [st, xml] = DOCX_DOCS[tpl.replace(/\.docx$/, '')];
  const z = new PizZip();
  for (const [p, t] of Object.entries(DOCX_COMMON)) z.file(p, t);
  z.file('word/styles.xml', DOCX_STYLES[st]); z.file('word/document.xml', xml);
  const d = new window.docxtemplater(z, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
  d.render(data);
  return d.getZip().generate({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
async function outputDoc(tpl, data, name, fmt) {
  toast(fmt === 'pdf' ? 'PDF hazırlanır…' : 'Word faylı hazırlanır…');
  const blob = await fillDocx(tpl, data);
  const safe = name.replace(/[\\/:*?"<>|“”«»]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (fmt === 'pdf') { await loadPdfLibs(); const pdf = await docxToPdf(await blob.arrayBuffer(), window.jspdf.jsPDF); pdf.save(safe + '.pdf'); }
  else saveBlob(blob, safe + '.docx');
  toast('Fayl yükləndi');
}
async function custRec(id) { const { data, error } = await sb.from('customers').select('*').eq('id', id).single(); if (error) throw error; return data; }
const reqMissing = c => ['voen', 'bank', 'iban', 'signer_short'].filter(k => !(c[k] || '').trim()).map(k => ({ voen: 'VÖEN', bank: 'bank', iban: 'H/H', signer_short: 'imza edən şəxs' })[k]);

// ---- mənbədən sətirlər: sifariş, 1C/tətbiq satış qaiməsi, qiymət təklifi, müqavilə ----
async function linesFromSource(params) {
  const pm = new Map((await loadProducts()).map(x => [x.id, x]));
  const svc = p => (p?.kind || '') === 'xidmət';
  if (params.get('order')) {
    const id = +params.get('order');
    const [{ data: o, error }, { data: it }] = await Promise.all([sb.from('v_orders').select('*').eq('id', id).single(), sb.from('order_items').select('*').eq('order_id', id).order('id')]);
    if (error) throw error;
    return { customer_id: o.customer_id, vat: Number(o.vat_rate) > 0, src: 'order:' + id, src_label: `Sifariş ${o.no}${o.invoice_code ? ' · qaimə ' + o.invoice_code : ''}`, date: o.delivered_at || o.order_date,
      lines: (it || []).map(i => { const p = pm.get(i.product_id); return { name: p?.name || '', unit: unitDoc(p?.unit), qty: Number(i.qty), price: Number(i.price), service: svc(p) }; }) };
  }
  if (params.get('d')) {
    const d = params.get('d'), y = params.get('y'), pid = +params.get('p');
    const ls = (await docLines('SQ', d, y, pid)).filter(l => Number(l.qty) > 0 || Number(l.amount) > 0);
    return { customer_id: pid, vat: true, src: `SQ:${d}:${y}:${pid}`, src_label: 'Satış qaiməsi ' + d, date: ls[0]?.sale_date,
      lines: ls.map(l => { const p = pm.get(l.product_id), q = Number(l.qty) || 1, a = Number(l.amount); return { name: p?.name || '', unit: unitDoc(p?.unit), qty: q, price: Math.round(a / 1.18 / q * 10000) / 10000, gross: a, service: svc(p) }; }) };
  }
  if (params.get('offer')) {
    const { data: o, error } = await sb.from('offers').select('*').eq('id', +params.get('offer')).single(); if (error) throw error;
    const k = o.vat_included ? 1.18 : 1;
    return { customer_id: o.customer_id, vat: true, src: 'offer:' + o.id, src_label: 'Qiymət təklifi ' + o.no,
      lines: (o.groups || []).flatMap(g => g.items).map(i => ({ name: i.name, unit: unitDoc(i.unit), qty: Number(i.qty || 1), price: i.price == null ? 0 : Math.round(Number(i.price) / k * 10000) / 10000, service: false })) };
  }
  if (params.get('ct')) {
    const { data: c, error } = await sb.from('contracts').select('*').eq('id', +params.get('ct')).single(); if (error) throw error;
    return { customer_id: c.customer_id, vat: c.vat, src: 'contract:' + c.id, src_label: 'Müqavilə ' + c.no, contract_id: c.id, kind: c.kind, lines: c.lines || [] };
  }
  return { customer_id: params.get('c') ? +params.get('c') : null, vat: true, lines: [] };
}

// ---- sətir redaktoru (proqramdan seçmək və ya əl ilə yazmaq) ----
function docLinesHTML(lines, ro) {
  return `<div class="scroll"><table class="t dl"><thead><tr><th>№</th><th>Adı</th><th>Vahid</th><th class="n">Miqdar</th><th class="n">Qiymət (ƏDV-siz)</th><th class="n">Məbləğ</th><th title="Xidmətdir">Xidmət</th>${ro ? '' : '<th></th>'}</tr></thead><tbody>
    ${lines.map((l, i) => `<tr data-i="${i}"><td>${i + 1}</td>
      <td class="sugw" style="min-width:260px">${ro ? esc(l.name) : `<input class="inp" data-l="name" value="${esc(l.name)}" placeholder="Ad yazın — anbardan və kataloqdan tapılır" autocomplete="off"><div class="sug" hidden></div>`}</td>
      <td>${ro ? esc(l.unit) : `<input class="inp" data-l="unit" value="${esc(l.unit || 'ədəd')}" style="width:80px">`}</td>
      <td class="n">${ro ? qtyf(l.qty) : `<input class="inp" data-l="qty" inputmode="decimal" value="${esc(l.qty ?? '')}" style="width:80px;text-align:right">`}</td>
      <td class="n">${ro ? num4(l.price) : `<input class="inp" data-l="price" inputmode="decimal" value="${esc(l.price ?? '')}" style="width:110px;text-align:right">`}</td>
      <td class="n" data-amt>${num2(Math.round((Number(l.qty) || 0) * (Number(l.price) || 0) * 100) / 100)}</td>
      <td style="text-align:center"><input type="checkbox" data-l="service" ${l.service ? 'checked' : ''} ${ro ? 'disabled' : ''}></td>
      ${ro ? '' : `<td><button type="button" class="btn sm danger" data-ldel="${i}">Sil</button></td>`}</tr>`).join('') || `<tr><td colspan="8" class="empty">Sətir yoxdur</td></tr>`}
    </tbody></table></div>${ro ? '' : '<div><button type="button" class="btn sm" id="ladd">+ Sətir əlavə et</button></div>'}`;
}
function bindDocLines(root, lines, onChange, rerender) {
  const prods = state.products || [];
  root.querySelectorAll('tr[data-i]').forEach(tr => {
    const l = lines[+tr.dataset.i];
    tr.querySelectorAll('[data-l]').forEach(el => {
      const f = el.dataset.l;
      el.oninput = el.onchange = () => {
        if (f === 'service') l.service = el.checked;
        else if (f === 'qty' || f === 'price') { l[f] = el.value.replace(',', '.').replace(/[^\d.]/g, ''); delete l.gross; }
        else l[f] = el.value;
        tr.querySelector('[data-amt]').textContent = num2(Math.round((Number(l.qty) || 0) * (Number(l.price) || 0) * 100) / 100);
        onChange();
        if (f === 'name') {
          const box = el.nextElementSibling, t = norm(el.value).split(' ').filter(Boolean);
          const hit = s => { const n = norm(s); return t.length && t.every(w => n.includes(w)); };
          const a = prods.filter(p => hit(p.name)).slice(0, 8).map(p => ({ name: p.name, unit: unitDoc(p.unit), service: (p.kind || '') === 'xidmət', src: 'anbar · ' + qtyf(p.qty) }));
          const b = (offerCat || []).filter(c => hit(c.name) && !a.some(x => norm(x.name) === norm(c.name))).slice(0, 10 - a.length).map(c => ({ name: c.name, unit: 'ədəd', service: false, src: 'kataloq' }));
          const list = [...a, ...b];
          box.innerHTML = list.map((s, i) => `<button type="button" data-i="${i}"><span>${esc(s.name)}</span><small>${esc(s.src)}</small></button>`).join('');
          box.hidden = !list.length;
          box.onmousedown = e => e.preventDefault();
          box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const s = list[+b.dataset.i]; l.name = s.name; l.unit = s.unit; l.service = s.service; onChange(); rerender(); };
          el.onblur = () => setTimeout(() => { box.hidden = true; }, 200);
        }
      };
    });
  });
  root.querySelectorAll('[data-ldel]').forEach(b => b.onclick = () => { lines.splice(+b.dataset.ldel, 1); onChange(); rerender(); });
  const add = root.querySelector('#ladd'); if (add) add.onclick = () => { lines.push({ name: '', unit: 'ədəd', qty: 1, price: '', service: false }); onChange(); rerender(); };
}
const cleanLines = ls => ls.filter(l => (l.name || '').trim()).map(l => { const o = { name: l.name.trim(), unit: (l.unit || 'ədəd').trim(), qty: Number(l.qty) || 0, price: Number(l.price) || 0, service: !!l.service }; if (l.gross != null) o.gross = Number(l.gross); return o; });
const linesTotal = (ls, vat) => { const s = Math.round(ls.reduce((t, l) => t + Math.round((Number(l.qty) || 0) * (Number(l.price) || 0) * 100) / 100, 0) * 100) / 100; return vat ? Math.round((s + Math.round(s * 18) / 100) * 100) / 100 : s; };
const kindGuess = ls => { const s = ls.filter(l => l.service).length; return !ls.length || !s ? 'mal' : s === ls.length ? 'xidmet' : 'qarisiq'; };

// ---- siyahı: müqavilələr və sənədlər ----
async function viewContracts(params) {
  const f = params.get('f') || 'muqavile'; const q = (params.get('q') || '').trim();
  const [al, cust] = await Promise.all([alerts(), loadCustomers()]);
  const cm = new Map(cust.map(c => [c.id, c.name]));
  let rows;
  if (f === 'muqavile') { const { data, error } = await sb.from('contracts').select('*').order('contract_date', { ascending: false }).order('id', { ascending: false }).limit(500); if (error) throw error; rows = data; }
  else { const { data, error } = await sb.from('gen_docs').select('*').eq('typ', f).order('doc_date', { ascending: false }).order('id', { ascending: false }).limit(500); if (error) throw error; rows = data; }
  const nq = norm(q); if (nq) rows = rows.filter(r => norm(`${r.no || ''} ${cm.get(r.customer_id) || ''} ${r.src_label || ''}`).includes(nq));
  const hq = o => '#muqavileler?' + new URLSearchParams(Object.fromEntries(Object.entries({ f, q, ...o }).filter(([, v]) => v)));
  const row = r => f === 'muqavile'
    ? `<a class="li" href="#muqavile/${r.id}"><span class="m"><span class="d"><b>${esc(r.no)}</b> · ${dtfmt(r.contract_date, r.imported ? null : r.created_at)} · ${KIND_AZ[r.kind]} · ${r.term === 'uzun' ? 'uzunmüddətli' : 'birdəfəlik'}${r.imported ? ' · köhnə (kağız)' : ''}</span><span class="t">${esc(cm.get(r.customer_id) || '—')}</span></span>
       <span class="r">${r.status === 'legv' ? '<span class="tag t-grey">Ləğv</span>' : r.term === 'uzun' ? `<span class="tag t-ok">qüvvədə</span>` : `<span class="amt">${money(linesTotal(r.lines || [], r.vat))}</span>`}</span></a>`
    : `<a class="li" href="#sened-yarat/${f}/${r.id}"><span class="m"><span class="d">${r.no ? `<b>№ ${esc(r.no)}</b> · ` : ''}${dtfmt(r.doc_date, r.created_at)}${r.src_label ? ' · ' + esc(r.src_label) : ''}</span><span class="t">${esc(cm.get(r.customer_id) || '—')}</span></span>
       <span class="r">${r.status === 'legv' ? '<span class="tag t-grey">Ləğv</span>' : `<span class="amt">${money(r.total)}</span>`}</span></a>`;
  mount('muqavileler', `
    <div class="head"><div><h1>Müqavilələr və sənədlər</h1><div class="sub">Word və PDF · anbar və borclara təsir etmir</div></div>
      <div class="row"><a class="btn p" href="#muqavile/yeni">+ Müqavilə</a><a class="btn" href="#muqavile/yeni?imp=1">+ Köhnə müqaviləni qeyd et</a></div></div>
    <div class="fgrid" style="align-items:end"><label class="f" style="grid-column:span 2">Müştəri və ya nömrə<input class="inp" id="q" type="search" value="${esc(q)}"></label><div class="row"><button class="btn p" id="go">Göstər</button></div></div>
    <div class="chips">${[['muqavile', 'Müqavilələr'], ['qrp', 'QRP'], ['hf', 'Hesab-fakturalar'], ['akt', 'Təhvil-təslim aktları']].map(([k, l]) => `<a class="chip ${k === f ? 'on' : ''}" href="${hq({ f: k, q: '' })}">${l}</a>`).join('')}</div>
    ${f === 'muqavile' ? '' : `<div class="note">QRP, hesab-faktura və akt sifarişin və ya satış qaiməsinin səhifəsindəki düymələrlə yaranır (məlumat oradan gəlir). Mənbəsiz sənəd üçün: <a href="#sened-yarat/${f}/yeni">+ ${GD_T[f][1]} (əl ilə)</a></div>`}
    <section class="card tight"><div class="list">${rows.map(row).join('') || '<div class="empty">Qeyd yoxdur</div>'}</div></section>`, al);
  const go = () => location.hash = hq({ q: document.getElementById('q').value.trim() });
  document.getElementById('go').onclick = go; document.getElementById('q').onkeydown = e => { if (e.key === 'Enter') go(); };
}

// ---- müqavilə redaktoru ----
async function viewContract(id, params) {
  const [al, cust] = await Promise.all([alerts(), loadCustomers(), loadProducts(), loadOfferCatalog()]);
  const imp = params.get('imp') === '1';
  let c;
  if (id === 'yeni') {
    const s = await linesFromSource(params);
    c = { id: null, no: '', contract_date: today(), customer_id: s.customer_id, term: s.lines.length ? 'birdefelik' : 'uzun', kind: kindGuess(s.lines), vat: s.vat, delivery: '', payment_text: '', lines: s.lines, src: s.src || null, status: 'aktiv', imported: imp };
  } else { const { data, error } = await sb.from('contracts').select('*').eq('id', +id).single(); if (error) throw error; c = data; c.lines = c.lines || []; }
  const { data: nums } = await sb.rpc('doc_next_numbers');
  let cu = c.customer_id ? await custRec(c.customer_id) : null;
  const ro = c.status === 'legv';
  const back = `<a class="back" href="#muqavileler">${ico('back', 16)} Müqavilələr</a>`;
  function render() {
    const miss = cu ? reqMissing(cu) : [];
    mount('muqavileler', back + `
      <div class="head"><div><h1>${c.id ? 'Müqavilə ' + esc(c.no) : c.imported ? 'Köhnə müqaviləni qeyd et' : 'Yeni müqavilə'}</h1>
        <div class="sub">${c.imported ? 'Kağızda bağlanmış müqavilə — yalnız nömrə və tarix qeyd olunur ki, QRP və aktlara yazılsın' : c.id ? (c.status === 'legv' ? '<span class="tag t-grey">Ləğv edilib</span>' : '') : `Nömrə yadda saxlayanda veriləcək (növbəti: ${esc(nums?.muqavile || '')})`}</div></div>
        <div class="row">${c.id && !ro ? '<button class="btn danger" id="cancel">Ləğv et</button>' : ''}</div></div>
      <datalist id="custs">${cust.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
      <section class="card"><div class="fgrid">
        <label class="f" style="grid-column:span 2">Müştəri (ALICI)<input class="inp" id="cu" list="custs" value="${esc(cu?.name || '')}" ${c.id ? 'readonly' : ''} placeholder="Siyahıdan seçin"></label>
        ${c.imported ? `<label class="f">Müqavilə №<input class="inp" id="cno" value="${esc(c.no || '')}" placeholder="məs. MG-25/210"></label>` : ''}
        <label class="f">Tarix<input class="inp" type="date" id="cdate" value="${c.contract_date}" ${ro ? 'readonly' : ''}></label>
        <label class="f">Növ<select class="inp" id="ckind" ${ro ? 'disabled' : ''}>${Object.entries(KIND_AZ).map(([k, l]) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">Müddət<select class="inp" id="cterm" ${ro ? 'disabled' : ''}>${Object.entries(TERM_AZ).map(([k, l]) => `<option value="${k}" ${c.term === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${c.term === 'birdefelik' && !c.imported ? `<label class="f">ƏDV<select class="inp" id="cvat" ${ro ? 'disabled' : ''}><option value="1">18% üstünə gəlir</option><option value="0" ${c.vat ? '' : 'selected'}>ƏDV-siz</option></select></label>
        <label class="f">Çatdırılma müddəti<input class="inp" id="cdel" value="${esc(c.delivery || '')}" placeholder="məs. 15 (on beş) iş günü" ${ro ? 'readonly' : ''}></label>` : ''}
        ${c.imported ? '' : `<label class="f" style="grid-column:1/-1">Ödəniş qaydası (boş qalsa standart: təhvildən öncə tam ödəniş)<input class="inp" id="cpay" value="${esc(c.payment_text || '')}" ${ro ? 'readonly' : ''}></label>`}
      </div>
      ${cu && miss.length && !c.imported ? `<div class="warnbox">Müştəri kartında doldurulmayıb: ${miss.join(', ')}. Müqavilədə boş qalacaq. <a href="#musteri/${cu.id}">Müştəri kartını aç →</a></div>` : ''}
      ${c.src ? `<div class="note">Mənbə: ${esc(c.src)}</div>` : ''}</section>
      ${c.term === 'birdefelik' && !c.imported ? `<section class="card"><h2>Mallar / xidmətlər</h2><div id="lines">${docLinesHTML(c.lines, ro)}</div><div class="note" id="ltot"></div></section>` : ''}
      <div class="obar">${ro ? '' : '<button class="btn p" id="save">Yadda saxla</button>'}
        ${c.id && !c.imported ? `<button class="btn" id="word">Word</button><button class="btn" id="pdf">PDF</button>` : ''}
        ${c.id && c.status === 'aktiv' ? `<a class="btn" href="#sened-yarat/qrp/yeni?c=${c.customer_id}${c.term === 'birdefelik' ? '&ct=' + c.id : ''}">QRP</a><a class="btn" href="#sened-yarat/hf/yeni?c=${c.customer_id}${c.term === 'birdefelik' ? '&ct=' + c.id : ''}">Hesab-faktura</a><a class="btn" href="#sened-yarat/akt/yeni?c=${c.customer_id}${c.term === 'birdefelik' ? '&ct=' + c.id : ''}">Akt</a>` : ''}</div>`, al);
    bind();
  }
  const tot = () => { const e = document.getElementById('ltot'); if (e) e.textContent = `Yekun: ${money(linesTotal(c.lines, c.vat))}${c.vat ? ' (ƏDV daxil)' : ''}`; };
  function bind() {
    const cuEl = document.getElementById('cu');
    cuEl.onchange = async () => { const x = cust.find(z => norm(z.name) === norm(cuEl.value)); if (!x) return toast('Müştəri siyahıda tapılmadı', true); c.customer_id = x.id; cu = await custRec(x.id); render(); };
    const v = id => document.getElementById(id);
    if (v('cdate')) v('cdate').onchange = e => c.contract_date = e.target.value;
    if (v('ckind')) v('ckind').onchange = e => c.kind = e.target.value;
    if (v('cterm')) v('cterm').onchange = e => { c.term = e.target.value; render(); };
    if (v('cvat')) v('cvat').onchange = e => { c.vat = e.target.value === '1'; tot(); };
    if (v('cdel')) v('cdel').oninput = e => c.delivery = e.target.value;
    if (v('cpay')) v('cpay').oninput = e => c.payment_text = e.target.value;
    if (v('cno')) v('cno').oninput = e => c.no = e.target.value.trim();
    const box = document.getElementById('lines');
    if (box) { const rr = () => { box.innerHTML = docLinesHTML(c.lines, ro); bindDocLines(box, c.lines, () => { tot(); c.kind = c.kind; }, rr); tot(); }; bindDocLines(box, c.lines, tot, rr); tot(); }
    if (v('save')) v('save').onclick = () => save().catch(fail);
    if (v('word')) v('word').onclick = () => out('docx').catch(fail);
    if (v('pdf')) v('pdf').onclick = () => out('pdf').catch(fail);
    if (v('cancel')) v('cancel').onclick = async () => { if (!confirm(`Müqavilə ${c.no} ləğv edilsin? (Silinmir, siyahıda «Ləğv» kimi qalır)`)) return; const { error } = await sb.from('contracts').update({ status: 'legv' }).eq('id', c.id); if (error) return fail(error); toast('Ləğv edildi'); route(); };
  }
  async function save() {
    if (!c.customer_id) return toast('Müştərini seçin', true);
    if (c.imported && !c.no) return toast('Müqavilənin nömrəsini yazın', true);
    const lines = c.term === 'birdefelik' && !c.imported ? cleanLines(c.lines) : [];
    if (c.term === 'birdefelik' && !c.imported && !lines.length) return toast('Ən azı bir sətir yazın', true);
    const row = { contract_date: c.contract_date, customer_id: c.customer_id, term: c.term, kind: c.kind, vat: c.vat, delivery: c.delivery || null, payment_text: c.payment_text || null, lines, src: c.src, imported: !!c.imported };
    if (c.imported) row.no = c.no;
    const q = c.id ? sb.from('contracts').update(row).eq('id', c.id).select().single() : sb.from('contracts').insert(row).select().single();
    const { data, error } = await q; if (error) return fail(error);
    const wasNew = !c.id; Object.assign(c, data);
    toast(`Müqavilə ${c.no} yadda saxlandı`);
    if (wasNew) history.replaceState(null, '', '#muqavile/' + c.id);
    render(); return true;
  }
  async function out(fmt) {
    if (!c.id) return;
    await loadDocLibs();
    const end = c.end_date || c.contract_date;
    const data = { no: c.no, ...dateParts(c.contract_date, 'd'), ...dateParts(end, 'e'), ...buyerFields(cu), payment_text: c.payment_text || KIND_TXT[c.kind].pay, ...kindFields(c.kind), ...contractTexts(c.kind, c.term === 'birdefelik', c.delivery),
      ...(c.term === 'birdefelik' ? docRows(c.lines, c.vat) : {}) };
    await outputDoc('muqavile.docx', data, `Müqavilə ${c.no} - ${cu?.name || ''}`, fmt);
  }
  render();
}

// ---- ayarlar (app_settings) və WhatsApp nömrəsi ----
async function getSetting(k) { const { data } = await sb.from('app_settings').select('v').eq('k', k).maybeSingle(); return data?.v || ''; }
async function setSetting(k, v) { const { error } = await sb.from('app_settings').upsert({ k, v, updated_at: new Date().toISOString() }); if (error) throw error; }
const waNorm = s => { let d = String(s || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.length === 10 && d[0] === '0') d = '994' + d.slice(1); if (d.length === 9) d = '994' + d; return d.length >= 11 && d.length <= 15 ? d : ''; };
// ---- QRP / hesab-faktura / akt redaktoru ----
async function viewGenDoc(typ, id, params) {
  if (!GD_T[typ]) { location.hash = '#muqavileler'; return; }
  const [al, cust] = await Promise.all([alerts(), loadCustomers(), loadProducts(), loadOfferCatalog()]);
  let g;
  if (id === 'yeni') {
    const s = await linesFromSource(params);
    g = { id: null, typ, no: '', doc_date: s.date && typ !== 'qrp' ? String(s.date).slice(0, 10) : today(), customer_id: s.customer_id, contract_id: s.contract_id || null, kind: s.kind || kindGuess(s.lines), vat: s.vat, lines: s.lines, src: s.src || null, src_label: s.src_label || null, status: 'aktiv' };
    if (g.src) { const { data: ex } = await sb.from('gen_docs').select('id,no,doc_date').eq('typ', typ).eq('src', g.src).eq('status', 'aktiv').limit(1); if (ex && ex.length && confirm(`Bu mənbə üçün ${GD_T[typ][1]} artıq hazırlanıb (${dfmt(ex[0].doc_date)}). Onu açaq?`)) { location.replace(`#sened-yarat/${typ}/${ex[0].id}`); return; } }
  } else { const { data, error } = await sb.from('gen_docs').select('*').eq('id', +id).single(); if (error) throw error; g = data; g.lines = g.lines || []; }
  const { data: nums } = await sb.rpc('doc_next_numbers');
  let cu = g.customer_id ? await custRec(g.customer_id) : null;
  let cts = [];
  const loadCts = async () => { cts = []; if (!g.customer_id) return; const { data } = await sb.from('contracts').select('*').eq('customer_id', g.customer_id).eq('status', 'aktiv').order('contract_date', { ascending: false }); cts = data || [];
    if (!g.contract_id && typ !== 'hf') { const u = cts.find(x => x.term === 'uzun') || cts[0]; if (u) g.contract_id = u.id; } };
  await loadCts();
  const ro = g.status === 'legv';
  const back = `<a class="back" href="#muqavileler?f=${typ}">${ico('back', 16)} ${GD_T[typ][0]}</a>`;
  function render() {
    const ct = cts.find(x => x.id === g.contract_id);
    const miss = cu ? reqMissing(cu).filter(m => typ === 'hf' ? m === 'VÖEN' : true) : [];
    mount('muqavileler', back + `
      <div class="head"><div><h1>${GD_T[typ][1]}${g.no ? ' № ' + esc(g.no) : ''}</h1><div class="sub">${g.src_label ? esc(g.src_label) + ' əsasında' : 'Əl ilə'}${!g.id && typ === 'hf' ? ` · nömrə yadda saxlayanda veriləcək (növbəti: ${esc(nums?.hf || '')})` : ''}${g.status === 'legv' ? ' · <span class="tag t-grey">Ləğv edilib</span>' : ''}</div></div>
        <div class="row">${g.id && !ro ? '<button class="btn danger" id="cancel">Ləğv et</button>' : ''}</div></div>
      <datalist id="custs">${cust.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
      <section class="card"><div class="fgrid">
        <label class="f" style="grid-column:span 2">Müştəri<input class="inp" id="cu" list="custs" value="${esc(cu?.name || '')}" ${g.id || g.src ? 'readonly' : ''}></label>
        <label class="f">Tarix<input class="inp" type="date" id="gdate" value="${g.doc_date}" ${ro ? 'readonly' : ''}></label>
        <label class="f">Növ<select class="inp" id="gkind" ${ro ? 'disabled' : ''}>${Object.entries(KIND_AZ).map(([k, l]) => `<option value="${k}" ${g.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">ƏDV<select class="inp" id="gvat" ${ro ? 'disabled' : ''}><option value="1">18% üstünə gəlir</option><option value="0" ${g.vat ? '' : 'selected'}>ƏDV-siz</option></select></label>
        ${typ === 'hf' ? '' : `<label class="f" style="grid-column:span 2">Müqavilə<select class="inp" id="gct" ${ro ? 'disabled' : ''}><option value="">— müqaviləsiz —</option>${cts.map(x => `<option value="${x.id}" ${x.id === g.contract_id ? 'selected' : ''}>${esc(x.no)} · ${dfmt(x.contract_date)} · ${x.term === 'uzun' ? 'uzunmüddətli' : 'birdəfəlik'}</option>`).join('')}</select></label>`}
      </div>
      ${typ !== 'hf' && g.customer_id && !cts.length ? `<div class="warnbox">Bu müştərinin qeyd olunmuş müqaviləsi yoxdur. <a href="#muqavile/yeni?c=${g.customer_id}">Müqavilə bağla</a> və ya <a href="#muqavile/yeni?imp=1&c=${g.customer_id}">köhnəsini qeyd et</a>.</div>` : ''}
      ${typ === 'qrp' && !ct && g.customer_id ? '<div class="note">QRP müqaviləyə istinad edir — müqavilə seçin.</div>' : ''}
      ${cu && miss.length ? `<div class="warnbox">Müştəri kartında doldurulmayıb: ${miss.join(', ')}. <a href="#musteri/${cu.id}">Müştəri kartını aç →</a></div>` : ''}</section>
      <section class="card"><h2>Sətirlər</h2><div class="note">Sətirlər sənəd üçün düzəldilə bilər — anbara, qaiməyə və borca təsir etmir.</div><div id="lines">${docLinesHTML(g.lines, ro)}</div><div class="note" id="ltot"></div></section>
      <div class="obar">${ro ? '' : '<button class="btn p" id="save">Yadda saxla</button>'}<button class="btn" id="word">Word</button><button class="btn" id="pdf">PDF</button><button class="btn" id="wa" title="E-qaimə üçün məlumatlar mühasibin WhatsApp-ına">${ico('send', 18)} WhatsApp → mühasib</button></div>`, al);
    bind();
  }
  const tot = () => { const e = document.getElementById('ltot'); if (e) e.textContent = `Yekun: ${money(linesTotal(g.lines, g.vat))}${g.vat ? ' (ƏDV daxil)' : ''}`; };
  function bind() {
    const v = id => document.getElementById(id);
    v('cu').onchange = async () => { const x = cust.find(z => norm(z.name) === norm(v('cu').value)); if (!x) return toast('Müştəri siyahıda tapılmadı', true); g.customer_id = x.id; g.contract_id = null; cu = await custRec(x.id); await loadCts(); render(); };
    v('gdate').onchange = e => g.doc_date = e.target.value;
    v('gkind').onchange = e => g.kind = e.target.value;
    v('gvat').onchange = e => { g.vat = e.target.value === '1'; g.lines.forEach(l => delete l.gross); tot(); };
    if (v('gct')) v('gct').onchange = e => { g.contract_id = e.target.value ? +e.target.value : null; };
    const box = v('lines'); const rr = () => { box.innerHTML = docLinesHTML(g.lines, ro); bindDocLines(box, g.lines, tot, rr); tot(); }; bindDocLines(box, g.lines, tot, rr); tot();
    if (v('save')) v('save').onclick = () => save().catch(fail);
    v('word').onclick = () => out('docx').catch(fail);
    v('pdf').onclick = () => out('pdf').catch(fail);
    v('wa').onclick = () => sendWA();
    if (v('cancel')) v('cancel').onclick = async () => { if (!confirm('Sənəd ləğv edilsin? (Silinmir, siyahıda «Ləğv» kimi qalır)')) return; const { error } = await sb.from('gen_docs').update({ status: 'legv' }).eq('id', g.id); if (error) return fail(error); toast('Ləğv edildi'); route(); };
  }
  async function save() {
    if (!g.customer_id) { toast('Müştərini seçin', true); return false; }
    const lines = cleanLines(g.lines); if (!lines.length) { toast('Ən azı bir sətir yazın', true); return false; }
    const row = { typ, doc_date: g.doc_date, customer_id: g.customer_id, contract_id: typ === 'hf' ? null : g.contract_id, kind: g.kind, vat: g.vat, lines, total: linesTotal(lines, g.vat), src: g.src, src_label: g.src_label };
    const q = g.id ? sb.from('gen_docs').update(row).eq('id', g.id).select().single() : sb.from('gen_docs').insert(row).select().single();
    const { data, error } = await q; if (error) { fail(error); return false; }
    const wasNew = !g.id; Object.assign(g, data); g.lines = data.lines;
    toast(`${GD_T[typ][1]}${g.no ? ' № ' + g.no : ''} yadda saxlandı`);
    if (wasNew) history.replaceState(null, '', `#sened-yarat/${typ}/${g.id}`);
    render(); return true;
  }
  async function build() {
    if (!ro) { if (!await save()) return null; }
    await loadDocLibs();
    const ct = cts.find(x => x.id === g.contract_id) || (g.contract_id ? (await sb.from('contracts').select('*').eq('id', g.contract_id).single()).data : null);
    const base = { ...buyerFields(cu), ...docRows(g.lines, g.vat) };
    const nm = cu?.name || '';
    if (typ === 'qrp') return { ct, base, tpl: 'qrp.docx', data: { ...base, ...dateParts(g.doc_date, 'd'), ...contractFields(ct), ...kindFields(g.kind), c_title: KIND_TXT[ct?.kind || g.kind].title }, name: `QRP ${ct ? ct.no + ' ' : ''}${dmy(g.doc_date)} - ${nm}` };
    if (typ === 'hf') { const y = +g.doc_date.slice(0, 4); return { ct, base, tpl: 'hesab_faktura.docx', data: { ...base, no: g.no, date: dmy(g.doc_date), date_suf: ordSuf(y) }, name: `Hesab-faktura ${g.no} - ${nm}` }; }
    return { ct, base, tpl: 'akt.docx', data: { ...base, date: dmy(g.doc_date), ...contractFields(ct), ...kindFields(g.kind) }, name: `Təhvil-təslim aktı ${dmy(g.doc_date)} - ${nm}` };
  }
  async function out(fmt) {
    const b = await build(); if (!b) return;
    await outputDoc(b.tpl, b.data, b.name, fmt);
  }
  // mühasibin WhatsApp söhbətini e-qaimə üçün məlumatlarla (mətn) aç
  async function sendWA() {
    const w = window.open('about:blank', '_blank'); // klikdən dərhal aç (brauzer bloklamasın)
    try {
      const phone = waNorm(await getSetting('wa_accountant'));
      if (!phone) { if (w) w.close(); toast(isAdmin() ? 'Mühasibin WhatsApp nömrəsi yazılmayıb — Hesab səhifəsində yazın' : 'Mühasibin WhatsApp nömrəsi yazılmayıb — Ruslan bəyə deyin', true); return; }
      const b = await build(); if (!b) { if (w) w.close(); return; }
      const r = b.base, T = { qrp: 'Qiymətlərin razılaşdırılması protokolu', hf: 'Hesab-faktura', akt: 'Təhvil-təslim aktı' }[typ];
      const L = [`*${T}${g.no ? ' № ' + g.no : ''}*${b.ct ? ` (${b.ct.no} müqaviləsi)` : ''} — ${dmy(g.doc_date)}`,
        `Alıcı: ${cu?.doc_name || cu?.name || ''}`, `VÖEN: ${cu?.voen || '—'}`, '',
        ...r.rows.map(x => `${x.n}. ${x.name} — ${x.unit}, ${x.qty} × ${x.price} = ${x.amount}`), '',
        ...(r.vat ? [`Cəmi: ${r.sum}`, `ƏDV 18%: ${r.vat_amt}`, `*Yekun: ${r.total} AZN*`] : [`*Yekun (ƏDV-siz): ${r.total} AZN*`])];
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(L.join('\n'))}`;
      if (w) w.location.href = url; else location.href = url;
      toast('WhatsApp açıldı — «Göndər» basın');
    } catch (e) { if (w) w.close(); fail(e); }
  }
  render();
}

// ---- müştəri kartı: sənəd rekvizitləri və müqavilələr ----
async function custDocsHTML(id) {
  const [cu, { data: cts }] = await Promise.all([custRec(id), sb.from('contracts').select('*').eq('customer_id', id).order('contract_date', { ascending: false })]);
  const F = (k, l, ph = '') => `<label class="f">${l}<input class="inp" data-k="${k}" value="${esc(cu[k] || '')}" placeholder="${esc(ph)}"></label>`;
  return `<section class="card"><div class="head"><h2>Sənəd rekvizitləri</h2><span class="note">Müqavilə, QRP, hesab-faktura və aktlara avtomatik yazılır</span></div>
      <div class="fgrid">
        ${F('doc_name', 'Sənəddə ad', cu.name)}${F('doc_name_gen', 'Yiyəlik hal (…-nin)', '(avtomatik)')}
        ${F('signer_pos', 'İmza edənin vəzifəsi', 'Direktor')}${F('signer_pos_gen', 'Vəzifə (…-su/-si)', '(avtomatik)')}
        ${F('signer_short', 'İmza edən (qısa)', 'Soyad Ad')}${F('signer_full', 'İmza edən (tam)', 'Soyad Ad Ata adı oğlu/qızı')}
        ${F('bank', 'Bank və filial')}${F('iban', 'H/H (IBAN)')}${F('corr_account', 'M/H')}${F('bank_code', 'Bank kodu')}${F('bank_voen', 'Bankın VÖEN-i')}${F('swift', 'SWIFT')}
        <label class="f" style="grid-column:1/-1">Hüquqi ünvan<input class="inp" data-k="legal_address" value="${esc(cu.legal_address || '')}"></label></div>
      <div class="row"><button class="btn" id="savec2">Yadda saxla</button></div></section>
    <section class="card tight"><div class="card" style="border:0;padding-bottom:6px"><div class="head"><h2>Müqavilələr</h2><div class="row"><a class="btn sm p" href="#muqavile/yeni?c=${id}">+ Müqavilə</a><a class="btn sm" href="#muqavile/yeni?imp=1&c=${id}">+ Köhnəni qeyd et</a></div></div></div>
      <div class="list">${(cts || []).map(r => `<a class="li" href="#muqavile/${r.id}"><span class="m"><span class="t">${esc(r.no)} · ${dfmt(r.contract_date)}</span><span class="d">${KIND_AZ[r.kind]} · ${r.term === 'uzun' ? 'uzunmüddətli' : 'birdəfəlik'}${r.imported ? ' · köhnə' : ''}</span></span><span class="r">${r.status === 'legv' ? '<span class="tag t-grey">Ləğv</span>' : '<span class="tag t-ok">qüvvədə</span>'}</span></a>`).join('') || '<div class="empty">Müqavilə yoxdur</div>'}</div></section>`;
}
function bindCustDocs(id) {
  const b = document.getElementById('savec2'); if (!b) return;
  b.onclick = async () => {
    const upd = {}; b.closest('section').querySelectorAll('[data-k]').forEach(e => upd[e.dataset.k] = e.value.trim() || null);
    const { error } = await sb.from('customers').update(upd).eq('id', id); if (error) return fail(error);
    toast('Rekvizitlər yadda saxlanıldı');
  };
}
// sənəd düymələri (sifariş, satış qaiməsi, təklif səhifələrində)
const docBtns = (q, typs = ['qrp', 'hf', 'akt']) => typs.map(t => `<a class="btn" href="#sened-yarat/${t}/yeni?${q}">${GD_T[t][0]}</a>`).join('');

/* ---------- Dəyişiklik jurnalı (yalnız rəhbər): kim, nə vaxt, nəyi dəyişib; ləğv edilmiş sənədlərin bərpası ---------- */
const TBL_AZ = { orders: 'Sifariş', order_items: 'Sifariş sətri', stock_moves: 'Anbar hərəkəti', sales_lines: 'Satış sətri', purchase_lines: 'Alış sətri', ledger: 'Pul / borc', products: 'Məhsul', customers: 'Müştəri' };
const OP_AZ = { INSERT: ['yaradılıb', 't-ok'], UPDATE: ['dəyişdirilib', 't-warn'], DELETE: ['silinib', 't-red'] };
const SKIP_KEYS = new Set(['updated_at', 'created_at', 'id', 'search']);
const jdt = x => new Date(x).toLocaleString('ru-RU', { timeZone: 'Asia/Baku', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const docLink = d => { const t = (d || '').slice(0, 2); return DOC_T[t] ? `<a href="#senedler?${new URLSearchParams({ t, q: d })}">${esc(d)}</a>` : esc(d || '—'); };
function auditDiff(a) {
  const o = a.old_row || {}, n = a.new_row || {};
  const v = x => x === null || x === undefined ? '—' : typeof x === 'object' ? JSON.stringify(x) : String(x);
  if (a.op === 'UPDATE') return Object.keys(n).filter(k => !SKIP_KEYS.has(k) && v(o[k]) !== v(n[k])).slice(0, 6).map(k => `<b>${esc(k)}</b>: ${esc(v(o[k]).slice(0, 60))} → ${esc(v(n[k]).slice(0, 60))}`).join('<br>');
  const r = a.op === 'DELETE' ? o : n;
  return ['name', 'product_name', 'qty', 'amount', 'price', 'kind', 'status', 'note'].filter(k => r[k] !== undefined && r[k] !== null && r[k] !== '').slice(0, 5).map(k => `<b>${esc(k)}</b>: ${esc(v(r[k]).slice(0, 60))}`).join(' · ');
}
async function viewJournal(params) {
  const al = await alerts();
  const back = `<a class="back" href="#hesab">${ico('back', 16)} Hesab</a>`;
  if (!isAdmin()) { mount('panel', back + '<div class="empty">Jurnal yalnız rəhbər üçündür</div>', al); return; }
  const f = params.get('f') === 'hamisi' ? 'hamisi' : 'legv';
  const q = (params.get('q') || '').replace(/[,()*%]/g, ' ').trim(); const d1 = params.get('from') || ''; const d2 = params.get('to') || '';
  const hq = o => '#jurnal?' + new URLSearchParams(Object.fromEntries(Object.entries({ f, q, from: d1, to: d2, ...o }).filter(([, v]) => v)));
  const chips = `<div class="chips">${[['legv', 'Ləğv edilmiş sənədlər'], ['hamisi', 'Bütün dəyişikliklər']].map(([k, l]) => `<a class="chip ${k === f ? 'on' : ''}" href="${hq({ f: k })}">${l}</a>`).join('')}</div>`;
  const filt = `<div class="fgrid" style="align-items:end">
      <label class="f" style="grid-column:span 2">Sənəd № və ya istifadəçi<input class="inp" id="q" type="search" placeholder="Məs.: PM-26-0419 və ya sales@" value="${esc(q)}"></label>
      <label class="f">Tarixdən<input class="inp" type="date" id="d1" value="${d1}"></label>
      <label class="f">Tarixədək<input class="inp" type="date" id="d2" value="${d2}"></label>
      <div class="row"><button class="btn p" id="go">Göstər</button>${q || d1 || d2 ? `<a class="btn" href="${hq({ q: '', from: '', to: '' }).replace(/[?&]$/, '')}">Təmizlə</a>` : ''}</div></div>`;
  const range = qb => { if (d1) qb = qb.gte(f === 'legv' ? 'deleted_at' : 'at', d1); if (d2) qb = qb.lt(f === 'legv' ? 'deleted_at' : 'at', isoD(new Date(new Date(d2).getTime() + 86400000))); return qb; };
  let body;
  if (f === 'legv') {
    let qb = sb.from('v_deleted_docs').select('*').order('deleted_at', { ascending: false }).limit(300);
    if (q) qb = qb.or(`doc.ilike.*${q}*,deleted_by.ilike.*${q}*`);
    const { data, error } = await range(qb); if (error) throw error;
    const ids = [...new Set(data.map(r => r.partner_id).filter(Boolean))];
    const names = {}; if (ids.length) { const { data: cs } = await sb.from('customers').select('id,name').in('id', ids); (cs || []).forEach(c => names[c.id] = c.name); }
    const restorable = d => /^(AQ|QA|QT|PM|PX)-/.test(d);
    body = `<div class="note">Sənəd «Ləğv et» ilə silinəndə və ya «Düzəlt» ilə yenidən yazılanda onun köhnə surəti burada saxlanılır (1C-dəki «silinməyə işarə» kimi). Ləğv edilmiş sənədi <b>Bərpa et</b> ilə geri qaytarmaq olar. İşçilər sənədləri birbaşa silə bilmir.</div>
      <section class="card tight"><div class="list">${data.map((r, i) => `<div class="li"><span class="m"><span class="d"><b>${docLink(r.doc)}</b> · ${jdt(r.deleted_at)} · ${esc(r.deleted_by || '')}</span>
          <span class="t">${esc(names[r.partner_id] || '')}</span></span>
          <span class="r"><span class="amt">${money(Number(r.ledger_amount) || Number(r.lines_amount))}</span>
          ${r.exists_now ? '<span class="tag t-warn">düzəldilib (köhnə variant)</span>' : '<span class="tag t-red">ləğv edilib</span>'}
          ${!r.exists_now && restorable(r.doc) ? `<button class="btn sm" data-rest="${i}">Bərpa et</button>` : ''}</span></div>`).join('') || '<div class="empty">Ləğv edilmiş sənəd yoxdur</div>'}</div></section>`;
    mount('panel', back + `<h1>Dəyişiklik jurnalı</h1>` + chips + filt + body, al);
    $app.querySelectorAll('[data-rest]').forEach(b => b.onclick = async () => {
      const r = data[+b.dataset.rest]; if (!confirm(`${r.doc} sənədi bərpa edilsin?`)) return;
      b.disabled = true; const { error } = await sb.rpc('restore_doc', { p_doc: r.doc, p_tx: r.tx }); if (error) { b.disabled = false; return fail(error); }
      invalidate(); alertCache = null; toast(`${r.doc} bərpa edildi`); route();
    });
  } else {
    let qb = sb.from('audit_log').select('*').order('id', { ascending: false }).limit(300);
    if (q) qb = qb.or(`doc.ilike.*${q}*,user_email.ilike.*${q}*`);
    const { data, error } = await range(qb); if (error) throw error;
    body = `<div class="note">Son 300 dəyişiklik: kim, nə vaxt, hansı sənəd və nə dəyişib.</div>
      <section class="card tight"><div class="scroll"><table class="t"><thead><tr><th>Vaxt</th><th>İstifadəçi</th><th>Nə</th><th>Sənəd</th><th>Təfsilat</th></tr></thead><tbody>
      ${data.map(a => `<tr><td style="white-space:nowrap">${jdt(a.at)}</td><td>${esc((a.user_email || '').replace('@medigroup.az', ''))}</td>
        <td style="white-space:nowrap">${esc(TBL_AZ[a.tbl] || a.tbl)} <span class="tag ${OP_AZ[a.op]?.[1] || ''}">${OP_AZ[a.op]?.[0] || a.op}</span></td>
        <td style="white-space:nowrap">${docLink(a.doc)}</td><td style="font-size:12.5px">${auditDiff(a)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Qeyd yoxdur</td></tr>'}
      </tbody></table></div></section>`;
    mount('panel', back + `<h1>Dəyişiklik jurnalı</h1>` + chips + filt + body, al);
  }
  const go = () => location.hash = hq({ q: document.getElementById('q').value.trim(), from: document.getElementById('d1').value, to: document.getElementById('d2').value });
  document.getElementById('go').onclick = go; document.getElementById('q').onkeydown = e => { if (e.key === 'Enter') go(); };
}

/* ---------- router ---------- */
async function route() {
  if (!state.user) return renderLogin();
  if (needPassword) return renderSetPassword();
  if (location.hash.includes('access_token=')) { history.replaceState(null, '', location.pathname + '#panel'); }
  const [path, qs] = (location.hash.slice(1) || 'panel').split('?'); const params = new URLSearchParams(qs || '');
  const [view, id, id2] = path.split('/');
  try {
    if (view === 'panel') await viewPanel();
    else if (view === 'sifarisler') await viewOrders(params);
    else if (view === 'yeni-sifaris') { if (params.get('c')) { const { data, error } = await sb.from('orders').insert({ customer_id: +params.get('c') }).select().single(); if (error) throw error; location.replace('#sifaris/' + data.id); return; } await viewNewOrder(); }
    else if (view === 'sifaris') await viewOrder(+id);
    else if (view === 'sifaris1c') await viewOrder1C(+id);
    else if (view === 'qaime') { await viewInvoice(+id); return; }
    else if (view === 'qaime1c') { await viewInvoice1C(params); return; }
    else if (view === 'capdoc') { await viewDocPrint(params); return; }
    else if (view === 'anbar') await viewStock(params);
    else if (view === 'mehsul') await viewProduct(+id);
    else if (view === 'mehsul-yeni') await viewNewProduct();
    else if (view === 'medaxil') await viewReceipt(params);
    else if (view === 'musteriler') await viewCustomers(params);
    else if (view === 'musteri') await viewCustomer(+id);
    else if (view === 'cixaris') await viewStatement(+id, params);
    else if (view === 'musteri-yeni') await viewNewCustomer();
    else if (view === 'odenisler') await viewPayments(params);
    else if (view === 'idxal') await viewImport();
    else if (view === 'odenis-yeni') await viewNewPayment(params);
    else if (view === 'senedler') await viewDocs(params);
    else if (view === 'sened') await viewDoc(params);
    else if (view === 'qaytarma') await viewReturn(params);
    else if (view === 'hesabatlar') await viewReports(params);
    else if (view === 'idxal-tarixce') await viewImportHistory();
    else if (view === 'hesab') await viewAccount();
    else if (view === 'daha') await viewMore();
    else if (view === 'jurnal') await viewJournal(params);
    else if (view === 'teklifler') await viewOffers(params);
    else if (view === 'teklif') await viewOffer(id, params);
    else if (view === 'muqavileler') await viewContracts(params);
    else if (view === 'muqavile') await viewContract(id, params);
    else if (view === 'sened-yarat') await viewGenDoc(id, id2, params);
    else location.hash = '#panel';
    window.scrollTo(0, 0);
  } catch (e) { fail(e); }
}
window.addEventListener('hashchange', route);
/* «Yuxarı qayıt» düyməsi: aşağı düşəndə görünür, basanda səhifənin başına qaldırır */
(() => {
  const b = document.createElement('button'); b.className = 'totop noprint'; b.type = 'button'; b.title = 'Yuxarı qayıt'; b.setAttribute('aria-label', 'Yuxarı qayıt');
  b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  b.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.append(b);
  const upd = () => b.classList.toggle('on', window.scrollY > 500);
  window.addEventListener('scroll', upd, { passive: true }); window.addEventListener('hashchange', () => setTimeout(upd, 50));
})();
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') { needPassword = true; state.user = session?.user || null; return route(); }
  const u = session?.user || null; const changed = (u?.id) !== (state.user?.id);
  state.user = u; if (changed || ev === 'INITIAL_SESSION') { invalidate(); alertCache = null; route(); }
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---- yeni versiya yoxlaması: serverdəki fayllar dəyişibsə, yuxarıda "Yenilə" zolağı ----
(() => {
  const FILES = ['index.html', 'app.js', 'styles.css', 'config.js', 'sablonlar.js', 'docdata.js', 'docxpdf.js', 'offerpdf.js'];
  const sig = async () => {
    const r = await Promise.all(FILES.map(f => fetch(f, { method: 'HEAD', cache: 'no-store' }).then(x => x.ok ? (x.headers.get('etag') || x.headers.get('last-modified') || '') : '').catch(() => null)));
    return r.includes(null) ? null : r.join('|');
  };
  let base = null, shown = false;
  const show = () => {
    if (shown) return; shown = true;
    const d = document.createElement('div'); d.id = 'updbar';
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;background:#1d4ed8;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,.25)';
    d.innerHTML = '<span>Proqramın yeni versiyası hazırdır.</span><button type="button" style="background:#fff;color:#1d4ed8;border:0;border-radius:6px;padding:6px 16px;font-weight:600;cursor:pointer">Yenilə</button><span style="opacity:.8;font-size:13px">(yarımçıq sənədi əvvəlcə yadda saxlayın)</span>';
    d.querySelector('button').onclick = () => location.reload();
    document.body.append(d);
  };
  const check = async () => {
    if (shown || !navigator.onLine) return;
    const s = await sig(); if (s === null) return;
    if (base === null) { base = s; return; }
    if (s !== base) show();
  };
  check();
  setInterval(check, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
})();
