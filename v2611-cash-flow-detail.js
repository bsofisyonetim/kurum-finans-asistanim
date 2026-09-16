/* BS OFİS BÜTÇE V2.6.1.1 - Gerçekleşen net nakit akışı detayı
   Yalnız sunum/navigasyon katmanı; finans hesaplama ve veri yazma mantığını değiştirmez. */
(() => {
  if(window.__bsCashFlowDetailV2611Loaded) return;
  window.__bsCashFlowDetailV2611Loaded = true;

  const currentMonth = () => monthKey();

  function ensureStyles(){
    if(document.querySelector('#v2611CashFlowStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2611CashFlowStyles';
    style.textContent = `
      #v177BalanceCard.v2611-open{cursor:pointer;transition:.15s ease;-webkit-tap-highlight-color:transparent}
      #v177BalanceCard.v2611-open:hover{border-color:#CBD5E1;box-shadow:0 6px 18px rgba(15,23,42,.07)}
      #v177BalanceCard.v2611-open:active{transform:scale(.992)}
      #v177BalanceCard.v2611-open:focus-visible{outline:2px solid #93B4FF;outline-offset:2px}
      #detailDialog .v2611-detail{width:min(680px,calc(100vw - 28px));max-height:min(82vh,780px);overflow:auto}
      .v2611-detail .dialog-head{position:sticky;top:0;z-index:3;padding-bottom:10px;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
      .v2611-month{width:100%;min-height:44px;margin:2px 0 10px;padding:9px 34px 9px 12px;border:1px solid #D8E1EC;border-radius:12px;background:#fff;color:#334155;font-weight:760}
      .v2611-hero{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 16px;border:1px solid #E2E8F0;border-radius:16px;background:#fff;box-shadow:0 3px 12px rgba(15,23,42,.04)}
      .v2611-hero-copy{display:grid;gap:4px;min-width:0}.v2611-hero-copy span{color:#64748B;font-size:10px;font-weight:830;letter-spacing:.045em}
      .v2611-hero-copy strong{color:#15803D;font-size:26px;line-height:1.04;font-weight:880;letter-spacing:-.035em}.v2611-hero.negative .v2611-hero-copy strong{color:#DC2626}
      .v2611-status{padding:6px 9px;border-radius:999px;background:#ECFDF5;color:#15803D;font-size:9px;font-weight:850}.v2611-hero.negative .v2611-status{background:#FEF2F2;color:#DC2626}
      .v2611-breakdown{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}.v2611-breakdown>div{min-width:0;padding:10px 11px;border:1px solid #E2E8F0;border-radius:13px;background:#F8FAFC}
      .v2611-breakdown span{display:block;color:#64748B;font-size:8px;font-weight:830;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v2611-breakdown strong{display:block;margin-top:4px;color:#0F172A;font-size:14px;font-weight:860;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v2611-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:16px 2px 8px}.v2611-head strong{color:#0F172A;font-size:13px;font-weight:850}.v2611-head small{color:#94A3B8;font-size:9px;font-weight:760}
      .v2611-list{display:grid;gap:7px}.v2611-row{appearance:none;width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;min-height:58px;padding:10px 11px;border:1px solid #E2E8F0;border-radius:13px;background:#fff;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .v2611-row:hover{border-color:#CBD5E1;background:#FAFCFF}.v2611-row:active{transform:scale(.993)}.v2611-row:focus-visible{outline:2px solid #93B4FF;outline-offset:1px}
      .v2611-dot{width:8px;height:8px;border-radius:50%;background:#94A3B8;box-shadow:0 0 0 4px #F1F5F9}.v2611-row.income .v2611-dot{background:#22C55E;box-shadow:0 0 0 4px #F0FDF4}.v2611-row.payment .v2611-dot{background:#F59E0B;box-shadow:0 0 0 4px #FFFBEB}.v2611-row.expense .v2611-dot{background:#EF4444;box-shadow:0 0 0 4px #FEF2F2}
      .v2611-main{display:grid;gap:3px;min-width:0}.v2611-main strong{color:#0F172A;font-size:11.5px;font-weight:820;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v2611-main small{color:#7C8AA0;font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v2611-amount{color:#0F172A;font-size:12.5px;font-weight:870;white-space:nowrap}.v2611-sign{font-weight:900}.v2611-row.income .v2611-sign{color:#16A34A}.v2611-row.payment .v2611-sign{color:#D97706}.v2611-row.expense .v2611-sign{color:#DC2626}
      .v2611-empty{padding:18px 14px;border:1px dashed #D8E1EC;border-radius:13px;color:#64748B;background:#F8FAFC;text-align:center;font-size:10px}
      @media(max-width:520px){#detailDialog .v2611-detail{width:calc(100vw - 20px);max-height:84vh}.v2611-hero-copy strong{font-size:23px}.v2611-breakdown{gap:5px}.v2611-breakdown>div{padding:9px 8px}.v2611-breakdown strong{font-size:12px}.v2611-row{padding:10px}.v2611-amount{font-size:12px}}
    `;
    document.head.appendChild(style);
  }

  function monthLabel(value){
    const [y,m] = String(value || currentMonth()).split('-');
    return new Date(+y,+m-1,1).toLocaleDateString('tr-TR',{month:'long',year:'numeric'});
  }

  function months(){
    const set = new Set([currentMonth()]);
    [state.incomes,state.payments,state.expenses].forEach(rows => (rows || []).forEach(row => {
      const date = row?.date || row?.tarih || row?.gelir_tarihi || '';
      if(/^\d{4}-\d{2}/.test(String(date))) set.add(String(date).slice(0,7));
    }));
    return [...set].sort().reverse();
  }

  function groupedIncomes(rows){
    const groups = new Map();
    rows.forEach(row => {
      const bs = !!(row.sourceRecordId && (row.automatic || row.source));
      const key = bs ? `bs:${row.sourceRecordId}` : `manual:${row.id}`;
      if(!groups.has(key)) groups.set(key,{kind:'income',id:row.id,date:row.date,createdAt:row.createdAt||'',amount:0,type:row.type||'Gelir',student:row.student||'',owners:[]});
      const g = groups.get(key);
      g.amount += Number(row.amount)||0;
      if(row.owner && !g.owners.includes(row.owner)) g.owners.push(row.owner);
      if((row.createdAt||'')>g.createdAt) g.createdAt=row.createdAt||'';
      if(!g.student && row.student) g.student=row.student;
    });
    return [...groups.values()].map(g => ({...g,title:g.type==='Özel Ders'&&g.student?`Özel Ders · ${g.student}`:g.type,subtitle:g.owners.length?`Gelir · ${g.owners.map(x=>x==='Kurum Kasası'?'Kurum':x).join(' + ')}`:'Gelir'}));
  }

  function dataFor(month){
    const incomes = state.incomes.map(normalizeIncome).filter(x=>x.date?.startsWith(month));
    const payments = state.payments.map(normalizePayment).filter(x=>x.date?.startsWith(month));
    const expenses = state.expenses.map(normalizeExpense).filter(x=>x.date?.startsWith(month));
    const incomeTotal=incomes.reduce((s,x)=>s+(+x.amount||0),0), paymentTotal=payments.reduce((s,x)=>s+(+x.amount||0),0), expenseTotal=expenses.reduce((s,x)=>s+(+x.amount||0),0);
    const debts = new Map(state.debts.map(normalizeDebt).map(x=>[String(x.id),x]));
    const movements=[
      ...groupedIncomes(incomes),
      ...payments.map(x=>({kind:'payment',id:x.id,date:x.date,createdAt:x.createdAt||'',amount:+x.amount||0,title:debts.get(String(x.debtId))?.name||'Borç ödemesi',subtitle:'Borç ödemesi'})),
      ...expenses.map(x=>({kind:'expense',id:x.id,date:x.date,createdAt:x.createdAt||'',amount:+x.amount||0,title:x.description||x.category||'Harcama',subtitle:x.category?`Harcama · ${x.category}`:'Harcama'}))
    ].sort((a,b)=>`${b.date||''}${b.createdAt||''}`.localeCompare(`${a.date||''}${a.createdAt||''}`));
    return {incomeTotal,paymentTotal,expenseTotal,net:incomeTotal-paymentTotal-expenseTotal,movements};
  }

  function rowHtml(item){
    const date=item.date?parseDate(item.date).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}):'—';
    const sign=item.kind==='income'?'+':'−';
    return `<button type="button" class="v2611-row ${esc(item.kind)}" data-v2611-kind="${esc(item.kind)}" data-v2611-id="${esc(item.id)}" aria-label="${esc(item.title)} detayını aç"><span class="v2611-dot" aria-hidden="true"></span><span class="v2611-main"><strong>${esc(item.title)}</strong><small>${esc(date)} · ${esc(item.subtitle)}</small></span><span class="v2611-amount"><span class="v2611-sign">${sign}</span>${money(item.amount)}</span></button>`;
  }

  function render(month=currentMonth()){
    const dialog=document.querySelector('#detailDialog'), content=document.querySelector('#detailContent');
    if(!dialog||!content) return;
    const data=dataFor(month), positive=data.net>=0;
    content.className='dialog-form v2611-detail';
    content.innerHTML=`
      <div class="dialog-head"><div><p class="eyebrow">NAKİT AKIŞI</p><h3>${esc(monthLabel(month))}</h3></div><button type="button" class="icon-btn close-detail" aria-label="Kapat">×</button></div>
      <select id="v2611CashMonth" class="v2611-month" aria-label="Nakit akışı ayı">${months().map(v=>`<option value="${esc(v)}" ${v===month?'selected':''}>${esc(monthLabel(v))}</option>`).join('')}</select>
      <section class="v2611-hero ${positive?'positive':'negative'}"><div class="v2611-hero-copy"><span>GERÇEKLEŞEN NET NAKİT</span><strong>${money(data.net)}</strong></div><span class="v2611-status">${positive?'POZİTİF':'AÇIK'}</span></section>
      <div class="v2611-breakdown"><div><span>GELİR</span><strong>+${money(data.incomeTotal)}</strong></div><div><span>BORÇ ÖDEMESİ</span><strong>−${money(data.paymentTotal)}</strong></div><div><span>HARCAMA</span><strong>−${money(data.expenseTotal)}</strong></div></div>
      <div class="v2611-head"><strong>Ayın Hareketleri</strong><small>${data.movements.length} hareket</small></div>
      <div class="v2611-list">${data.movements.length?data.movements.map(rowHtml).join(''):'<div class="v2611-empty">Bu ay gerçekleşmiş nakit hareketi bulunmuyor.</div>'}</div>`;
    content.querySelector('#v2611CashMonth').onchange=e=>render(e.target.value||currentMonth());
    if(!dialog.open) dialog.showModal();
  }

  function openMovement(kind,id){
    const dialog=document.querySelector('#detailDialog');
    if(dialog?.open) dialog.close();
    setTimeout(()=>{
      if(kind==='income'){
        const row=state.incomes.map(normalizeIncome).find(x=>String(x.id)===String(id));
        if(row&&typeof openIncomeDialog==='function') openIncomeDialog(row);
      }else if(kind==='payment'){
        const row=state.payments.map(normalizePayment).find(x=>String(x.id)===String(id));
        if(row&&typeof showDetail==='function') showDetail('payments',row);
      }else if(kind==='expense'){
        const row=state.expenses.map(normalizeExpense).find(x=>String(x.id)===String(id));
        if(row&&typeof showDetail==='function') showDetail('expenses',row);
      }
    },0);
  }

  function bind(){
    const card=document.querySelector('#v177BalanceCard'), content=document.querySelector('#detailContent');
    if(card&&card.dataset.v2611Bound!=='1'){
      card.dataset.v2611Bound='1';card.classList.add('v2611-open');card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label','Bu ay gerçekleşen net nakit akışı detayını aç');
      card.addEventListener('click',()=>render());
      card.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();render();}});
    }
    if(content&&content.dataset.v2611Bound!=='1'){
      content.dataset.v2611Bound='1';
      content.addEventListener('click',e=>{const row=e.target.closest('[data-v2611-kind][data-v2611-id]');if(!row)return;e.preventDefault();e.stopPropagation();openMovement(row.dataset.v2611Kind,row.dataset.v2611Id);});
    }
  }

  ensureStyles();
  bind();
  window.bsOpenCashFlowDetailV2611=render;
})();
