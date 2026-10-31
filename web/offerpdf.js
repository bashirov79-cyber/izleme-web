/* MEDİGROUP qiymət təklifi — PDF (jsPDF). Ruslanın "Medigroup teklif" şablonunun eynisi: A4 albom.
   buildOfferPDF(jsPDF, o, A)
   o: { lang, number, date:'YYYY-MM-DD', customer, currency, vat_included, delivery, payment, valid_days, warranty, place, terms?:[], groups:[{title, items:[{name, qty, unit, price, img}]}] }
   A: { fontR, fontB (base64 TTF), logo:{data,w,h}, img:{key:{data,w,h,fmt}}, seal:{data,w,h}|null } */
const OFFER_TXT = {
  az: { title: 'Qiymət təklifi', to: 'Kimə', cols: ['Malın adı', 'Miqdar', 'Vahid', 'Qiymət/{cur}'], unit: 'əd', terms_h: 'Şərtlər', req_h: 'Rekvizitlər',
    dir: 'Direktor', name: 'Ruslan Bəşirov', seal: 'M.Y.', page: 'Səhifə',
    terms: ['Zəmanət {warranty}', 'Çatdırılma müddəti {delivery}', 'Çatdırılma yeri: {place}', '{vat}', 'Ödəniş şərti: {payment}', 'Qiymət təklifi {until} tarixinədək qüvvədədir'],
    vat_in: 'Qiymətlərə ƏDV daxildir', vat_ex: 'Qiymətlərə ƏDV daxil deyil', d_warranty: '1 ildir', d_delivery: '15 iş günüdür', d_payment: 'Razılaşma yolu ilə', d_place: 'Bakı şəhəri' },
  en: { title: 'Proforma Invoice', to: 'To', cols: ['Description', 'Quantity', 'Unit', 'Unit price ({cur})'], unit: 'pcs', terms_h: 'Terms', req_h: 'Bank details',
    dir: 'Director', name: 'Ruslan Bashirov', seal: 'Stamp', page: 'Page',
    terms: ['Warranty {warranty}', 'Delivery time {delivery}', 'Delivery place: {place}', '{vat}', 'Payment terms: {payment}', 'Valid until {until}'],
    vat_in: 'VAT 18% included in prices', vat_ex: 'VAT 18% not included in prices', d_warranty: '1 year', d_delivery: '15 working days', d_payment: 'by agreement', d_place: 'Baku' },
};
const OFFER_REKV = ['“MEDİGROUP” MMC  ·  VÖEN: 1004732761',
  'Bank: “PAŞABANK” ASC  ·  Kod: 505141  ·  VÖEN: 1700767721  ·  SWIFT: PAHAAZ22',
  'H/h: AZ63PAHA40060AZNHC0100028391  ·  M/h: AZ82NABZ01350100000000071944',
  'Hüquqi ünvan: Binəqədi r-nu, M.Ə.Rəsulzadə ŞTQ, Ə.Ağayev 124, m. 111'];
const OFFER_CONTACT = [['Tel:   (+99412) 530 06 56', 0], ['Mob: (+99470) 272 03 02', 0], ['Mob: (+99455) 665 03 02', 0], ['Mob: (+99450) 338 03 02', 0], ['', 0],
  ['sales@medigroup.az', 'mailto:sales@medigroup.az'], ['bashirov@medigroup.az', 'mailto:bashirov@medigroup.az'], ['www.medigroup.az', 'https://www.medigroup.az']];
const offerMoney = v => (v === null || v === undefined || v === '') ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const offerUntil = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + (Number(n) || 30)); return String(x.getDate()).padStart(2, '0') + '.' + String(x.getMonth() + 1).padStart(2, '0') + '.' + x.getFullYear(); };
const offerDMY = d => d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4);

