/* MEDİGROUP sənədləri — şablon məlumatlarının hazırlanması (müqavilə, QRP, hesab-faktura, akt).
   Qiymətlər tətbiqdə ƏDV daxil saxlanılır; sənəddə ƏDV-siz qiymət = qiymət / 1.18 (nümunələrdəki kimi). */
const DOC_AY = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
function docWords(n) {
  const b = ['', 'bir', 'iki', 'üç', 'dörd', 'beş', 'altı', 'yeddi', 'səkkiz', 'doqquz'];
  const o = ['', 'on', 'iyirmi', 'otuz', 'qırx', 'əlli', 'altmış', 'yetmiş', 'səksən', 'doxsan'];
  const tri = x => { const y = Math.floor(x / 100), r = x % 100, w = []; if (y) w.push(y === 1 ? 'yüz' : b[y] + ' yüz'); if (Math.floor(r / 10)) w.push(o[Math.floor(r / 10)]); if (r % 10) w.push(b[r % 10]); return w.join(' '); };
  if (n === 0) return 'sıfır';
  const w = [], mln = Math.floor(n / 1e6), th = Math.floor(n / 1000) % 1000, rest = n % 1000;
  if (mln) w.push(tri(mln) + ' milyon'); if (th) w.push(th === 1 ? 'min' : tri(th) + ' min'); if (rest) w.push(tri(rest));
  return w.join(' ');
}
const docMoneyWords = t => { const m = Math.floor(t + 1e-9), q = Math.round((t - m) * 100), w = docWords(m); return `${w.charAt(0).toUpperCase() + w.slice(1)} manat ${String(q).padStart(2, '0')} qəpik`; };
// sıra sayının şəkilçisi: 2026-cı, 2027-ci, 2023-cü, 2029-cu
function ordSuf(n) {
  const d = n % 10, t = n % 100;
  if (d) return { 1: 'ci', 2: 'ci', 3: 'cü', 4: 'cü', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci', 9: 'cu' }[d];
  if (t) return { 10: 'cu', 20: 'ci', 30: 'cu', 40: 'cı', 50: 'ci', 60: 'cı', 70: 'ci', 80: 'ci', 90: 'cı' }[t];
  return n % 1000 ? 'cü' : 'ci';
}
const lastVowel = s => { const m = String(s).toLocaleLowerCase('az').match(/[aıoueəiöü](?=[^aıoueəiöü]*$)/); return m ? m[0] : 'ə'; };
const harm4 = v => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', ə: 'i', i: 'i', ö: 'ü', ü: 'ü' })[v];
// yiyəlik hal: «AFE FARM» MMC → «AFE FARM» MMC-nin; «… ASSOSİASİYASI» → «… ASSOSİASİYASI»-nın
function genitive(name) {
  const s = String(name || '').trim(); if (!s) return '';
  const abbr = { MMC: 'nin', ASC: 'nin', QSC: 'nin', AÜ: 'nün', İB: 'nin', PUM: 'un', QHT: 'nin', 'LLC': 'nin' };
  const lw = s.split(/\s+/).pop().replace(/[«»"“”'’]/g, '');
  if (abbr[lw.toUpperCase()]) return s + '-' + abbr[lw.toUpperCase()];
  const v = lastVowel(lw), endsV = /[aıoueəiöü]$/i.test(lw.toLocaleLowerCase('az'));
  return s + '-' + (endsV ? 'n' : '') + harm4(v) + 'n';
}
// mənsubiyyət: Direktor → Direktoru, Baş katib → Baş katibi, Sədr → Sədri
function possessive(pos) {
  const s = String(pos || '').trim(); if (!s) return '';
  const lw = s.split(/\s+/).pop(); const endsV = /[aıoueəiöü]$/i.test(lw.toLocaleLowerCase('az'));
  return s + (endsV ? 's' : '') + harm4(lastVowel(lw));
}
const fmtQty = v => { const n = Number(v || 0); return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''); };
const fmt2 = v => Number(v || 0).toFixed(2);
const fmtPrice = v => { const s = Number(v || 0).toFixed(3); return s.endsWith('0') ? s.slice(0, -1) : s; };
const r2d = v => Math.round(Number(v || 0) * 100) / 100;
function dateParts(iso, pfx) {
  const d = new Date(iso + 'T12:00:00'), y = d.getFullYear();
  return { [pfx + '_day']: String(d.getDate()).padStart(2, '0'), [pfx + '_month']: DOC_AY[d.getMonth()], [pfx + '_year']: String(y), [pfx + '_suf']: ordSuf(y) };
}
const dmy = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '';
/* rows: [{name, unit, qty, price (ƏDV-siz), gross? (ƏDV daxil sətir məbləği — 1C qaimələrindən)}]; vat: true/false
   Sifarişlərdə olduğu kimi: məbləğ = miqdar × qiymət, ƏDV 18% üstünə gəlir. 1C qaiməsindən gələn sətirlərdə yekun qaimənin özüdür. */
function docRows(rows, vat) {
  const out = rows.filter(r => (r.name || '').trim()).map((r, i) => {
    const net = r2d(Number(r.qty || 0) * Number(r.price || 0));
    return { n: String(i + 1), name: r.name || '', unit: r.unit || 'ədəd', qty: fmtQty(r.qty), price: fmtPrice(r.price), amount: fmt2(net), _net: net, _gross: r.gross };
  });
  const sum = r2d(out.reduce((t, r) => t + r._net, 0));
  const allGross = vat && out.length && out.every(r => r._gross != null && r._gross !== '');
  const total = !vat ? sum : allGross ? r2d(out.reduce((t, r) => t + Number(r._gross), 0)) : r2d(sum + r2d(sum * 0.18));
  const w = docMoneyWords(total);
  return { rows: out, vat: !!vat, sum: fmt2(sum), vat_amt: fmt2(r2d(total - sum)), total: fmt2(total), total_words: w, total_words_lc: w.replace(/^./, c => c.toLocaleLowerCase('az')), _total: total };
}
// firma adını dırnağa al: «Leyla Medical Center MMC» → «“Leyla Medical Center” MMC»; f/ş «Ad» → f/ş “Ad”
// adda artıq dırnaq varsa toxunulmur
const LEGAL_FORMS = ['MMC', 'ASC', 'QSC', 'AASC', 'ATSC', 'PHŞ', 'PŞ', 'İB', 'İctimai Birliyi', 'MTK', 'LLC', 'LTD', 'Ltd', 'Ltd.', 'LTD.', 'Co.,LTD', 'CO.,LTD', 'A.Ş', 'A.Ş.', 'OOO', 'QSC.', 'MMC.'];
function quoteName(n) {
  n = String(n || '').replace(/\s+/g, ' ').trim(); if (!n) return n;
  if (/[“”"«»„]|''/.test(n)) return n;
  const fs = n.match(/^(f\s*\/\s*ş\.?)\s+(.+)$/i); if (fs) return `${fs[1]} “${fs[2]}”`;
  const forms = [...LEGAL_FORMS].sort((a, b) => b.length - a.length);
  for (const f of forms) { const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const m = n.match(new RegExp(`^(.+?)[\\s,]+(${esc})$`, 'i'));
    if (m) return `“${m[1]}” ${m[2]}`; }
  return `“${n}”`;
}
// müştəri kartından şablon sahələri
function buyerFields(c) {
  c = c || {};
  const name = quoteName(c.doc_name || c.name || '');
  const pos = c.signer_pos || 'Direktor';
  return {
    b_name: name, b_name_gen: c.doc_name_gen || genitive(name), b_voen: c.voen || '', b_bank: c.bank || '', b_hh: c.iban || '', b_mh: c.corr_account || '',
    b_kod: c.bank_code || '', b_bvoen: c.bank_voen || '', b_swift: c.swift || '', b_addr: c.legal_address || c.address || '',
    b_pos: pos, b_pos_gen: c.signer_pos_gen || possessive(pos), b_person: c.signer_full || c.signer_short || '', b_person_full: c.signer_full || c.signer_short || '',
  };
}
function contractFields(ct) {
  if (!ct) return { c_no: '' };
  const d = ct.contract_date || ct.date;
  return { c_no: ct.no, c_date: dmy(d), ...dateParts(d, 'c') };
}
if (typeof module !== 'undefined') module.exports = { quoteName, docRows, buyerFields, contractFields, dateParts, dmy, genitive, possessive, ordSuf, docMoneyWords };
// müqavilə/sənəd növü: 'mal' | 'xidmet' | 'qarisiq' — sətirlərin növünə görə təklif
const KIND_TXT = {
  mal: { title: 'Malların alqı-satqısı haqqında', subj_gen: 'malların', col_name: 'Malın adı', akt: 'İcraçı tərəfindən aşağıda qeyd olunan mallar təchiz edilmiş və Sifarişçiyə təhvil verilmişdir',
    pay: 'Ödəniş “SATICI” tərəfindən təqdim olunan fakturaya əsasən “ALICI” tərəfindən malların təhvilindən öncə tam həcmdə həyata keçirilir.' },
  xidmet: { title: 'Xidmətlərin göstərilməsi haqqında', subj_gen: 'xidmətlərin', col_name: 'Xidmətin adı', akt: 'İcraçı tərəfindən aşağıda qeyd olunan xidmətlər göstərilmiş və Sifarişçi tərəfindən qəbul edilmişdir',
    pay: 'Ödəniş “SATICI” tərəfindən təqdim olunan fakturaya əsasən “ALICI” tərəfindən xidmətlərin göstərilməsindən öncə tam həcmdə həyata keçirilir.' },
  qarisiq: { title: 'Malların alqı-satqısı və xidmətlərin göstərilməsi haqqında', subj_gen: 'malların və xidmətlərin', col_name: 'Malın (xidmətin) adı',
    akt: 'İcraçı tərəfindən aşağıda qeyd olunan mallar təchiz edilmiş, xidmətlər göstərilmiş və Sifarişçiyə təhvil verilmişdir',
    pay: 'Ödəniş “SATICI” tərəfindən təqdim olunan fakturaya əsasən “ALICI” tərəfindən malların təhvilindən və xidmətlərin göstərilməsindən öncə tam həcmdə həyata keçirilir.' },
};
const kindOf = rows => { const s = rows.filter(r => r.service).length; return !s ? 'mal' : s === rows.length ? 'xidmet' : 'qarisiq'; };
const kindFields = k => { const t = KIND_TXT[k] || KIND_TXT.mal; return { c_title: t.title, subj_gen: t.subj_gen, col_name: t.col_name, akt_text: t.akt }; };
if (typeof module !== 'undefined') Object.assign(module.exports, { KIND_TXT, kindOf, kindFields });

// müqavilənin növə görə dəyişən cümlələri (s: uzunmüddətli, o: birdəfəlik)
const CONTRACT_V = {
"mal": {
"title": "Malların alqı-satqısı haqqında",
"s11": "1.1. “ALICI” sifariş verir, “SATICI” isə hazırkı Müqavilə ilə nəzərdə tutulmuş şərtlərlə “ALICI”-nın sifarişi əsasında “ALICI”-nı mallarla təmin edir.",
"o11": "1.1. “SATICI” aşağıdakı cədvəldə göstərilən malları “ALICI”-ya satır və təhvil verir, “ALICI” isə həmin malları qəbul edir və dəyərini bu Müqavilədə nəzərdə tutulmuş qaydada ödəyir.",
"o12": "1.2. Malların adı, miqdarı və qiyməti:",
"s21": "2.1. “ALICI”-nın sifarişi əsasında və Müqavilə çərçivəsində ehtiyacı olan malları vaxtında təhvil verir.",
"s22": "2.2. Sifariş edilən malları “ALICI”-nın təklif istək formasına “SATICI” tərəfindən verilən “cavab”da qeyd olunan müddət ərzində “ALICI”-ya və ya onun səlahiyyətli nümayəndəsinə təhvil verir.",
"o22": "2.2. Malları {delivery} ərzində “ALICI”-ya və ya onun səlahiyyətli nümayəndəsinə təhvil verir.",
"s23": "2.3. Təhvil verdiyi malların keyfiyyətinə təminat verir.",
"s25": "2.5. “SATICI” təhvil verilən mallara görə faktura təqdim edir.",
"s26": "2.6. “SATICI” malları vaxtında təhvil vermədikdə, hər gecikdirilən gün üçün sifariş məbləğinin 0,1% həcmində cərimə ödəməlidir.",
"s27": "2.7. “SATICI” malların “ALICI”-ya çatdırılmasını təmin edir.",
"s28": "2.8. “SATICI” “ALICI”-nı istehsalçı-zavod tərəfindən müəyyən edilmiş qaydalara uyğun mallarla təmin edir.",
"s29": "2.9. “SATICI” “ALICI”-nı üçüncü şəxslərin hüquqlarından azad mallarla təmin etməyi öhdəsinə götürür.",
"s210": "2.10. “SATICI” “ALICI” tərəfindən sifariş təqdim edildiyi tarixdən etibarən sifarişdə göstərilən malları ən geci 2 (iki) iş günü ərzində “ALICI”-ya təhvil verməyi öhdəsinə götürür.",
"s31": "3.1. “ALICI” mallarla əlaqədar ortaya çıxan çatışmazlıqlar barədə onları aşkar etdikdən sonra 7 (yeddi) gün ərzində “SATICI”-nı xəbərdar edir.",
"s32": "3.2. “ALICI” hazırkı Müqavilənin 2.1-ci bəndində göstərilmiş malların vaxtında gətirilməsini “SATICI”-dan tələb etmək hüququna malikdir.",
"s33": "3.3. Müqavilə üzrə alınan mallar nəzərdə tutulan xüsusiyyətə və keyfiyyətə malik olmadıqda “ALICI” heç bir ödəniş həyata keçirmədən onları “SATICI”-ya geri qaytarır.",
"s34": "3.4. “SATICI” malları “ALICI”-ya tərəflər arasında imzalanmış QRP (Qiymətlərin Razılaşdırılması Protokolu) və Təhvil-təslim aktı əsasında təhvil verməyi öz öhdəsinə götürür.",
"o34": "3.4. “SATICI” malları “ALICI”-ya tərəflər arasında imzalanmış Təhvil-təslim aktı əsasında təhvil verməyi öz öhdəsinə götürür.",
"a": "a) mallar keyfiyyətsiz olduqda;",
"b": "b) sifariş edilən malları vaxtında təmin etmədikdə."
},
"xidmet": {
"title": "Xidmətlərin göstərilməsi haqqında",
"s11": "1.1. “ALICI” sifariş verir, “SATICI” isə hazırkı Müqavilə ilə nəzərdə tutulmuş şərtlərlə “ALICI”-nın sifarişi əsasında “ALICI”-nı xidmətlərlə təmin edir.",
"o11": "1.1. “SATICI” aşağıdakı cədvəldə göstərilən xidmətləri “ALICI”-ya göstərir, “ALICI” isə həmin xidmətləri qəbul edir və dəyərini bu Müqavilədə nəzərdə tutulmuş qaydada ödəyir.",
"o12": "1.2. Xidmətlərin adı, miqdarı və qiyməti:",
"s21": "2.1. “ALICI”-nın sifarişi əsasında və Müqavilə çərçivəsində ehtiyacı olan xidmətləri vaxtında göstərir.",
"s22": "2.2. Sifariş edilən xidmətləri “ALICI”-nın təklif istək formasına “SATICI” tərəfindən verilən “cavab”da qeyd olunan müddət ərzində göstərir və “ALICI”-ya və ya onun səlahiyyətli nümayəndəsinə təhvil verir.",
"o22": "2.2. Xidmətləri {delivery} ərzində göstərir və “ALICI”-ya və ya onun səlahiyyətli nümayəndəsinə təhvil verir.",
"s23": "2.3. Göstərdiyi xidmətlərin keyfiyyətinə təminat verir.",
"s25": "2.5. “SATICI” göstərilən xidmətlərə görə faktura təqdim edir.",
"s26": "2.6. “SATICI” xidmətləri vaxtında göstərmədikdə, hər gecikdirilən gün üçün sifariş məbləğinin 0,1% həcmində cərimə ödəməlidir.",
"s27": "2.7. “SATICI” xidmətlərin “ALICI”-ya vaxtında və tam həcmdə göstərilməsini təmin edir.",
"s28": "2.8. “SATICI” xidmətləri istehsalçı-zavod tərəfindən müəyyən edilmiş qaydalara və müvafiq texniki normalara uyğun göstərir.",
"s29": "2.9. “SATICI” xidmətlərin göstərilməsi zamanı üçüncü şəxslərin hüquqlarının pozulmamasını təmin etməyi öhdəsinə götürür.",
"s210": "2.10. “SATICI” “ALICI” tərəfindən sifariş təqdim edildiyi tarixdən etibarən sifarişdə göstərilən xidmətləri ən geci 2 (iki) iş günü ərzində göstərməyi öhdəsinə götürür.",
"s31": "3.1. “ALICI” xidmətlərlə əlaqədar ortaya çıxan çatışmazlıqlar barədə onları aşkar etdikdən sonra 7 (yeddi) gün ərzində “SATICI”-nı xəbərdar edir.",
"s32": "3.2. “ALICI” hazırkı Müqavilənin 2.1-ci bəndində göstərilmiş xidmətlərin vaxtında göstərilməsini “SATICI”-dan tələb etmək hüququna malikdir.",
"s33": "3.3. Göstərilən xidmətlər nəzərdə tutulan tələblərə və keyfiyyətə uyğun olmadıqda “ALICI” həmin xidmətlər üzrə ödəniş həyata keçirməmək və çatışmazlıqların aradan qaldırılmasını “SATICI”-dan tələb etmək hüququna malikdir.",
"s34": "3.4. “SATICI” göstərilmiş xidmətləri “ALICI”-ya tərəflər arasında imzalanmış QRP (Qiymətlərin Razılaşdırılması Protokolu) və Təhvil-təslim aktı əsasında təhvil verməyi öz öhdəsinə götürür.",
"o34": "3.4. “SATICI” göstərilmiş xidmətləri “ALICI”-ya tərəflər arasında imzalanmış Təhvil-təslim aktı əsasında təhvil verməyi öz öhdəsinə götürür.",
"a": "a) xidmətlər keyfiyyətsiz göstərildikdə;",
"b": "b) sifariş edilən xidmətləri vaxtında göstərmədikdə."
},
"qarisiq": {
"title": "Malların alqı-satqısı və xidmətlərin göstərilməsi haqqında",
"s11": "1.1. “ALICI” sifariş verir, “SATICI” isə hazırkı Müqavilə ilə nəzərdə tutulmuş şərtlərlə “ALICI”-nın sifarişi əsasında “ALICI”-nı mallarla və xidmətlərlə təmin edir.",
"o11": "1.1. “SATICI” aşağıdakı cədvəldə göstərilən malları “ALICI”-ya satır və təhvil verir, xidmətləri isə göstərir, “ALICI” həmin malları və xidmətləri qəbul edir və dəyərini bu Müqavilədə nəzərdə tutulmuş qaydada ödəyir.",
"o12": "1.2. Malların və xidmətlərin adı, miqdarı və qiyməti:",
"s21": "2.1. “ALICI”-nın sifarişi əsasında və Müqavilə çərçivəsində ehtiyacı olan malları vaxtında təhvil verir və xidmətləri vaxtında göstərir.",
"s22": "2.2. Sifariş edilən malları və xidmətləri “ALICI”-nın təklif istək formasına “SATICI” tərəfindən verilən “cavab”da qeyd olunan müddət ərzində “ALICI”-ya və ya onun səlahiyyətli nümayəndəsinə təhvil verir.",
"o22": "2.2. Malları və xidmətləri {delivery} ərzində “ALICI”-ya və ya onun səlahiyyətli nümayəndəsinə təhvil verir.",
"s23": "2.3. Təhvil verdiyi malların və göstərdiyi xidmətlərin keyfiyyətinə təminat verir.",
"s25": "2.5. “SATICI” təhvil verilən mallara və göstərilən xidmətlərə görə faktura təqdim edir.",
"s26": "2.6. “SATICI” malları vaxtında təhvil vermədikdə və ya xidmətləri vaxtında göstərmədikdə, hər gecikdirilən gün üçün sifariş məbləğinin 0,1% həcmində cərimə ödəməlidir.",
"s27": "2.7. “SATICI” malların “ALICI”-ya çatdırılmasını və xidmətlərin göstərilməsini təmin edir.",
"s28": "2.8. “SATICI” “ALICI”-nı istehsalçı-zavod tərəfindən müəyyən edilmiş qaydalara uyğun mallarla təmin edir və xidmətləri həmin qaydalara uyğun göstərir.",
"s29": "2.9. “SATICI” “ALICI”-nı üçüncü şəxslərin hüquqlarından azad mallarla təmin etməyi öhdəsinə götürür.",
"s210": "2.10. “SATICI” “ALICI” tərəfindən sifariş təqdim edildiyi tarixdən etibarən sifarişdə göstərilən malları təhvil verməyi və xidmətləri göstərməyi ən geci 2 (iki) iş günü ərzində öhdəsinə götürür.",
"s31": "3.1. “ALICI” mallarla və xidmətlərlə əlaqədar ortaya çıxan çatışmazlıqlar barədə onları aşkar etdikdən sonra 7 (yeddi) gün ərzində “SATICI”-nı xəbərdar edir.",
"s32": "3.2. “ALICI” hazırkı Müqavilənin 2.1-ci bəndində göstərilmiş malların vaxtında gətirilməsini və xidmətlərin vaxtında göstərilməsini “SATICI”-dan tələb etmək hüququna malikdir.",
"s33": "3.3. Müqavilə üzrə alınan mallar və ya göstərilən xidmətlər nəzərdə tutulan xüsusiyyətə və keyfiyyətə malik olmadıqda “ALICI” onlar üzrə heç bir ödəniş həyata keçirmir və malları “SATICI”-ya geri qaytarır.",
"s34": "3.4. “SATICI” malları və göstərilmiş xidmətləri “ALICI”-ya tərəflər arasında imzalanmış QRP (Qiymətlərin Razılaşdırılması Protokolu) və Təhvil-təslim aktı əsasında təhvil verməyi öz öhdəsinə götürür.",
"o34": "3.4. “SATICI” malları və göstərilmiş xidmətləri “ALICI”-ya tərəflər arasında imzalanmış Təhvil-təslim aktı əsasında təhvil verməyi öz öhdəsinə götürür.",
"a": "a) mallar keyfiyyətsiz olduqda və ya xidmətlər keyfiyyətsiz göstərildikdə;",
"b": "b) sifariş edilən malları və xidmətləri vaxtında təmin etmədikdə."
}
};
function contractTexts(kind, one, delivery) {
  const w = CONTRACT_V[kind] || CONTRACT_V.mal, g = k => w[(one && w['o' + k.slice(1)]) ? 'o' + k.slice(1) : k];
  const r = { one: !!one, uzun: !one, t11: one ? w.o11 : w.s11, t12: one ? w.o12 : '', t21: w.s21, t22: (one ? w.o22 : w.s22).replace('{delivery}', delivery || '15 (on beş) iş günü'), t23: w.s23,
    t25: w.s25, t26: w.s26, t27: w.s27, t28: w.s28, t29: w.s29, t210: w.s210, t31: w.s31, t32: w.s32, t33: w.s33, t34: one ? w.o34 : w.s34, ta: w.a, tb: w.b };
  void g; return r;
}
if (typeof module !== 'undefined') Object.assign(module.exports, { CONTRACT_V, contractTexts });
