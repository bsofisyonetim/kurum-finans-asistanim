/* BS OFİS BÜTÇE V2.7.9 - Sade finans özeti veri ve etkileşim katmanı */
(() => {
  if(window.__bsDashboardSummaryV279Loaded) return;
  window.__bsDashboardSummaryV279Loaded = true;

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
    if(!card||card.dataset.v279Bound==='1') return;
    card.dataset.v279Bound='1';
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
    if(!list||list.dataset.v279PayBound==='1') return;
    list.dataset.v279PayBound='1';

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

  function renderSummaryExtras(){
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
    bindUpcomingPay();
  }

  renderSummaryExtras();

  const originalRenderDashboardV279=renderDashboard;
  renderDashboard=function(){
    originalRenderDashboardV279();
    renderSummaryExtras();
  };
})();