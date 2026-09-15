/* BS OFİS BÜTÇE V2.5.9.7 - Borçlar aylık operasyon görünümü
   Veri modelini değiştirmez. Mevcut ödeme/taksit motorunun ürettiği vade ve kısmi ödeme durumunu kullanır.
   Varsayılan Aktif görünüm: gecikmiş + içinde bulunulan ay vadeli açık borçlar. Gelecek aylar Tümü filtresinde erişilebilir. */
(() => {
  if(window.__bsDebtMonthlyViewV2597Loaded) return;
  window.__bsDebtMonthlyViewV2597Loaded = true;

  function roundMoney(n){
    return Math.round((+n || 0) * 100) / 100;
  }

  function nextMonthStart(){
    const now = parseDate(todayISO());
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0);
    return next.toISOString().slice(0,10);
  }

  function monthLabel(){
    const now = parseDate(todayISO());
    return now.toLocaleDateString('tr-TR',{month:'long'}).toLocaleUpperCase('tr-TR');
  }

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

  function debtSets(){
    const all = state.debts.map(normalizeDebt);
    const currentMonth = monthKey();
    const today = todayISO();
    const nextMonth = nextMonthStart();

    const active = all.filter(d => d.status === 'active');
    const open = active.filter(d => !!d.dueDate && d.dueDate < nextMonth);
    const month = active.filter(d => !!d.dueDate && d.dueDate.startsWith(currentMonth));
    const overdue = active.filter(d => !!d.dueDate && d.dueDate < today);

    return {all,active,open,month,overdue};
  }

  function sumRemaining(list){
    return roundMoney(list.reduce((sum,d) => sum + remainingAmount(d), 0));
  }

  function updateKpis(){
    const {open,month,overdue} = debtSets();

    const firstLabel = document.querySelector('[data-debt-quick="active"] span');
    const monthTitle = document.querySelector('[data-debt-quick="month"] span');
    if(firstLabel) firstLabel.textContent = 'AÇIK BORÇ';
    if(monthTitle) monthTitle.textContent = `${monthLabel()} VADELİ`;

    const activeCount = document.querySelector('#v175DebtActiveCount');
    const activeAmount = document.querySelector('#v175DebtActiveAmount');
    const monthCount = document.querySelector('#v175DebtMonthCount');
    const monthAmount = document.querySelector('#v175DebtMonthAmount');
    const overdueCount = document.querySelector('#v175DebtOverdueCount');
    const overdueAmount = document.querySelector('#v175DebtOverdueAmount');

    if(activeCount) activeCount.textContent = String(open.length);
    if(activeAmount) activeAmount.textContent = money(sumRemaining(open));
    if(monthCount) monthCount.textContent = String(month.length);
    if(monthAmount) monthAmount.textContent = money(sumRemaining(month));
    if(overdueCount) overdueCount.textContent = String(overdue.length);
    if(overdueAmount) overdueAmount.textContent = money(sumRemaining(overdue));
  }

  function postProcessDefaultActiveList(){
    const activeCard = document.querySelector('[data-debt-quick="active"]');
    const isActiveMode = !!activeCard?.classList.contains('active');
    const filter = document.querySelector('#debtFilter')?.value || 'active';
    if(!isActiveMode || filter !== 'active') return;

    const listEl = document.querySelector('#debtList');
    if(!listEl) return;

    const allowed = new Map(debtSets().open.map(d => [String(d.id), d]));
    const visibleCards = [];

    listEl.querySelectorAll('[data-debt]').forEach(card => {
      const id = String(card.dataset.debt || '');
      const debt = allowed.get(id);
      if(!debt){
        card.remove();
        return;
      }
      visibleCards.push({card,debt});
    });

    visibleCards
      .sort((a,b) => String(a.debt.dueDate || '9999-12-31').localeCompare(String(b.debt.dueDate || '9999-12-31')))
      .forEach(x => listEl.appendChild(x.card));

    if(!listEl.querySelector('[data-debt]')){
      listEl.innerHTML = empty('Bu ay için açık veya gecikmiş borç bulunmuyor.');
    }
  }

  if(typeof renderDebts === 'function' && !renderDebts.__bsDebtMonthlyViewV2597){
    const original = renderDebts;
    const wrapped = function(...args){
      const result = original.apply(this,args);
      postProcessDefaultActiveList();
      updateKpis();
      return result;
    };
    wrapped.__bsDebtMonthlyViewV2597 = true;
    renderDebts = wrapped;
  }

  if(typeof renderDebts === 'function') renderDebts();
})();
