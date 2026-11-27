/* BS OFİS BÜTÇE V2.4.4 - Aylık kurumsal finans raporu */
(() => {
  if(window.__bsMonthlyReportV244Loaded) return;
  window.__bsMonthlyReportV244Loaded = true;

  const OWNER_ORDER = ['Başak','Süleyman','Kurum Kasası'];
  const EPS = .005;
  const reportMoney = n => new Intl.NumberFormat('tr-TR', {
    style:'currency', currency:'TRY', minimumFractionDigits:2, maximumFractionDigits:2
  }).format(Number(n)||0);
  const reportDate = s => {
    if(!s) return '—';
    const d = typeof parseDate === 'function' ? parseDate(s) : new Date(`${s}T12:00:00`);
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('tr-TR') : String(s);
  };
  const escReport = s => String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[c]));
  const sum = (arr, fn) => arr.reduce((t,x) => t + (Number(fn(x))||0), 0);

  function currentMonth(){
    if(typeof todayISO === 'function') return todayISO().slice(0,7);
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function monthLabel(key){
    const d = new Date(`${key}-01T12:00:00`);
    if(Number.isNaN(d.getTime())) return key;
    const text = d.toLocaleDateString('tr-TR',{month:'long',year:'numeric'});
    return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
  }

  function groupIncomeRows(month){
    const rows = (state?.incomes || [])
      .map(normalizeIncome)
      .filter(x => String(x.date||'').startsWith(month));
    const groups = new Map();

    rows.forEach((x,index) => {
      // Same origin rule as the income screen and cash-flow detail.
      const sourceId = x.sourceRecordId && (x.automatic || x.source) ? x.sourceRecordId : '';
      const key = sourceId ? `bs:${sourceId}` : `manual:${x.id||index}`;
      if(!groups.has(key)){
        groups.set(key, {
          key,
          date:x.date || '',
          createdAt:x.createdAt || '',
          type:x.type || 'Gelir',
          student:x.student || '',
          amount:0,
          source:sourceId ? 'BS Ofis' : 'Manuel',
          owners:Object.create(null),
          rows:[]
        });
      }
      const g = groups.get(key);
      g.rows.push(x);
      g.amount += Number(x.amount)||0;
      if(x.owner) g.owners[x.owner] = (g.owners[x.owner]||0) + (Number(x.amount)||0);
      if((x.createdAt||'') > g.createdAt) g.createdAt = x.createdAt||'';
    });

    return [...groups.values()].sort((a,b) =>
      `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)
    );
  }

  function monthData(month){
    const incomes = groupIncomeRows(month);
    const incomeRaw = (state?.incomes || []).map(normalizeIncome).filter(x => String(x.date||'').startsWith(month));
    const expenses = (state?.expenses || []).map(normalizeExpense).filter(x => String(x.date||'').startsWith(month))
      .sort((a,b) => `${b.date}${b.createdAt||''}`.localeCompare(`${a.date}${a.createdAt||''}`));
    const payments = (state?.payments || []).map(normalizePayment).filter(x => String(x.date||'').startsWith(month))
      .sort((a,b) => `${b.date}${b.createdAt||''}`.localeCompare(`${a.date}${a.createdAt||''}`));
    const debts = new Map((state?.debts || []).map(normalizeDebt).map(d => [d.id,d]));

    const ownerTotals = Object.assign(Object.create(null),Object.fromEntries(OWNER_ORDER.map(owner => [owner,0])));
    incomeRaw.forEach(x => {
      const owner = x.owner || 'Sahip bilgisi yok';
      ownerTotals[owner] = (ownerTotals[owner]||0) + (Number(x.amount)||0);
    });

    const typeTotals = {};
    incomeRaw.forEach(x => { typeTotals[x.type||'Diğer'] = (typeTotals[x.type||'Diğer']||0) + (Number(x.amount)||0); });
    const categoryTotals = {};
    expenses.forEach(x => { categoryTotals[x.category||'Diğer'] = (categoryTotals[x.category||'Diğer']||0) + (Number(x.amount)||0); });

    const incomeTotal = sum(incomeRaw,x=>x.amount);
    const expenseTotal = sum(expenses,x=>x.amount);
    const paymentTotal = sum(payments,x=>x.amount);

    return {
      incomes, incomeRaw, expenses, payments, debts,
      ownerTotals, typeTotals, categoryTotals,
      incomeTotal, expenseTotal, paymentTotal,
      netCash: incomeTotal - expenseTotal - paymentTotal
    };
  }

  function ownerText(g){
    const parts = [...new Set([...OWNER_ORDER,...Object.keys(g.owners)])]
      .filter(owner => Math.abs(g.owners[owner]||0) > EPS)
      .map(owner => `${owner === 'Kurum Kasası' ? 'Kurum' : owner}: ${reportMoney(g.owners[owner])}`);
    return parts.length ? parts.join(' · ') : '—';
  }

  function paymentStatus(p){
    const m = p.custom || {};
    if(m.payment_status === 'partial') return 'Kısmi ödeme';
    if(m.payment_status === 'completed_plus_partial') return 'Taksit ödendi + sonraki taksite aktarıldı';
    if(m.payment_status === 'completed') return 'Taksit ödendi';
    return 'Ödeme';
  }

  function simpleSummaryRows(obj, preferredOrder=[]){
    const keys = [...new Set([...preferredOrder, ...Object.keys(obj)])]
      .filter(k => Math.abs(Number(obj[k])||0) > EPS);
    if(!keys.length) return '<tr><td colspan="2" class="empty">Kayıt yok</td></tr>';
    return keys.map(k => `<tr><td>${escReport(k)}</td><td class="num">${reportMoney(obj[k])}</td></tr>`).join('');
  }

  function reportHtml(month){
    const d = monthData(month);
    const appName = appConfig?.applicationName || 'BS Ofis Bütçe';
    const orgName = state?.budget?.orgName || 'BS Ofis';
    const created = new Date();
    const reportNo = `BSF-${month.replace('-','')}-${String(created.getDate()).padStart(2,'0')}${String(created.getHours()).padStart(2,'0')}${String(created.getMinutes()).padStart(2,'0')}`;
    const logoUrl = new URL('bs-budget-mark-v194.svg?v=195', location.href).href;

    const incomeRows = d.incomes.length ? d.incomes.map(g => `
      <tr>
        <td>${reportDate(g.date)}</td>
        <td>${escReport(g.type)}${g.student ? `<div class="sub">${escReport(g.student)}</div>` : ''}</td>
        <td>${escReport(g.source)}</td>
        <td>${escReport(ownerText(g))}</td>
        <td class="num">${reportMoney(g.amount)}</td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty">Bu ay gelir kaydı yok.</td></tr>';

    const expenseRows = d.expenses.length ? d.expenses.map(x => `
      <tr>
        <td>${reportDate(x.date)}</td>
        <td>${escReport(x.category||'Diğer')}</td>
        <td>${escReport(x.description||'—')}${x.notes ? `<div class="sub">${escReport(x.notes)}</div>` : ''}</td>
        <td>${escReport(x.method||'—')}</td>
        <td class="num">${reportMoney(x.amount)}</td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty">Bu ay gider kaydı yok.</td></tr>';

    const paymentRows = d.payments.length ? d.payments.map(x => {
      const debt = d.debts.get(x.debtId);
      return `
        <tr>
          <td>${reportDate(x.date)}</td>
          <td>${escReport(debt?.name||'Silinmiş borç')}</td>
          <td>${escReport(paymentStatus(x))}</td>
          <td>${escReport(x.notes||'—')}</td>
          <td class="num">${reportMoney(x.amount)}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="5" class="empty">Bu ay borç ödemesi yok.</td></tr>';

    return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escReport(monthLabel(month))} Finans Raporu</title>
<style>
  @page{size:A4;margin:12mm}
  *{box-sizing:border-box}
  body{margin:0;background:#eef2f7;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Arial,sans-serif;font-size:10px;line-height:1.4}
  .toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:flex-end;gap:8px;padding:10px;background:#eef2f7}
  .toolbar button{border:1px solid #cbd5e1;border-radius:9px;background:#fff;padding:8px 12px;font-weight:800;cursor:pointer}
  .toolbar .primary{background:#2563eb;color:#fff;border-color:#2563eb}
  .page{width:210mm;min-height:297mm;margin:0 auto 16px;background:#fff;padding:12mm;box-shadow:0 10px 30px rgba(15,23,42,.08)}
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-bottom:2px solid #2563eb;padding-bottom:12px}
  .brand{display:flex;align-items:center;gap:10px}.brand img{width:42px;height:42px}.brand h1{font-size:17px;margin:0}.brand p{margin:2px 0 0;color:#64748b;font-size:9px;font-weight:700;letter-spacing:.08em}
  .meta{text-align:right;color:#64748b}.meta strong{display:block;color:#0f172a;font-size:12px;margin-bottom:2px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.kpi{border:1px solid #dbe3ef;border-radius:10px;padding:10px}.kpi span{display:block;color:#64748b;font-size:8px;font-weight:800;text-transform:uppercase}.kpi strong{display:block;margin-top:4px;font-size:14px}.kpi.net strong{color:${d.netCash >= 0 ? '#15803d' : '#b91c1c'}}
  h2{font-size:12px;margin:17px 0 7px}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{border:1px solid #dbe3ef;border-radius:10px;padding:8px 10px;break-inside:avoid}
  table{width:100%;border-collapse:collapse}thead{display:table-header-group}th{padding:6px 7px;background:#f8fafc;border-bottom:1px solid #cbd5e1;color:#475569;text-align:left;font-size:8px;text-transform:uppercase}td{padding:6px 7px;border-bottom:1px solid #eef2f7;vertical-align:top}tr{break-inside:avoid}.num{text-align:right;white-space:nowrap;font-weight:800}.sub{margin-top:2px;color:#64748b;font-size:8px}.empty{text-align:center;color:#94a3b8;padding:12px}
  .section{break-inside:auto}.foot{margin-top:16px;padding-top:8px;border-top:1px solid #cbd5e1;color:#64748b;font-size:8px;display:flex;justify-content:space-between;gap:12px}.note{max-width:70%}
  @media print{body{background:#fff}.toolbar{display:none}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}}
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.close()">Kapat</button><button class="primary" onclick="window.print()">PDF / Yazdır</button></div>
<main class="page">
  <header class="head">
    <div class="brand"><img src="${escReport(logoUrl)}" alt="BS" /><div><h1>${escReport(orgName)}</h1><p>${escReport(appName.toLocaleUpperCase('tr-TR'))}</p></div></div>
    <div class="meta"><strong>${escReport(monthLabel(month))} Finans Raporu</strong><div>Rapor No: ${escReport(reportNo)}</div><div>Oluşturma: ${created.toLocaleString('tr-TR')}</div></div>
  </header>
  <section class="kpis">
    <div class="kpi"><span>Toplam Gelir</span><strong>${reportMoney(d.incomeTotal)}</strong></div>
    <div class="kpi"><span>Toplam Gider</span><strong>${reportMoney(d.expenseTotal)}</strong></div>
    <div class="kpi"><span>Borç Ödemeleri</span><strong>${reportMoney(d.paymentTotal)}</strong></div>
    <div class="kpi net"><span>Net Nakit Hareketi</span><strong>${reportMoney(d.netCash)}</strong></div>
  </section>
  <section class="two">
    <div class="box"><h2 style="margin-top:0">Gelir Sahibi Dağılımı</h2><table><tbody>${simpleSummaryRows(d.ownerTotals,OWNER_ORDER)}</tbody></table></div>
    <div class="box"><h2 style="margin-top:0">Gelir Türü Dağılımı</h2><table><tbody>${simpleSummaryRows(d.typeTotals)}</tbody></table></div>
  </section>
  <section class="box" style="margin-top:10px"><h2 style="margin-top:0">Gider Kategori Dağılımı</h2><table><tbody>${simpleSummaryRows(d.categoryTotals)}</tbody></table></section>
  <section class="section"><h2>Gelir Hareketleri</h2><table><thead><tr><th>Tarih</th><th>Gelir</th><th>Kaynak</th><th>Dağılım</th><th class="num">Tutar</th></tr></thead><tbody>${incomeRows}</tbody></table></section>
  <section class="section"><h2>Gider Hareketleri</h2><table><thead><tr><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th>Yöntem</th><th class="num">Tutar</th></tr></thead><tbody>${expenseRows}</tbody></table></section>
  <section class="section"><h2>Borç Ödemeleri</h2><table><thead><tr><th>Tarih</th><th>Borç</th><th>Durum</th><th>Not</th><th class="num">Tutar</th></tr></thead><tbody>${paymentRows}</tbody></table></section>
  <footer class="foot"><div class="note">Bu rapor BS Ofis Bütçe içindeki kayıtlar üzerinden yönetim amaçlı hazırlanmıştır; resmi muhasebe belgesi yerine geçmez.</div><div>${escReport(reportNo)}</div></footer>
</main>
<script>setTimeout(()=>{try{window.print()}catch(e){}},350)<\/script>
</body></html>`;
  }

  function openReport(month){
    if(!/^\d{4}-\d{2}$/.test(month||'')){
      if(typeof toast === 'function') toast('Geçerli bir rapor ayı seçin.');
      return;
    }
    const w = window.open('','_blank');
    if(!w){
      alert('PDF rapor penceresi açılamadı. Tarayıcı açılır pencereye izin vermeli.');
      return;
    }
    w.document.open();
    w.document.write(reportHtml(month));
    w.document.close();
  }

  function ensureStyles(){
    if(document.querySelector('#v244MonthlyReportStyles')) return;
    const style=document.createElement('style');
    style.id='v244MonthlyReportStyles';
    style.textContent=`
      #v244MonthlyReport{margin:12px 0 14px;padding:10px 11px;border:1px solid #dbe3ef;border-radius:16px;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.03);display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:9px}
      #v244MonthlyReport .v244-report-copy{min-width:0}.v244-report-title{margin:0;color:#0f172a;font-size:12px;font-weight:850;white-space:nowrap}.v244-report-eyebrow,.v244-report-copy small{display:none!important}
      #v244MonthlyReport .v244-report-actions{display:flex;align-items:center;gap:6px;min-width:0}#v244MonthlyReport input[type=month]{height:34px;min-width:128px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:0 8px;color:#0f172a;font:700 10px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif}#v244MonthlyReport button{height:34px;border:0;border-radius:10px;padding:0 10px;background:#2563eb;color:#fff;font-size:9.5px;font-weight:850;cursor:pointer;white-space:nowrap}
      @media(max-width:430px){#v244MonthlyReport{grid-template-columns:auto minmax(0,1fr);gap:7px}#v244MonthlyReport .v244-report-title{font-size:10.5px}#v244MonthlyReport .v244-report-actions{justify-content:flex-end}#v244MonthlyReport input[type=month]{min-width:0;width:112px}#v244MonthlyReport button{padding:0 8px}}
    `;
    document.head.appendChild(style);
  }

  function installPanel(){
    const dashboard=document.querySelector('#dashboard');
    const summary=dashboard?.querySelector('.summary-grid');
    if(!dashboard || !summary || document.querySelector('#v244MonthlyReport')) return false;
    ensureStyles();
    const panel=document.createElement('section');
    panel.id='v244MonthlyReport';
    panel.innerHTML=`
      <div class="v244-report-copy">
        <h3 class="v244-report-title">Aylık Finans Raporu</h3>
      </div>
      <div class="v244-report-actions">
        <input id="v244ReportMonth" type="month" aria-label="Rapor ayı" value="${currentMonth()}" />
        <button id="v244CreateReport" type="button">PDF İndir</button>
      </div>`;
    const upcoming=document.querySelector('#upcomingMini');
    if(upcoming) upcoming.insertAdjacentElement('afterend',panel);
    else summary.insertAdjacentElement('afterend',panel);
    panel.querySelector('#v244CreateReport')?.addEventListener('click',()=>{
      openReport(panel.querySelector('#v244ReportMonth')?.value || currentMonth());
    });
    return true;
  }

  function install(){
    if(installPanel()) return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(installPanel() || tries>50) clearInterval(timer);
    },100);
  }

  install();
})();
