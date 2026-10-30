/* Word (docx) → PDF brauzerdə: docx-preview ilə göstər, html2canvas ilə şəkil, A4 səhifələrə böl (abzas/sətir sərhədlərində). */
async function docxToPdf(buf, jsPDF) {
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-12000px;top:0;background:#fff'; document.body.append(host);
  try {
    await docx.renderAsync(buf, host, null, { className: 'dx', inWrapper: false, breakPages: false, ignoreLastRenderedPageBreak: true, experimental: true, useBase64URL: true });
    if (document.fonts) await document.fonts.ready;
    const sec = host.querySelector('section.dx'); const cs = getComputedStyle(sec);
    const W = sec.getBoundingClientRect().width, k = W / 210;
    const mT = parseFloat(cs.paddingTop) / k, mB = parseFloat(cs.paddingBottom) / k;
    sec.style.paddingTop = '0'; sec.style.paddingBottom = '0'; sec.style.minHeight = '0';
    const top = sec.getBoundingClientRect().top, H = sec.getBoundingClientRect().height;
    const cuts = [...sec.querySelectorAll('p, tr, table')].filter(e => !e.closest('tr') || e.tagName === 'TR').map(e => e.getBoundingClientRect().bottom - top).filter(v => v > 0).sort((a, b) => a - b);
    // başlıqdan (qalın, mərkəzdə) dərhal sonra kəsmə: başlıq növbəti abzasla qalsın
    const heads = new Set([...sec.querySelectorAll('p')].filter(p => !p.closest('table') && getComputedStyle(p).textAlign === 'center' && p.innerText.trim() && [...p.querySelectorAll('span')].every(x => +getComputedStyle(x).fontWeight >= 600)).map(p => Math.round(p.getBoundingClientRect().bottom - top)));
    // birlikdə qalmalı sətirlər (cantSplit) — tr daxilindəki p-lərdə kəsmə
    const S = 2, cv = await html2canvas(sec, { scale: S, backgroundColor: '#fff', windowWidth: W + 50 });
    const pageH = (297 - mT - mB) * k;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    let s = 0, n = 0;
    while (s < H - 2) {
      let e = s + pageH;
      if (e < H) { const c = cuts.filter(v => v > s + 40 && v <= e && !heads.has(Math.round(v))); if (c.length) e = c[c.length - 1]; } else e = H;
      const hpx = Math.round((e - s) * S), pc = document.createElement('canvas'); pc.width = cv.width; pc.height = hpx;
      const g = pc.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, pc.width, hpx); g.drawImage(cv, 0, Math.round(s * S), cv.width, hpx, 0, 0, cv.width, hpx);
      if (n++) pdf.addPage();
      pdf.addImage(pc.toDataURL('image/jpeg', 0.82), 'JPEG', 0, mT, 210, (e - s) / k);
      s = e;
    }
    return pdf;
  } finally { host.remove(); }
}