function buildOfferPDF(jsPDF, o, A) {
  const L = OFFER_TXT[o.lang] || OFFER_TXT.az, cur = o.currency || 'AZN';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('NS-R.ttf', A.fontR); doc.addFont('NS-R.ttf', 'NS', 'normal');
  doc.addFileToVFS('NS-B.ttf', A.fontB); doc.addFont('NS-B.ttf', 'NS', 'bold');
  const PW = 297, PH = 210, M = 10, W = PW - 2 * M, BOT = PH - 10;
  const cw = [W * 0.657, W * 0.0775, W * 0.065, W * 0.2]; const cx = [M, M + cw[0], M + cw[0] + cw[1], M + cw[0] + cw[1] + cw[2]];
  const PINK = [217, 150, 148], GREY = [237, 237, 237], GREEN = [62, 110, 14], TXT = [0, 0, 0], DIM = [89, 89, 89];
  const font = (st, sz, col) => { doc.setFont('NS', st); doc.setFontSize(sz); doc.setTextColor(...(col || TXT)); };
  doc.setLineWidth(0.25); doc.setDrawColor(0);
  let y = M;
  // başlıq: loqo + əlaqə
  if (A.logo) { const h = 30, w = h * A.logo.w / A.logo.h; doc.addImage(A.logo.data, 'PNG', M + 2, y + 1, w, h); }
  font('normal', 9.5, GREEN); let cy = y + 6;
  for (const [t, link] of OFFER_CONTACT) {
    if (t) { const tx = PW - M - 52; if (link) { doc.setTextColor(17, 17, 136); doc.textWithLink(t, tx, cy, { url: link }); doc.setDrawColor(17, 17, 136); doc.line(tx, cy + 0.6, tx + doc.getTextWidth(t), cy + 0.6); doc.setDrawColor(0); doc.setTextColor(...GREEN); } else doc.text(t, tx, cy); }
    cy += t ? 4.2 : 2.5;
  }
  y = 52;
  font('bold', 15); doc.text(o.number ? `${L.title} № ${o.number}` : L.title, PW / 2, y, { align: 'center' }); y += 6;
  font('bold', 9.5); if (o.customer) doc.text(`${L.to}: ${o.customer}`, M, y);
  font('normal', 9.5); doc.text(offerDMY(o.date), PW - M, y, { align: 'right' }); y += 1.5;
  const header = () => {
    const h = 6.5; doc.setFillColor(...PINK);
    for (let i = 0; i < 4; i++) { doc.rect(cx[i], y, cw[i], h, 'FD'); }
    font('bold', 10.5);
    L.cols.forEach((t, i) => doc.text(t.replace('{cur}', cur), cx[i] + cw[i] / 2, y + 4.6, { align: 'center' }));
    y += h;
  };
  const newPage = () => { doc.addPage(); y = M; header(); };
  header();
  const groups = o.groups || [];
  const showHdr = groups.length > 1 || groups.some(g => (g.items || []).length > 1);
  groups.forEach((g, gi) => {
    const items = g.items || [];
    if (showHdr && g.title) {
      const firstH = items[0] ? rowH(items[0], items.length > 1 ? 0 : -1) : 0;
      if (y + 7 + firstH > BOT) newPage();
      doc.setFillColor(...GREY); doc.rect(M, y, W, 7, 'FD'); font('bold', 10.5); doc.text(`${gi + 1}. ${g.title}`, M + 1.5, y + 4.9); y += 7;
    }
    items.forEach((it, vi) => {
      const pre = items.length > 1 ? `Variant ${String.fromCharCode(65 + vi)}: ` : '';
      const h = rowH(it, items.length > 1 ? vi : -1);
      if (y + h > BOT) newPage();
      for (let i = 0; i < 4; i++) doc.rect(cx[i], y, cw[i], h);
      font('normal', 10); const lines = doc.splitTextToSize(pre + (it.name || ''), textW(it));
      doc.text(lines, cx[0] + 1.2, y + 4.2);
      const im = it.img && A.img && A.img[it.img];
      if (im) { const bh = 19, bw = 42; let w = bw, ih = w * im.h / im.w; if (ih > bh) { ih = bh; w = ih * im.w / im.h; } doc.addImage(im.data, im.fmt || 'JPEG', cx[0] + cw[0] - w - 3, y + (h - ih) / 2, w, ih); }
      const mid = y + h / 2 + 1.3;
      doc.text(String(it.qty ?? ''), cx[1] + cw[1] / 2, mid, { align: 'center' });
      doc.text(it.unit || L.unit, cx[2] + cw[2] / 2, mid, { align: 'center' });
      doc.text(offerMoney(it.price), cx[3] + cw[3] / 2, mid, { align: 'center' });
      y += h;
    });
  });
  function textW(it) { return cw[0] - 2.5 - (it.img && A.img && A.img[it.img] ? 47 : 0); }
  function rowH(it, vi) { font('normal', 10); const pre = vi >= 0 ? 'Variant A: ' : ''; const n = doc.splitTextToSize(pre + (it.name || ''), textW(it)).length; const t = 2.8 + n * 4.3; return Math.max(it.img && A.img && A.img[it.img] ? 22 : 9, t); }
  // şərtlər
  const terms = (o.terms && o.terms.length ? o.terms : L.terms.map(s => s
    .replace('{warranty}', o.warranty || L.d_warranty).replace('{delivery}', o.delivery || L.d_delivery).replace('{place}', o.place || L.d_place)
    .replace('{vat}', o.vat_included === false ? L.vat_ex : L.vat_in).replace('{payment}', o.payment || L.d_payment).replace('{until}', offerUntil(o.date, o.valid_days))))
    .concat(o.extra_terms || []);
  // rekvizitlər həmişə son səhifənin ən altında; imza-möhür şərtlərdən aralı, ortaya yaxın
  const RQH = 3.8 + OFFER_REKV.length * 3.6, RQY = PH - 9 - RQH + 3.6, GAP = 16, SH = 43;
  const tailH = 5 + 5 + terms.length * 4.4 + GAP + SH / 2 + 6;
  if (y + tailH > RQY) { doc.addPage(); y = M; } else y += 5;
  font('bold', 11, GREEN); doc.text(L.terms_h, M, y); y += 5;
  font('normal', 9.5); for (const t of terms) { doc.text('•  ' + t, M + 1, y); y += 4.4; }
  y += GAP; const sy = y;
  font('bold', 10.5); doc.text(`${L.dir}:  ${L.name}`, M, sy);
  const sx = PW / 2 + 20;
  font('normal', 9.5); doc.text(`____________   ${L.seal}`, sx, sy, { align: 'center' });
  if (A.seal) { const h = SH, w = h * A.seal.w / A.seal.h; doc.addImage(A.seal.data, 'PNG', sx - w / 2 - 4, sy - h / 2 - 1, w, h); }
  y = RQY;
  font('bold', 7.5, DIM); doc.text(L.req_h, M, y); y += 3.8;
  font('normal', 7.5, DIM); for (const s of OFFER_REKV) { doc.text(s, M, y); y += 3.6; }
  const n = doc.getNumberOfPages();
  if (n > 1) for (let p = 1; p <= n; p++) { doc.setPage(p); font('normal', 7.5, DIM); doc.text(`${o.number || ''}  ·  ${L.page} ${p}/${n}`, PW - M, PH - 5, { align: 'right' }); }
  return doc;
}
if (typeof module !== 'undefined') module.exports = { buildOfferPDF, OFFER_TXT };
