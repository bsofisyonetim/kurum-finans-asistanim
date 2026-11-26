/* BS OFİS BÜTÇE V2.7.8 - Sade ve tekil finans özeti */
(() => {
  if(window.__bsDashboardSummaryV278Loaded) return;
  window.__bsDashboardSummaryV278Loaded = true;

  function ensureV177Styles(){
    if(document.querySelector('#v177Styles')) return;
    const style=document.createElement('style');
    style.id='v177Styles';
    style.textContent=`
      #v177DashboardPanel{display:none!important}
      #dashboard #v177BalanceCard.net-negative strong{color:#DC2626!important}
      #dashboard #v177BalanceCard.net-positive strong{color:#15803D!important}
    `;
    document.head.appendChild(style);
  }

  function ensureDashboardPanel(){
    const dashboard=document.querySelector('#dashboard');
    const summary=dashboard?.querySelector('.summary-grid');
    if(!dashboard||!summary) return null;

    let panel=document.querySelector('#v177DashboardPanel');
    if(!panel){
      panel=document.createElement('section');
      panel.id='v177DashboardPanel';
      panel.setAttribute('aria-hidden','true');
      summary.insertAdjacentElement('afterend',panel);
    }
    panel.style.display='none';
    return panel;
  }

  function currentMonthData(){
    const month=monthKey();
    const incomes=state.incomes
      .map(normalizeIncome)
      .filter(x=>x.date?.startsWith(month));
    const payments=state.payments
      .map(normalizePayment)
      .filter(x=>x.date?.startsWith(month));
    const expenses=state.expenses
      .map(normalizeExpense)
      .filter(x=>x.date?.startsWith(month));

    const incomeTotal=incomes.reduce((s,x)=>s+(+x.amount||0),0);
    const paymentTotal=payments.reduce((s,x)=>s+(+x.amount||0),0);
    const expenseTotal=expenses.reduce((s,x)=>s+(+x.amount||0),0);

    return {
      incomeTotal,
      paymentTotal,
      expenseTotal,
      net:incomeTotal-paymentTotal-expenseTotal
    };
  }

  function openCurrentExpenses(){
    const month=document.querySelector('#expenseMonth');
    if(month){
      populateMonths();
      month.value=monthKey();
    }
    const category=document.querySelector('#v176ExpenseCategoryFilter');
    if(category) category.value='all';
    const search=document.querySelector('#expenseSearch');
    if(search) search.value='';
    renderExpenses();
    openView('expenses');
  }

  function bindExpenseCard(){
    const card=document.querySelector('#v177ExpenseCard');
    if(!card||card.dataset.v278Bound==='1') return;
    card.dataset.v278Bound='1';
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label','Bu ayın harcamalarını aç');
    const open=()=>openCurrentExpenses();
    card.addEventListener('click',open);
    card.addEventListener('keydown',e=>{
      if(!['Enter',' '].includes(e.key)) return;
      e.preventDefault();
      open();
    });
  }

  function bindUpcomingPay(){
    const list=document.querySelector('#upcomingMini');
    if(!list||list.dataset.v202PayBound==='1') return;
    list.dataset.v202PayBound='1';

    list.addEventListener('click',e=>{
      const btn=e.target.closest('[data-calendar-pay]');
      if(!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const debt=state.debts
        .map(normalizeDebt)
        .find(d=>d.id===btn.dataset.calendarPay);
      if(!debt) return;

      const remaining=typeof window.currentInstallmentRemaining==='function'
        ?window.currentInstallmentRemaining(debt)
        :Math.max(0,+debt.minimum||0);

      openRecordDialog('payments',{
        debtId:debt.id,
        date:todayISO(),
        amount:remaining>0?remaining:''
      });
    },true);
  }

  function compactLegacyDashboard(){
    const dashboard=document.querySelector('#dashboard');
    if(!dashboard) return;

    const assistant=document.querySelector('#assistantCard');
    const assistantHead=assistant?.previousElementSibling;
    if(assistant) assistant.style.display='none';
    if(assistantHead?.classList?.contains('section-head')) assistantHead.style.display='none';

    const upcoming=document.querySelector('#upcomingMini');
    const upcomingHead=upcoming?.previousElementSibling;
    if(upcomingHead?.classList?.contains('section-head')){
      const title=upcomingHead.querySelector('h2');
      const btn=upcomingHead.querySelector('.link-btn');
      if(title) title.textContent='Sıradaki Ödemeler';
      if(btn) btn.textContent='Takvim';
    }

    const recent=document.querySelector('#recentPayments');
    const recentHead=recent?.previousElementSibling;
    if(recentHead?.classList?.contains('section-head')){
      const title=recentHead.querySelector('h2');
      const btn=recentHead.querySelector('.link-btn');
      if(title) title.textContent='Son Ödemeler';
      if(btn) btn.textContent='Tümü';
    }

    [upcoming,recent].forEach(list=>{
      if(!list) return;
      [...list.children].slice(3).forEach(node=>node.remove());
    });

    bindUpcomingPay();
  }

  function renderDashboardPanel(){
    ensureDashboardPanel();
    const data=currentMonthData();

    const expense=document.querySelector('#v177Expenses');
    const net=document.querySelector('#v177NetCash');
    const netCard=document.querySelector('#v177BalanceCard');

    if(expense) expense.textContent=money(data.expenseTotal);
    if(net) net.textContent=money(data.net);

    if(netCard){
      netCard.classList.toggle('net-positive',data.net>=0);
      netCard.classList.toggle('net-negative',data.net<0);
    }

    bindExpenseCard();
    compactLegacyDashboard();
  }

  ensureV177Styles();
  ensureDashboardPanel();
  renderDashboardPanel();

  const originalRenderDashboardV177=renderDashboard;
  renderDashboard=function(){
    originalRenderDashboardV177();
    renderDashboardPanel();
  };
})();