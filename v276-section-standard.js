/* BS OFİS BÜTÇE V2.7.7 - Özet sadeleştirme ve sekmeler arası görsel kart standardı */
(() => {
  if(window.__bsSectionStandardV276Loaded) return;
  window.__bsSectionStandardV276Loaded = true;

  const EPS = .005;
  let creditQuickMode = 'active';
  let usesSharedCreditRenderer = false;

  const roundMoney = value => Math.round((+value || 0) * 100) / 100;

  function isVariableCard(raw){
    if(typeof window.bsIsCreditCardDebt === 'function'){
      try{return !!window.bsIsCreditCardDebt(raw);}catch(_error){}
    }
    const d = normalizeDebt(raw || {});
    return d.type === 'Kredi Kartı'
      && String(d.custom?.odeme_yapisi || '').trim() === 'Değişken';
  }

  function snapshot(raw){
    if(typeof window.bsCreditCardSnapshot !== 'function') return null;
    try{return window.bsCreditCardSnapshot(raw);}catch(_error){return null;}
  }

  function monthLabel(){
    const d = parseDate(todayISO());
    return d.toLocaleDateString('tr-TR',{month:'long'}).toLocaleUpperCase('tr-TR');
  }

  function nextMonthStart(){
    const now = parseDate(todayISO());
    return new Date(now.getFullYear(),now.getMonth()+1,1,12,0,0)
      .toISOString().slice(0,10);
  }

  function fixedRemaining(raw){
    const d = normalizeDebt(raw);
    if(d.status !== 'active') return 0;
    if(typeof window.currentInstallmentRemaining === 'function'){
      try{return Math.max(0,roundMoney(window.currentInstallmentRemaining(d)));}catch(_error){}
    }
    const paid = Math.max(0,roundMoney(d.custom?.current_installment_paid || 0));
    return Math.max(0,roundMoney((+d.minimum || 0)-paid));
  }

  function fixedDebtSets(){
    const current = monthKey();
    const nextMonth = nextMonthStart();
    const active = state.debts
      .map(normalizeDebt)
      .filter(d => d.status === 'active' && !isVariableCard(d));

    return {
      active,
      open:active.filter(d => !!d.dueDate && d.dueDate < nextMonth),
      month:active.filter(d => !!d.dueDate && d.dueDate.startsWith(current)),
      overdue:active
    };
  }

  function fixedOverdueMetrics(list){
    let count = 0;
    let total = 0;

    list.forEach(d => {
      if(typeof window.bsDebtOverdueSummary === 'function'){
        try{
          const summary = window.bsDebtOverdueSummary(d);
          if(summary && Number.isFinite(summary.count) && Number.isFinite(summary.total)){
            count += Math.max(0,summary.count);
            total += Math.max(0,summary.total);
            return;
          }
        }catch(_error){}
      }
      const remaining = fixedRemaining(d);
      if(d.dueDate && d.dueDate < todayISO() && remaining > EPS){
        count += 1;
        total += remaining;
      }
    });

    return {count,total:roundMoney(total)};
  }

  function updateDebtKpis(){
    const {open,month,overdue} = fixedDebtSets();
    const overdueInfo = fixedOverdueMetrics(overdue);

    const firstLabel = document.querySelector('[data-debt-quick="active"] span');
    const monthTitle = document.querySelector('[data-debt-quick="month"] span');
    if(firstLabel) firstLabel.textContent = 'AÇIK BORÇ';
    if(monthTitle) monthTitle.textContent = `${monthLabel()} VADELİ`;

    const values = [
      ['#v175DebtActiveCount',String(open.length)],
      ['#v175DebtActiveAmount',money(roundMoney(open.reduce((s,d)=>s+fixedRemaining(d),0)))],
      ['#v175DebtMonthCount',String(month.length)],
      ['#v175DebtMonthAmount',money(roundMoney(month.reduce((s,d)=>s+fixedRemaining(d),0)))],
      ['#v175DebtOverdueCount',String(overdueInfo.count)],
      ['#v175DebtOverdueAmount',money(overdueInfo.total)]
    ];

    values.forEach(([selector,value]) => {
      const el = document.querySelector(selector);
      if(el) el.textContent = value;
    });
  }

  function removeDashboardAttention(){
    document.querySelector('#v177DashboardPanel .v177-attention-head')?.remove();
    document.querySelector('#v177Attention')?.remove();
  }



  function ensureCreditKpis(){
    const view = document.getElementById('creditCards');
    const title = view?.querySelector('.page-title');
    if(!view || !title) return null;

    let wrap = document.getElementById('v276CreditCardKpis');
    if(wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'v276CreditCardKpis';
    wrap.className = 'v175-quick-grid';
    wrap.innerHTML = `
      <article class="v175-quick-card" data-credit-quick="active" role="button" tabindex="0">
        <span>AKTİF KART</span>
        <strong id="v276CreditActiveCount">0</strong>
        <small id="v276CreditActiveAmount">₺0</small>
      </article>
      <article class="v175-quick-card" data-credit-quick="month" role="button" tabindex="0">
        <span>${monthLabel()} ASGARİ</span>
        <strong id="v276CreditMonthCount">0</strong>
        <small id="v276CreditMonthAmount">₺0</small>
      </article>
      <article class="v175-quick-card" data-credit-quick="overdue" role="button" tabindex="0">
        <span>GECİKEN</span>
        <strong id="v276CreditOverdueCount">0</strong>
        <small id="v276CreditOverdueAmount">₺0</small>
      </article>
    `;
    title.insertAdjacentElement('afterend',wrap);

    const choose = card => {
      if(!card) return;
      creditQuickMode = card.dataset.creditQuick || 'active';
      const search = document.getElementById('creditCardSearch');
      const owner = document.getElementById('creditCardOwnerFilter');
      if(search) search.value = '';
      if(owner) owner.value = 'all';
      renderCreditCards();
    };

    wrap.addEventListener('click',e => choose(e.target.closest('[data-credit-quick]')));
    wrap.addEventListener('keydown',e => {
      const card = e.target.closest('[data-credit-quick]');
      if(!card || !['Enter',' '].includes(e.key)) return;
      e.preventDefault();
      choose(card);
    });

    return wrap;
  }

  function creditStats(){
    const current = monthKey();
    const active = state.debts
      .map(normalizeDebt)
      .filter(d => d.status === 'active' && isVariableCard(d));

    const rows = active.map(d => ({d,s:snapshot(d)}));
    const month = rows.filter(({d,s}) =>
      !!s?.hasStatement
      && !!d.dueDate
      && d.dueDate.startsWith(current)
      && (+s.minimumRemaining || 0) > EPS
    );
    const overdue = rows.filter(({s}) => !!s?.overdue && (+s.minimumRemaining || 0) > EPS);

    return {rows,month,overdue};
  }

  function updateCreditKpis(){
    ensureCreditKpis();
    const {rows,month,overdue} = creditStats();

    const activeAmount = roundMoney(rows.reduce((sum,{s}) =>
      sum + Math.max(0,+s?.statementRemaining || 0),0));
    const monthAmount = roundMoney(month.reduce((sum,{s}) =>
      sum + Math.max(0,+s?.minimumRemaining || 0),0));
    const overdueAmount = roundMoney(overdue.reduce((sum,{s}) =>
      sum + Math.max(0,+s?.minimumRemaining || 0),0));

    const values = [
      ['#v276CreditActiveCount',String(rows.length)],
      ['#v276CreditActiveAmount',money(activeAmount)],
      ['#v276CreditMonthCount',String(month.length)],
      ['#v276CreditMonthAmount',money(monthAmount)],
      ['#v276CreditOverdueCount',String(overdue.length)],
      ['#v276CreditOverdueAmount',money(overdueAmount)]
    ];
    values.forEach(([selector,value]) => {
      const el = document.querySelector(selector);
      if(el) el.textContent = value;
    });

    document.querySelectorAll('[data-credit-quick]').forEach(card => {
      const active = card.dataset.creditQuick === creditQuickMode;
      card.classList.toggle('active',active);
      card.setAttribute('aria-pressed',active ? 'true' : 'false');
    });
  }


  function ownerClass(owner){
    if(owner === 'Başak') return 'debt-owner-basak';
    if(owner === 'Süleyman') return 'debt-owner-suleyman';
    if(owner === 'Kurum Kasası' || owner === 'Kurum') return 'debt-owner-kurum';
    return '';
  }

  function creditStatus(raw,s){
    const d = normalizeDebt(raw);
    if(!s?.hasStatement) return {text:'Ekstre bilgisi girin',kind:'orange'};
    if(s.overdue && d.dueDate){
      const days = Math.max(1,Math.round((parseDate(todayISO())-parseDate(d.dueDate))/86400000));
      return {text:`${days} gün gecikti`,kind:'red'};
    }
    if(s.label === 'Asgari ödendi · borç devrediyor') return {text:'Asgari ödendi',kind:'green'};
    if(s.label === 'Ekstre ödendi') return {text:'Ekstre ödendi',kind:'green'};
    if(s.label === 'Asgari ödeme gecikti') return {text:'Asgari gecikti',kind:'red'};
    return {text:s.label || 'Ekstre bekleniyor',kind:s.badge || 'orange'};
  }

  function creditCardHtml(raw){
    const d = normalizeDebt(raw);
    const s = snapshot(d) || {};
    const owner = String(d.custom?.debt_owner || '').trim();
    const status = creditStatus(d,s);
    const ownerCss = ownerClass(owner);

    let amount = 0;
    let amountLabel = 'ekstre bekleniyor';
    if(s.hasStatement && (+s.minimumRemaining || 0) > EPS){
      amount = s.minimumRemaining;
      amountLabel = 'kalan asgari';
    }else if(s.hasStatement && (+s.carryover || 0) > EPS){
      amount = s.carryover;
      amountLabel = 'devreden borç';
    }else if(s.hasStatement && (+s.statementRemaining || 0) > EPS){
      amount = s.statementRemaining;
      amountLabel = 'kalan ekstre';
    }else if(s.hasStatement){
      amountLabel = 'ekstre ödendi';
    }

    const due = d.dueDate
      ? parseDate(d.dueDate).toLocaleDateString('tr-TR')
      : 'tarih girilmedi';

    const remainingLabel = (+s.carryover || 0) > EPS ? 'Devreden' : 'Kalan';

    return `
      <article class="list-card clickable bs-v276-cc-card ${esc(ownerCss)}" data-debt="${esc(d.id)}">
        <div class="main bs-v276-cc-main">
          <strong class="bs-v276-cc-name">${esc(d.name)}</strong>
          <small class="bs-v276-cc-meta">
            ${owner ? `<span>${esc(owner)}</span>` : ''}
          </small>
        </div>
        <div class="amount bs-v276-cc-amount">
          <strong>${money(amount)}</strong>
          <small>${esc(amountLabel)}</small>
        </div>
        <div class="bs-v276-cc-status">
          <span class="bs-v276-pill ${esc(status.kind)}">${esc(status.text)}</span>
          <span>Son ödeme ${esc(due)}</span>
        </div>
        ${s.hasStatement ? `
          <div class="bs-v276-cc-summary">
            <span>Ekstre <strong>${money(s.statement || 0)}</strong></span>
            <span>·</span>
            <span>Ödenen <strong>${money(s.paid || 0)}</strong></span>
            <span>·</span>
            <span>${remainingLabel} <strong>${money(s.statementRemaining || 0)}</strong></span>
          </div>
        ` : ''}
      </article>
    `;
  }

  function creditFilteredRows(){
    const search = String(document.getElementById('creditCardSearch')?.value || '')
      .trim().toLocaleLowerCase('tr-TR');
    const owner = document.getElementById('creditCardOwnerFilter')?.value || 'all';
    const current = monthKey();

    return state.debts
      .map(normalizeDebt)
      .filter(d => d.status === 'active' && isVariableCard(d))
      .filter(d => {
        const s = snapshot(d);
        if(creditQuickMode === 'month'){
          return !!s?.hasStatement
            && !!d.dueDate
            && d.dueDate.startsWith(current)
            && (+s.minimumRemaining || 0) > EPS;
        }
        if(creditQuickMode === 'overdue'){
          return !!s?.overdue && (+s.minimumRemaining || 0) > EPS;
        }
        return true;
      })
      .filter(d => owner === 'all' || d.custom?.debt_owner === owner)
      .filter(d => !search || `${d.name} ${d.notes} ${d.custom?.debt_owner || ''}`
        .toLocaleLowerCase('tr-TR').includes(search))
      .sort((a,b) =>
        String(a.custom?.debt_owner || '').localeCompare(String(b.custom?.debt_owner || ''),'tr')
        || a.name.localeCompare(b.name,'tr')
      );
  }

  function renderCreditCards(){
    ensureCreditKpis();
    const list = document.getElementById('creditCardList');
    if(!list) return;

    const rows = creditFilteredRows();
    list.innerHTML = rows.length
      ? rows.map(creditCardHtml).join('')
      : empty(
          creditQuickMode === 'overdue'
            ? 'Gecikmiş kredi kartı asgarisi bulunmuyor.'
            : creditQuickMode === 'month'
              ? 'Bu ay ödenecek kredi kartı asgarisi bulunmuyor.'
              : 'Aktif kredi kartı bulunmuyor.'
        );

    updateCreditKpis();
  }

  function bindCreditFilters(){
    const search = document.getElementById('creditCardSearch');
    const owner = document.getElementById('creditCardOwnerFilter');

    if(search && search.dataset.v276Bound !== '1'){
      search.addEventListener('input',() => queueMicrotask(renderCreditCards));
      search.dataset.v276Bound = '1';
    }
    if(owner && owner.dataset.v276Bound !== '1'){
      owner.addEventListener('change',() => queueMicrotask(renderCreditCards));
      owner.dataset.v276Bound = '1';
    }
  }

  function installRenderHooks(){
    if(typeof renderDashboard === 'function' && !renderDashboard.__bsSectionStandardV276){
      const original = renderDashboard;
      const wrapped = function(...args){
        const result = original.apply(this,args);
        removeDashboardAttention();
        return result;
      };
      wrapped.__bsSectionStandardV276 = true;
      renderDashboard = wrapped;
    }

    if(typeof renderDebts === 'function' && !renderDebts.__bsSectionStandardV276){
      const original = renderDebts;
      const wrapped = function(...args){
        const result = original.apply(this,args);
        updateDebtKpis();
        if(!usesSharedCreditRenderer) renderCreditCards();
        return result;
      };
      wrapped.__bsSectionStandardV276 = true;
      renderDebts = wrapped;
    }
  }

  function install(){
    if(
      typeof normalizeDebt !== 'function'
      || typeof renderDebts !== 'function'
      || typeof renderDashboard !== 'function'
      || !document.getElementById('creditCards')
    ){
      setTimeout(install,80);
      return;
    }

    ensureCreditKpis();
    usesSharedCreditRenderer = typeof window.bsSetCreditCardRendererV286 === 'function'
      && window.bsSetCreditCardRendererV286(renderCreditCards) === true;
    if(!usesSharedCreditRenderer) bindCreditFilters();
    installRenderHooks();

    removeDashboardAttention();
    updateDebtKpis();
    renderCreditCards();
  }

  install();
})();