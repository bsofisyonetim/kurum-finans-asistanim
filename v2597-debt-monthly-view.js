/* BS OFİS BÜTÇE V2.7.0 - Borçlar aylık operasyon görünümü
   Veri modelini değiştirmez. Mevcut ödeme/taksit motorunun ürettiği vade ve kısmi ödeme durumunu kullanır.
   Ana ekrandaki Kalan Ödeme, bu ayın planlı yükünden yalnız bu aya uygulanmış ödemeleri düşer. */
(() => {
  if(window.__bsDebtMonthlyViewV2597Loaded) return;
  window.__bsDebtMonthlyViewV2597Loaded = true;

  const EPS = .005;

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

  function monthlyPlannedAmount(raw,current){
    const d = normalizeDebt(raw);

    if(typeof window.bsDebtMonthlyPlannedAmount === 'function'){
      try{
        return Math.max(0,roundMoney(window.bsDebtMonthlyPlannedAmount(d,current)));
      }catch(_error){}
    }

    if(d.status !== 'active') return 0;
    if(!d.dueDate){
      return d.frequency === 'monthly' ? Math.max(0,roundMoney(d.minimum)) : 0;
    }
    return d.dueDate.startsWith(current)
      ? Math.max(0,roundMoney(d.minimum))
      : 0;
  }

  function fixedAppliedToMonth(raw,current,planned){
    const d = normalizeDebt(raw);
    let applied = 0;
    let matchedInstallmentMeta = false;

    state.payments
      .map(normalizePayment)
      .filter(p => p.debtId === d.id)
      .forEach(p => {
        const meta = p.custom || {};
        const due = String(meta.installment_due_date || '');
        if(!due.startsWith(current)) return;

        matchedInstallmentMeta = true;
        const paymentAmount = Math.max(0,roundMoney(p.amount));
        const remainingBefore = Math.max(0,roundMoney(meta.installment_remaining_before || 0));
        const installmentAtPayment = Math.max(0,roundMoney(meta.installment_amount_at_payment || 0));
        const cap = remainingBefore > EPS ? remainingBefore : installmentAtPayment;
        const appliedToThisInstallment = cap > EPS
          ? Math.min(paymentAmount,cap)
          : paymentAmount;
        applied = roundMoney(applied + appliedToThisInstallment);
      });

    if(!matchedInstallmentMeta && !d.dueDate && d.frequency === 'monthly'){
      const paidThisMonth = state.payments
        .map(normalizePayment)
        .filter(p => p.debtId === d.id && p.date?.startsWith(current))
        .reduce((sum,p) => sum + Math.max(0,+p.amount || 0),0);
      applied = Math.max(applied,Math.min(planned,roundMoney(paidThisMonth)));
    }

    if(!matchedInstallmentMeta && d.dueDate?.startsWith(current)){
      const currentPaid = Math.max(0,roundMoney(d.custom?.current_installment_paid || 0));
      applied = Math.max(applied,Math.min(planned,currentPaid));
    }

    return Math.min(planned,roundMoney(applied));
  }

  function monthlyRemainingAmount(raw,current=monthKey()){
    const d = normalizeDebt(raw);

    if(typeof window.bsIsCreditCardDebt === 'function' && window.bsIsCreditCardDebt(d)){
      try{
        const s = typeof window.bsCreditCardSnapshot === 'function'
          ? window.bsCreditCardSnapshot(d)
          : null;
        if(!s?.hasStatement || !d.dueDate?.startsWith(current)) return 0;
        return Math.max(0,roundMoney(s.minimumRemaining));
      }catch(_error){
        return 0;
      }
    }

    const planned = monthlyPlannedAmount(d,current);
    if(planned <= EPS) return 0;
    const applied = fixedAppliedToMonth(d,current,planned);
    return Math.max(0,roundMoney(planned-applied));
  }

  function monthlyRemainingTotal(current=monthKey()){
    return roundMoney(
      state.debts
        .map(normalizeDebt)
        .reduce((sum,d) => sum + monthlyRemainingAmount(d,current),0)
    );
  }

  window.bsDebtMonthlyRemainingAmount = monthlyRemainingAmount;
  window.bsDebtMonthlyRemainingTotal = monthlyRemainingTotal;

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

  function updateDashboardRemaining(){
    const target = document.querySelector('#monthRemaining');
    if(!target) return;
    target.textContent = money(monthlyRemainingTotal());
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

  if(typeof renderDashboard === 'function' && !renderDashboard.__bsDebtMonthlyRemainingV270){
    const original = renderDashboard;
    const wrapped = function(...args){
      const result = original.apply(this,args);
      updateDashboardRemaining();
      return result;
    };
    wrapped.__bsDebtMonthlyRemainingV270 = true;
    renderDashboard = wrapped;
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

  if(typeof renderDashboard === 'function') renderDashboard();
  if(typeof renderDebts === 'function') renderDebts();
})();