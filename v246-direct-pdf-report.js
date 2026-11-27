/* BS OFIS BUTCE V2.4.6 - Dogrudan kurumsal PDF uretimi */
(() => {
  if(window.__bsDirectPdfReportV246Loaded) return;
  window.__bsDirectPdfReportV246Loaded = true;

  const OWNER_ORDER = ['Başak','Süleyman','Kurum Kasası'];
  const EPS = 0.005;
  const PDFMAKE_SRC = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js';
  const VFS_SRC = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js';
  let offerPrintFallback = false;
  let reportBusy = false;
  const libraryLoads = new Map();

  const money = n => new Intl.NumberFormat('tr-TR', {
    style:'currency', currency:'TRY', minimumFractionDigits:2, maximumFractionDigits:2
  }).format(Number(n)||0);
  const sum = (arr, fn) => arr.reduce((total,item) => total + (Number(fn(item))||0), 0);

  function reportDate(value){
    if(!value) return '—';
    const d = typeof parseDate === 'function' ? parseDate(value) : new Date(`${value}T12:00:00`);
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('tr-TR') : String(value);
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
          owners:Object.create(null)
        });
      }
      const g = groups.get(key);
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
    const incomeRaw = (state?.incomes || []).map(normalizeIncome)
      .filter(x => String(x.date||'').startsWith(month));
    const expenses = (state?.expenses || []).map(normalizeExpense)
      .filter(x => String(x.date||'').startsWith(month))
      .sort((a,b) => `${b.date}${b.createdAt||''}`.localeCompare(`${a.date}${a.createdAt||''}`));
    const payments = (state?.payments || []).map(normalizePayment)
      .filter(x => String(x.date||'').startsWith(month))
      .sort((a,b) => `${b.date}${b.createdAt||''}`.localeCompare(`${a.date}${a.createdAt||''}`));
    const debts = new Map((state?.debts || []).map(normalizeDebt).map(d => [d.id,d]));

    const ownerTotals = Object.assign(Object.create(null),Object.fromEntries(OWNER_ORDER.map(owner => [owner,0])));
    incomeRaw.forEach(x => {
      const owner = x.owner || 'Sahip bilgisi yok';
      ownerTotals[owner] = (ownerTotals[owner]||0) + (Number(x.amount)||0);
    });

    const typeTotals = {};
    incomeRaw.forEach(x => {
      const key = x.type || 'Diğer';
      typeTotals[key] = (typeTotals[key]||0) + (Number(x.amount)||0);
    });

    const categoryTotals = {};
    expenses.forEach(x => {
      const key = x.category || 'Diğer';
      categoryTotals[key] = (categoryTotals[key]||0) + (Number(x.amount)||0);
    });

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

  function ownerText(group){
    const parts = [...new Set([...OWNER_ORDER,...Object.keys(group.owners)])]
      .filter(owner => Math.abs(group.owners[owner]||0) > EPS)
      .map(owner => `${owner === 'Kurum Kasası' ? 'Kurum' : owner}: ${money(group.owners[owner])}`);
    return parts.length ? parts.join(' · ') : '—';
  }

  function paymentStatus(payment){
    const meta = payment.custom || {};
    if(meta.payment_status === 'partial') return 'Kısmi ödeme';
    if(meta.payment_status === 'completed_plus_partial') return 'Taksit ödendi + sonraki taksite aktarıldı';
    if(meta.payment_status === 'completed') return 'Taksit ödendi';
    return 'Ödeme';
  }

  function loadScript(src, marker){
    if(libraryLoads.has(marker)) return libraryLoads.get(marker);
    const selector = `script[data-bs-v246-lib="${marker}"]`;
    const existing = document.querySelector(selector);
    if(existing?.dataset.loaded === '1') return Promise.resolve();
    if(existing) existing.remove();

    const pending = new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.bsV246Lib = marker;
      let settled = false;
      const finish = error => {
        if(settled) return;
        settled = true;
        clearTimeout(timer);
        if(error){
          script.remove();
          reject(error);
        }else{
          script.dataset.loaded = '1';
          resolve();
        }
      };
      const timer = setTimeout(()=>finish(new Error(`${marker} yükleme zaman aşımı`)),12000);
      script.addEventListener('load',()=>finish(null),{once:true});
      script.addEventListener('error',()=>finish(new Error(`${marker} yüklenemedi`)),{once:true});
      document.head.appendChild(script);
    });
    libraryLoads.set(marker,pending);
    pending.catch(()=>{if(libraryLoads.get(marker)===pending) libraryLoads.delete(marker);});
    return pending;
  }

  async function ensurePdfMake(){
    if(!window.pdfMake?.createPdf){
      await loadScript(PDFMAKE_SRC,'pdfmake');
    }
    if(!window.pdfMake?.vfs){
      await loadScript(VFS_SRC,'vfs-fonts');
    }
    if(!window.pdfMake?.createPdf){
      throw new Error('PDF motoru hazırlanamadı.');
    }
    return window.pdfMake;
  }

  async function loadLogoSvg(){
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),5000);
    try{
      const response = await fetch('./bs-budget-mark-v194.svg?v=195',{cache:'force-cache',signal:controller.signal});
      if(!response.ok) return '';
      const svg = await response.text();
      return /<svg[\s>]/i.test(svg) ? svg : '';
    }catch(_error){
      return '';
    }finally{
      clearTimeout(timer);
    }
  }

  function summaryTable(title, totals, preferred=[]){
    const keys = [...new Set([...preferred, ...Object.keys(totals)])]
      .filter(k => Math.abs(Number(totals[k])||0) > EPS);
    const body = keys.length
      ? keys.map(key => [
          {text:key, margin:[0,2,0,2]},
          {text:money(totals[key]), alignment:'right', bold:true, margin:[0,2,0,2]}
        ])
      : [[{text:'Kayıt yok', colSpan:2, color:'#94A3B8', alignment:'center'},{}]];

    return {
      stack:[
        {text:title, style:'boxTitle'},
        {
          table:{widths:['*','auto'], body},
          layout:{
            hLineWidth:(i,node)=> i===0 || i===node.table.body.length ? 0 : 0.5,
            vLineWidth:()=>0,
            hLineColor:()=> '#E2E8F0',
            paddingLeft:()=>6,
            paddingRight:()=>6,
            paddingTop:()=>2,
            paddingBottom:()=>2
          }
        }
      ],
      margin:[0,0,0,0]
    };
  }

  function headerCell(text, alignment='left'){
    return {text, bold:true, color:'#475569', fillColor:'#F8FAFC', fontSize:7, alignment, margin:[0,2,0,2]};
  }

  function buildDocument(month, logoSvg){
    const d = monthData(month);
    const created = new Date();
    const reportNo = `BSF-${month.replace('-','')}-${String(created.getDate()).padStart(2,'0')}${String(created.getHours()).padStart(2,'0')}${String(created.getMinutes()).padStart(2,'0')}`;
    const appName = appConfig?.applicationName || 'BS Ofis Bütçe';
    const orgName = state?.budget?.orgName || 'Finans Yönetimi';

    const headerBrand = logoSvg
      ? {
          columns:[
            {width:38, svg:logoSvg, fit:[34,34], margin:[0,0,8,0]},
            {width:'*', stack:[
              {text:orgName, fontSize:15, bold:true, color:'#0F172A'},
              {text:appName.toLocaleUpperCase('tr-TR'), fontSize:7, bold:true, color:'#64748B', characterSpacing:1.2, margin:[0,2,0,0]}
            ]}
          ]
        }
      : {
          stack:[
            {text:orgName, fontSize:15, bold:true, color:'#0F172A'},
            {text:appName.toLocaleUpperCase('tr-TR'), fontSize:7, bold:true, color:'#64748B', characterSpacing:1.2, margin:[0,2,0,0]}
          ]
        };

    const incomeRows = d.incomes.map(g => [
      {text:reportDate(g.date)},
      {
        stack:[
          {text:g.type || 'Gelir'},
          ...(g.student ? [{text:g.student, fontSize:6.5, color:'#64748B', margin:[0,1,0,0]}] : [])
        ]
      },
      {text:g.source},
      {text:ownerText(g), fontSize:7.2},
      {text:money(g.amount), alignment:'right', bold:true}
    ]);

    const expenseRows = d.expenses.map(x => [
      {text:reportDate(x.date)},
      {text:x.category || 'Diğer'},
      {
        stack:[
          {text:x.description || '—'},
          ...(x.notes ? [{text:x.notes, fontSize:6.5, color:'#64748B', margin:[0,1,0,0]}] : [])
        ]
      },
      {text:x.method || '—'},
      {text:money(x.amount), alignment:'right', bold:true}
    ]);

    const paymentRows = d.payments.map(x => {
      const debt = d.debts.get(x.debtId);
      return [
        {text:reportDate(x.date)},
        {text:debt?.name || 'Silinmiş borç'},
        {text:paymentStatus(x)},
        {text:x.notes || '—'},
        {text:money(x.amount), alignment:'right', bold:true}
      ];
    });

    const standardTableLayout = {
      hLineWidth:(i,node)=> i===0 || i===1 || i===node.table.body.length ? 0.7 : 0.35,
      vLineWidth:()=>0,
      hLineColor:(i)=> i<=1 ? '#CBD5E1' : '#E2E8F0',
      paddingLeft:()=>5,
      paddingRight:()=>5,
      paddingTop:()=>4,
      paddingBottom:()=>4
    };

    const section = (title, widths, headers, rows, emptyText) => ({
      stack:[
        {text:title, style:'sectionTitle', headlineLevel:1},
        {
          table:{
            headerRows:1,
            keepWithHeaderRows:1,
            dontBreakRows:true,
            widths,
            body:[headers, ...(rows.length ? rows : [[{text:emptyText,colSpan:headers.length,alignment:'center',color:'#94A3B8',margin:[0,6,0,6]}, ...headers.slice(1).map(()=>({}))]])]
          },
          layout:standardTableLayout
        }
      ],
      margin:[0,0,0,0]
    });

    return {
      pageSize:'A4',
      pageMargins:[32,32,32,32],
      info:{
        title:`${monthLabel(month)} Finans Raporu`,
        author:'BS Ofis Bütçe',
        subject:'Aylık kurumsal finans raporu',
        keywords:'finans, gelir, gider, borç ödemeleri'
      },
      defaultStyle:{font:'Roboto',fontSize:8,color:'#0F172A'},
      styles:{
        sectionTitle:{fontSize:10.5,bold:true,color:'#0F172A',margin:[0,14,0,5]},
        boxTitle:{fontSize:9.5,bold:true,color:'#0F172A',margin:[6,6,6,4]},
        kpiLabel:{fontSize:6.5,bold:true,color:'#64748B',characterSpacing:0.3},
        kpiValue:{fontSize:11.5,bold:true,color:'#0F172A',margin:[0,4,0,0]}
      },
      footer:(currentPage,pageCount) => ({
        margin:[32,5,32,0],
        columns:[
          {text:'BS Ofis Bütçe - Yönetim Raporu',fontSize:6,color:'#94A3B8'},
          {text:`${reportNo} · Sayfa ${currentPage} / ${pageCount}`,alignment:'right',fontSize:6,color:'#94A3B8'}
        ]
      }),
      pageBreakBefore:(currentNode, followingNodesOnPage) =>
        currentNode.headlineLevel === 1 && followingNodesOnPage.length === 0,
      content:[
        {
          columns:[
            {width:'55%',...headerBrand},
            {width:'45%',alignment:'right',stack:[
              {text:`${monthLabel(month)} Finans Raporu`,fontSize:12.5,bold:true},
              {text:`Rapor No: ${reportNo}`,fontSize:7,color:'#64748B',margin:[0,3,0,0]},
              {text:`Oluşturma: ${created.toLocaleString('tr-TR')}`,fontSize:7,color:'#64748B',margin:[0,2,0,0]}
            ]}
          ]
        },
        {canvas:[{type:'line',x1:0,y1:8,x2:531,y2:8,lineWidth:1.5,lineColor:'#2563EB'}],margin:[0,0,0,12]},
        {
          table:{
            widths:['*','*','*','*'],
            body:[[
              {stack:[{text:'TOPLAM GELİR',style:'kpiLabel'},{text:money(d.incomeTotal),style:'kpiValue'}],margin:[6,7,6,7]},
              {stack:[{text:'TOPLAM GİDER',style:'kpiLabel'},{text:money(d.expenseTotal),style:'kpiValue'}],margin:[6,7,6,7]},
              {stack:[{text:'BORÇ ÖDEMELERİ',style:'kpiLabel'},{text:money(d.paymentTotal),style:'kpiValue'}],margin:[6,7,6,7]},
              {stack:[{text:'NET NAKİT HAREKETİ',style:'kpiLabel'},{text:money(d.netCash),style:'kpiValue',color:d.netCash>=0?'#15803D':'#B91C1C'}],margin:[6,7,6,7]}
            ]]
          },
          layout:{
            hLineWidth:()=>0.7,
            vLineWidth:()=>0.7,
            hLineColor:()=> '#DBE3EF',
            vLineColor:()=> '#DBE3EF',
            paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0
          }
        },
        {
          columns:[
            {width:'50%',...summaryTable('Gelir Sahibi Dağılımı',d.ownerTotals,OWNER_ORDER)},
            {width:'50%',...summaryTable('Gelir Türü Dağılımı',d.typeTotals)}
          ],
          columnGap:10,
          margin:[0,10,0,0]
        },
        {margin:[0,10,0,0],...summaryTable('Gider Kategori Dağılımı',d.categoryTotals)},
        section(
          'Gelir Hareketleri',
          [58,82,58,'*',74],
          [headerCell('Tarih'),headerCell('Gelir'),headerCell('Kaynak'),headerCell('Dağılım'),headerCell('Tutar','right')],
          incomeRows,
          'Bu ay gelir kaydı yok.'
        ),
        section(
          'Gider Hareketleri',
          [58,72,'*',64,74],
          [headerCell('Tarih'),headerCell('Kategori'),headerCell('Açıklama'),headerCell('Yöntem'),headerCell('Tutar','right')],
          expenseRows,
          'Bu ay gider kaydı yok.'
        ),
        section(
          'Borç Ödemeleri',
          [58,150,90,'*',74],
          [headerCell('Tarih'),headerCell('Borç'),headerCell('Durum'),headerCell('Not'),headerCell('Tutar','right')],
          paymentRows,
          'Bu ay borç ödemesi yok.'
        ),
        {
          margin:[0,12,0,0],
          canvas:[{type:'line',x1:0,y1:0,x2:531,y2:0,lineWidth:0.6,lineColor:'#CBD5E1'}]
        },
        {
          columns:[
            {width:'75%',text:'Bu rapor BS Ofis Bütçe içindeki kayıtlar üzerinden yönetim amaçlı hazırlanmıştır; resmi muhasebe belgesi yerine geçmez.',fontSize:6.5,color:'#64748B',margin:[0,5,0,0]},
            {width:'25%',text:reportNo,alignment:'right',fontSize:6.5,color:'#64748B',margin:[0,5,0,0]}
          ]
        }
      ]
    };
  }

  function setButtonState(button,busy){
    if(!button) return;
    button.disabled = !!busy;
    button.setAttribute('aria-busy',busy?'true':'false');
    button.textContent = busy ? 'PDF hazırlanıyor…' : offerPrintFallback ? 'Yazdır / PDF' : 'PDF Rapor İndir';
  }

  function downloadPdf(pdfMake,doc,filename){
    return new Promise((resolve,reject)=>{
      let settled = false;
      const finish = error => {
        if(settled) return;
        settled = true;
        clearTimeout(timer);
        error ? reject(error) : resolve();
      };
      const timer = setTimeout(()=>finish(new Error('PDF üretimi zaman aşımına uğradı.')),45000);
      try{
        // pdfmake 0.2 uses a completion callback, not a Promise.
        pdfMake.createPdf(doc).download(filename,()=>finish(null));
      }catch(error){
        finish(error);
      }
    });
  }

  async function generatePdf(month, button){
    if(reportBusy) return;
    reportBusy = true;
    offerPrintFallback = false;
    setButtonState(button,true);
    try{
      const [pdfMake,logoSvg] = await Promise.all([ensurePdfMake(),loadLogoSvg()]);
      const doc = buildDocument(month,logoSvg);
      const filename = `${monthLabel(month)} Finans Raporu.pdf`;
      await downloadPdf(pdfMake,doc,filename);
      if(typeof toast === 'function') toast('PDF hazır; indirme tarayıcıya iletildi.');
    }catch(error){
      console.error('V246 PDF üretim hatası',error);
      offerPrintFallback = true;
      if(typeof toast === 'function') toast('PDF oluşturulamadı. Alternatif rapor için Yazdır / PDF düğmesine dokunun.');
    }finally{
      reportBusy = false;
      setButtonState(button,false);
    }
  }

  document.addEventListener('click',event => {
    const button = event.target?.closest?.('#v244CreateReport');
    if(!button) return;
    if(offerPrintFallback && !reportBusy){
      // The next real click supplies browser user activation for window.open.
      offerPrintFallback = false;
      setButtonState(button,false);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if(reportBusy) return;

    const month = document.querySelector('#v244ReportMonth')?.value || '';
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){
      if(typeof toast === 'function') toast('Geçerli bir rapor ayı seçin.');
      return;
    }
    generatePdf(month,button);
  },true);

  function patchPanel(){
    const button = document.querySelector('#v244CreateReport');
    const hint = document.querySelector('#v244MonthlyReport .v244-report-copy small');
    if(button) setButtonState(button,false);
    if(hint) hint.textContent = 'Gelir, gider, borç ödemeleri ve gelir dağılımını doğrudan temiz A4 PDF dosyası olarak üretir.';
    return !!button;
  }

  if(!patchPanel()){
    let tries = 0;
    const timer = setInterval(()=>{
      tries++;
      if(patchPanel() || tries>60) clearInterval(timer);
    },100);
  }
})();
