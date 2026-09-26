/* BS OFİS BÜTÇE V2.7.3 - Çoklu gecikmiş taksit görünümü
   Yalnızca Borçlar ekranındaki kart sunumunu zenginleştirir.
   Borç/ödeme verisini, taksit motorunu, Supabase yazımını ve V259.7 aylık filtre mantığını değiştirmez. */
(() => {
  if(window.__bsDebtCardStatusV2598Loaded) return;
  window.__bsDebtCardStatusV2598Loaded = true;

  const EPS = .005;
  const roundMoney = n => Math.round((+n || 0) * 100) / 100;

  function remainingAmount(raw){
    const d = normalizeDebt(raw);
    if(d.status !== 'active') return 0;

    if(typeof window.currentInstallmentRemaining === 'function'){
      try{
        return Math.max(0, roundMoney(window.currentInstallmentRemaining(d)));
      }catch(_error){}
    }

    const paid = Math.max(0, +(d.custom?.current_installment_paid || 0));
    return Math.max(0, roundMoney((+d.minimum || 0) - paid));
  }

  function isFixedDebt(raw){
    const d = normalizeDebt(raw);
    return String(d.custom?.odeme_yapisi || 'Sabit').trim() !== 'Değişken';
  }

  function installmentRows(raw){
    if(!isFixedDebt(raw)) return [];

    if(typeof window.bsDebtInstallmentPlan === 'function'){
      try{
        const rows = window.bsDebtInstallmentPlan(raw);
        if(Array.isArray(rows) && rows.length){
          return rows
            .map(row => ({
              date:String(row?.date || ''),
              amount:Math.max(0,roundMoney(row?.amount ?? row?.planned ?? 0))
            }))
            .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.amount > EPS)
            .sort((a,b) => a.date.localeCompare(b.date));
        }
      }catch(_error){}
    }

    const d = normalizeDebt(raw);
    if(!d.dueDate) return [];
    const amount = remainingAmount(d);
    return amount > EPS ? [{date:d.dueDate,amount}] : [];
  }

  function overdueSummary(raw){
    const d = normalizeDebt(raw);
    if(d.status !== 'active' || !isFixedDebt(d)){
      return {count:0,total:0,oldestDays:0,oldestDate:'',rows:[]};
    }

    const todayIso = todayISO();
    const today = parseDate(todayIso);
    const rows = installmentRows(d).filter(row => row.date < todayIso);
    if(!rows.length || !today){
      return {count:0,total:0,oldestDays:0,oldestDate:'',rows:[]};
    }

    const oldestDate = rows[0].date;
    const oldestDays = Math.max(1,Math.abs(Math.round((parseDate(oldestDate)-today)/86400000)));
    const total = roundMoney(rows.reduce((sum,row) => sum + row.amount,0));

    return {
      count:rows.length,
      total,
      oldestDays,
      oldestDate,
      rows
    };
  }

  window.bsDebtOverdueSummary = overdueSummary;

  function dueState(raw){
    const d = normalizeDebt(raw);
    if(d.status === 'closed') return {label:'Kapandı', kind:'closed', overdue:overdueSummary(d)};
    if(!d.dueDate) return {label:'Vade yok', kind:'neutral', overdue:overdueSummary(d)};

    const overdue = overdueSummary(d);
    if(overdue.count > 1){
      return {
        label:`${overdue.count} taksit gecikti`,
        kind:'overdue',
        overdue
      };
    }
    if(overdue.count === 1){
      return {
        label:`${overdue.oldestDays} gün gecikti`,
        kind:'overdue',
        overdue
      };
    }

    const today = parseDate(todayISO());
    const due = parseDate(d.dueDate);
    if(!today || !due) return {label:'Vade yok', kind:'neutral', overdue};

    const days = Math.round((due - today) / 86400000);
    if(days === 0) return {label:'Bugün vadeli', kind:'today', overdue};
    if(days <= 7) return {label:`${days} gün kaldı`, kind:'soon', overdue};

    return {
      label:due.toLocaleDateString('tr-TR',{day:'2-digit',month:'short',year:'numeric'}),
      kind:'future',
      overdue
    };
  }

  function ensureStyles(){
    if(document.querySelector('#bsDebtCardStatusV2598Styles')) return;

    const style = document.createElement('style');
    style.id = 'bsDebtCardStatusV2598Styles';
    style.textContent = `
      #debts #debtList .bs-v2598-debt-status{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:5px;
        margin-top:1px;
        font-size:10px!important;
        line-height:1.2!important;
      }
      #debts #debtList .bs-v2598-pill{
        display:inline-flex;
        align-items:center;
        min-height:20px;
        padding:3px 7px;
        border-radius:999px;
        border:1px solid #E2E8F0;
        background:#F8FAFC;
        color:#64748B;
        font-size:9.5px!important;
        line-height:1!important;
        font-weight:800;
        white-space:nowrap;
      }
      #debts #debtList .bs-v2598-pill.overdue{
        border-color:#FECACA;
        background:#FFF1F2;
        color:#DC2626;
      }
      #debts #debtList .bs-v2598-pill.today,
      #debts #debtList .bs-v2598-pill.soon{
        border-color:#FED7AA;
        background:#FFF7ED;
        color:#C2410C;
      }
      #debts #debtList .bs-v2598-pill.partial{
        border-color:#FDE68A;
        background:#FFFBEB;
        color:#A16207;
      }
      #debts #debtList .bs-v2598-pill.closed{
        border-color:#BBF7D0;
        background:#F0FDF4;
        color:#15803D;
      }
      #debts #debtList .amount .bs-v2598-remaining{
        display:block;
        color:inherit;
        font:inherit;
      }
      #debts #debtList .amount .bs-v2598-remaining-label{
        display:block;
        margin-top:4px!important;
        color:#64748B!important;
        font-size:9.5px!important;
        line-height:1.15!important;
        font-weight:700!important;
      }
      @media(max-width:520px){
        #debts #debtList .bs-v2598-debt-status{gap:4px}
        #debts #debtList .bs-v2598-pill{font-size:9px!important;padding:3px 6px}
        #debts #debtList .amount .bs-v2598-remaining-label{font-size:9px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function decorateCards(){
    ensureStyles();

    const byId = new Map(
      state.debts
        .map(normalizeDebt)
        .map(d => [String(d.id), d])
    );

    document.querySelectorAll('#debtList [data-debt]').forEach(card => {
      const d = byId.get(String(card.dataset.debt || ''));
      if(!d) return;

      card.querySelector('.bs-v2598-debt-status')?.remove();

      const main = card.querySelector('.main');
      const amount = card.querySelector('.amount');
      if(!main || !amount) return;

      const due = dueState(d);
      const paid = Math.max(0, roundMoney(d.custom?.current_installment_paid || 0));
      const remaining = remainingAmount(d);
      const overdue = due.overdue || overdueSummary(d);
      const showOverdueTotal = overdue.count > 1 && overdue.total > EPS;
      const displayAmount = showOverdueTotal ? overdue.total : remaining;
      const amountLabel = showOverdueTotal
        ? 'gecikmiş toplam'
        : (paid > EPS ? 'bu taksitte kalan' : 'ödenecek');

      const status = document.createElement('small');
      status.className = 'bs-v2598-debt-status';
      status.innerHTML = `
        <span class="bs-v2598-pill ${due.kind}">${esc(due.label)}</span>
        ${overdue.count > 1
          ? `<span class="bs-v2598-pill overdue">En eski ${overdue.oldestDays} gün</span>`
          : ''}
        ${d.status === 'active' && paid > EPS && remaining > EPS
          ? `<span class="bs-v2598-pill partial">Kısmi · ${money(paid)} ödendi</span>`
          : ''}
      `;
      main.appendChild(status);

      if(d.status === 'active'){
        amount.innerHTML = `
          <strong class="bs-v2598-remaining">${money(displayAmount)}</strong>
          <small class="bs-v2598-remaining-label">${amountLabel}</small>
        `;
      }
    });
  }

  if(typeof renderDebts === 'function' && !renderDebts.__bsDebtCardStatusV2598){
    const originalRenderDebts = renderDebts;
    const wrappedRenderDebts = function(...args){
      const result = originalRenderDebts.apply(this,args);
      decorateCards();
      return result;
    };
    wrappedRenderDebts.__bsDebtCardStatusV2598 = true;
    renderDebts = wrappedRenderDebts;
  }

  if(typeof renderDebts === 'function') renderDebts();
})();
