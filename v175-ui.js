/* BS OFİS BÜTÇE V1.7.5 - Özet, Borçlar ve Takvim UX */
(() => {
  let debtQuickMode = 'active';
  let calendarQuickMode = 'all';

  function ensureV175Styles(){
    if(document.querySelector('#v175Styles')) return;

    const style = document.createElement('style');
    style.id = 'v175Styles';
    style.textContent = `
      .v175-quick-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin:0 0 14px;
      }
      .v175-quick-card{
        min-width:0;
        background:var(--card);
        border:1px solid var(--line);
        border-radius:13px;
        padding:10px 9px;
        display:grid;
        gap:4px;
        text-align:center;
        box-shadow:0 3px 12px rgba(20,33,61,.035);
        cursor:pointer;
        transition:border-color .15s ease,background .15s ease,transform .15s ease,box-shadow .15s ease;
        -webkit-tap-highlight-color:transparent;
      }
      .v175-quick-card:active,
      #dashboard .summary-card[data-v175-target]:active{
        transform:scale(.985);
      }
      .v175-quick-card.active{
        border-color:#8eb1ff;
        background:#eef4ff;
        box-shadow:0 0 0 2px rgba(36,107,253,.08);
      }
      .v175-quick-card span{
        color:var(--muted);
        font-size:10px;
        font-weight:800;
        line-height:1.15;
      }
      .v175-quick-card strong{
        color:var(--ink);
        font-size:16px;
        line-height:1.1;
        white-space:nowrap;
      }
      .v175-quick-card small{
        color:var(--muted);
        font-size:9px;
        line-height:1.2;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .v175-quick-card.active span,
      .v175-quick-card.active strong,
      .v175-quick-card.active small{
        color:var(--accent);
      }
      .v175-quick-card:focus-visible,
      #dashboard .summary-card[data-v175-target]:focus-visible{
        outline:2px solid #8eb1ff;
        outline-offset:2px;
      }
      #dashboard .summary-card[data-v175-target]{
        cursor:pointer;
        transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;
        -webkit-tap-highlight-color:transparent;
      }
      #dashboard .summary-card[data-v175-target]:hover{
        border-color:#b9cbef;
      }
      .v175-calendar-group{
        margin:15px 0 7px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .v175-calendar-group strong{
        font-size:12px;
        color:var(--ink);
      }
      .v175-calendar-group small{
        color:var(--muted);
        font-size:10px;
      }
      @media(max-width:380px){
        .v175-quick-grid{gap:6px}
        .v175-quick-card{padding:9px 5px}
        .v175-quick-card strong{font-size:14px}
        .v175-quick-card span{font-size:9px}
      }
    `;
    document.head.appendChild(style);
  }

  function makeInteractive(card, handler, label){
    if(!card || card.dataset.v175Bound === '1') return;
    card.dataset.v175Bound = '1';
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label',label);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => {
      if(!['Enter',' '].includes(e.key)) return;
      e.preventDefault();
      handler();
    });
  }

  function resetIncomeFiltersToCurrentMonth(){
    const month = document.querySelector('#incomeMonth');
    const owner = document.querySelector('#incomeOwnerFilter');
    const type = document.querySelector('#incomeTypeFilter');
    if(month) month.value = monthKey();
    if(owner) owner.value = 'all';
    if(type) type.value = 'all';
    renderIncomes();
  }

  function bindDashboardCards(){
    const income = document.querySelector('#totalDebt')?.closest('.summary-card');
    const due = document.querySelector('#monthOut')?.closest('.summary-card');
    const paid = document.querySelector('#monthPaid')?.closest('.summary-card');
    const remaining = document.querySelector('#monthRemaining')?.closest('.summary-card');

    if(income){
      income.dataset.v175Target = 'incomes';
      makeInteractive(income, () => {
        resetIncomeFiltersToCurrentMonth();
        openView('incomes');
      }, 'Bu ayın tüm gelirlerini aç');
    }

    if(due){
      due.dataset.v175Target = 'calendar';
      makeInteractive(due, () => {
        calendarQuickMode = 'all';
        renderCalendar();
        openView('calendar');
      }, 'Planlanan ödemeleri takvimde aç');
    }

    if(paid){
      paid.dataset.v175Target = 'payments';
      makeInteractive(paid, () => {
        const period = document.querySelector('#paymentPeriodFilter');
        if(period) period.value = 'current';
        renderPayments();
        openView('payments');
      }, 'Bu ay yapılan ödemeleri aç');
    }

    if(remaining){
      remaining.dataset.v175Target = 'debts';
      makeInteractive(remaining, () => {
        debtQuickMode = 'active';
        const filter = document.querySelector('#debtFilter');
        const owner = document.querySelector('#debtOwnerFilter');
        const search = document.querySelector('#debtSearch');
        if(filter) filter.value = 'active';
        if(owner) owner.value = 'all';
        if(search) search.value = '';
        renderDebts();
        openView('debts');
      }, 'Kalan aktif borçları aç');
    }
  }

  function ensureDebtQuickCards(){
    const view = document.querySelector('#debts');
    const title = view?.querySelector('.page-title');
    if(!view || !title || document.querySelector('#v175DebtKpis')) return;

    const wrap = document.createElement('div');
    wrap.id = 'v175DebtKpis';
    wrap.className = 'v175-quick-grid';
    wrap.innerHTML = `
      <article class="v175-quick-card" data-debt-quick="active" role="button" tabindex="0">
        <span>AKTİF BORÇ</span>
        <strong id="v175DebtActiveCount">0</strong>
        <small id="v175DebtActiveAmount">₺0 / ay</small>
      </article>
      <article class="v175-quick-card" data-debt-quick="month" role="button" tabindex="0">
        <span>BU AY VADELİ</span>
        <strong id="v175DebtMonthCount">0</strong>
        <small id="v175DebtMonthAmount">₺0</small>
      </article>
      <article class="v175-quick-card" data-debt-quick="overdue" role="button" tabindex="0">
        <span>GECİKEN</span>
        <strong id="v175DebtOverdueCount">0</strong>
        <small id="v175DebtOverdueAmount">₺0</small>
      </article>
    `;
    title.insertAdjacentElement('afterend',wrap);

    wrap.addEventListener('click', e => {
      const card = e.target.closest('[data-debt-quick]');
      if(card) applyDebtQuickMode(card.dataset.debtQuick);
    });
    wrap.addEventListener('keydown', e => {
      const card = e.target.closest('[data-debt-quick]');
      if(!card || !['Enter',' '].includes(e.key)) return;
      e.preventDefault();
      applyDebtQuickMode(card.dataset.debtQuick);
    });
  }

  function debtStats(){
    const all = state.debts.map(normalizeDebt).filter(d => !(d.type === 'Kredi Kartı' && d.custom?.odeme_yapisi === 'Değişken'));
    const active = all.filter(d => d.status === 'active');
    const currentMonth = monthKey();
    const today = todayISO();
    const month = active.filter(d => d.dueDate?.startsWith(currentMonth));
    const overdue = active.filter(d => d.dueDate && d.dueDate < today);

    return {all,active,month,overdue};
  }

  function updateDebtQuickCards(){
    ensureDebtQuickCards();
    const {active,month,overdue} = debtStats();

    const activeCount = document.querySelector('#v175DebtActiveCount');
    const activeAmount = document.querySelector('#v175DebtActiveAmount');
    const monthCount = document.querySelector('#v175DebtMonthCount');
    const monthAmount = document.querySelector('#v175DebtMonthAmount');
    const overdueCount = document.querySelector('#v175DebtOverdueCount');
    const overdueAmount = document.querySelector('#v175DebtOverdueAmount');

    if(activeCount) activeCount.textContent = String(active.length);
    if(activeAmount) activeAmount.textContent = `${money(active.reduce((s,d)=>s+(+d.minimum||0),0))} / ay`;
    if(monthCount) monthCount.textContent = String(month.length);
    if(monthAmount) monthAmount.textContent = money(month.reduce((s,d)=>s+(+d.minimum||0),0));
    if(overdueCount) overdueCount.textContent = String(overdue.length);
    if(overdueAmount) overdueAmount.textContent = money(overdue.reduce((s,d)=>s+(+d.minimum||0),0));

    document.querySelectorAll('[data-debt-quick]').forEach(card => {
      const activeCard = card.dataset.debtQuick === debtQuickMode;
      card.classList.toggle('active',activeCard);
      card.setAttribute('aria-pressed',activeCard?'true':'false');
    });
  }

  function applyDebtQuickMode(mode){
    debtQuickMode = mode;
    const filter = document.querySelector('#debtFilter');
    const owner = document.querySelector('#debtOwnerFilter');
    const search = document.querySelector('#debtSearch');
    if(filter) filter.value = mode === 'active' ? 'active' : 'active';
    if(owner) owner.value = 'all';
    if(search) search.value = '';
    renderDebts();
  }

  function renderDebtsV175(){
    ensureDebtQuickCards();

    const q = (document.querySelector('#debtSearch')?.value || '')
      .trim().toLocaleLowerCase('tr-TR');
    const filter = document.querySelector('#debtFilter')?.value || 'active';
    const owner = document.querySelector('#debtOwnerFilter')?.value || 'all';
    const currentMonth = monthKey();
    const today = todayISO();

    const list = state.debts
      .map(normalizeDebt)
      .filter(d => {
        if(typeof window.bsV276IsVariableCard === 'function' ? window.bsV276IsVariableCard(d) : d.type === 'Kredi Kartı' && d.custom?.odeme_yapisi === 'Değişken') return false;
        let modeOk;
        if(debtQuickMode === 'month'){
          modeOk = d.status === 'active' && !!d.dueDate && d.dueDate.startsWith(currentMonth) && (typeof window.bsV276DebtRemaining !== 'function' || window.bsV276DebtRemaining(d) > .005);
        }else if(debtQuickMode === 'overdue'){
          modeOk = typeof window.bsV276DebtOverdueInfo === 'function' ? window.bsV276DebtOverdueInfo(d).count > 0 : d.status === 'active' && !!d.dueDate && d.dueDate < today;
        }else{
          modeOk = filter === 'all'
            || (filter === 'active' && d.status === 'active')
            || (filter === 'closed' && d.status === 'closed');
        }

        return modeOk
          && (owner === 'all' || d.custom?.debt_owner === owner)
          && (!q || `${d.name} ${d.type} ${d.notes} ${JSON.stringify(d.custom)}`
            .toLocaleLowerCase('tr-TR').includes(q));
      })
      .sort((a,b) => {
        if(debtQuickMode === 'month' || debtQuickMode === 'overdue'){
          return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
        }
        return a.status === b.status
          ? b.createdAt.localeCompare(a.createdAt)
          : a.status === 'active' ? -1 : 1;
      });

    const listEl = document.querySelector('#debtList');
    if(listEl){
      listEl.innerHTML = list.length
        ? list.map(debtCard).join('')
        : empty(debtQuickMode === 'overdue'
          ? 'Gecikmiş borç bulunmuyor.'
          : debtQuickMode === 'month'
            ? 'Bu ay vadeli borç bulunmuyor.'
            : filter === 'active'
              ? 'Aktif borç bulunmuyor.'
              : 'Borç kaydı bulunmuyor.');
    }

    updateDebtQuickCards();
  }

  function bindDebtFilters(){
    const filter = document.querySelector('#debtFilter');
    const owner = document.querySelector('#debtOwnerFilter');
    const search = document.querySelector('#debtSearch');

    if(filter){
      filter.onchange = () => {
        debtQuickMode = filter.value === 'closed' ? 'closed' : filter.value === 'all' ? 'all' : 'active';
        renderDebts();
      };
    }
    if(owner) owner.onchange = renderDebts;
    if(search) search.oninput = renderDebts;
  }

  function ensureCalendarQuickCards(){
    const view = document.querySelector('#calendar');
    const title = view?.querySelector('.page-title');
    if(!view || !title || document.querySelector('#v175CalendarKpis')) return;

    const wrap = document.createElement('div');
    wrap.id = 'v175CalendarKpis';
    wrap.className = 'v175-quick-grid';
    wrap.innerHTML = `
      <article class="v175-quick-card" data-calendar-quick="overdue" role="button" tabindex="0">
        <span>GECİKEN</span>
        <strong id="v175CalOverdueCount">0</strong>
        <small id="v175CalOverdueAmount">₺0</small>
      </article>
      <article class="v175-quick-card" data-calendar-quick="week" role="button" tabindex="0">
        <span>7 GÜN</span>
        <strong id="v175CalWeekCount">0</strong>
        <small id="v175CalWeekAmount">₺0</small>
      </article>
      <article class="v175-quick-card" data-calendar-quick="all" role="button" tabindex="0">
        <span>TÜMÜ</span>
        <strong id="v175CalAllCount">0</strong>
        <small id="v175CalAllAmount">₺0</small>
      </article>
    `;
    title.insertAdjacentElement('afterend',wrap);

    wrap.addEventListener('click', e => {
      const card = e.target.closest('[data-calendar-quick]');
      if(card){
        calendarQuickMode = card.dataset.calendarQuick;
        renderCalendar();
      }
    });
    wrap.addEventListener('keydown', e => {
      const card = e.target.closest('[data-calendar-quick]');
      if(!card || !['Enter',' '].includes(e.key)) return;
      e.preventDefault();
      calendarQuickMode = card.dataset.calendarQuick;
      renderCalendar();
    });
  }

  function updateCalendarQuickCards(due){
    ensureCalendarQuickCards();
    const overdue = due.filter(d => d.days < 0);
    const week = due.filter(d => d.days >= 0 && d.days <= 7);

    const values = [
      ['#v175CalOverdueCount',String(overdue.length)],
      ['#v175CalOverdueAmount',money(overdue.reduce((s,d)=>s+(+d.amount||0),0))],
      ['#v175CalWeekCount',String(week.length)],
      ['#v175CalWeekAmount',money(week.reduce((s,d)=>s+(+d.amount||0),0))],
      ['#v175CalAllCount',String(due.length)],
      ['#v175CalAllAmount',money(due.reduce((s,d)=>s+(+d.amount||0),0))]
    ];
    values.forEach(([selector,value]) => {
      const el = document.querySelector(selector);
      if(el) el.textContent = value;
    });

    document.querySelectorAll('[data-calendar-quick]').forEach(card => {
      const active = card.dataset.calendarQuick === calendarQuickMode;
      card.classList.toggle('active',active);
      card.setAttribute('aria-pressed',active?'true':'false');
    });
  }

  function calendarGroupHtml(title,items){
    if(!items.length) return '';
    const total = items.reduce((s,d)=>s+(+d.amount||0),0);
    return `
      <div class="v175-calendar-group">
        <strong>${esc(title)}</strong>
        <small>${items.length} kayıt · ${money(total)}</small>
      </div>
      ${items.map(dueCard).join('')}
    `;
  }

  function renderCalendarV175(){
    ensureCalendarQuickCards();
    const due = dueItems();
    updateCalendarQuickCards(due);

    let filtered = due;
    if(calendarQuickMode === 'overdue'){
      filtered = due.filter(d => d.days < 0);
    }else if(calendarQuickMode === 'week'){
      filtered = due.filter(d => d.days >= 0 && d.days <= 7);
    }

    const overdue = filtered.filter(d => d.days < 0);
    const today = filtered.filter(d => d.days === 0);
    const week = filtered.filter(d => d.days > 0 && d.days <= 7);
    const later = filtered.filter(d => d.days > 7);

    const list = document.querySelector('#calendarList');
    if(!list) return;

    if(!filtered.length){
      list.innerHTML = empty(
        calendarQuickMode === 'overdue'
          ? 'Gecikmiş ödeme yok.'
          : calendarQuickMode === 'week'
            ? 'Önümüzdeki 7 günde ödeme yok.'
            : 'Takvimde yaklaşan ödeme yok.'
      );
      return;
    }

    list.innerHTML =
      calendarGroupHtml('Geciken',overdue) +
      calendarGroupHtml('Bugün',today) +
      calendarGroupHtml('Önümüzdeki 7 Gün',week) +
      calendarGroupHtml('Daha Sonra',later);
  }

  ensureV175Styles();
  bindDashboardCards();
  ensureDebtQuickCards();
  ensureCalendarQuickCards();

  renderDebts = renderDebtsV175;
  renderCalendar = renderCalendarV175;

  bindDebtFilters();
  renderDebts();
  renderCalendar();
})();