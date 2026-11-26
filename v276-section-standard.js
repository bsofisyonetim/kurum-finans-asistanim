/* BS OFİS BÜTÇE V2.7.7 - Özet sadeleştirme ve sekmeler arası görsel kart standardı */
(() => {
  if(window.__bsSectionStandardV276Loaded) return;
  window.__bsSectionStandardV276Loaded = true;

  const EPS = .005;
  let creditQuickMode = 'active';

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
    const today = todayISO();
    const nextMonth = nextMonthStart();
    const active = state.debts
      .map(normalizeDebt)
      .filter(d => d.status === 'active' && !isVariableCard(d));

    return {
      active,
      open:active.filter(d => !!d.dueDate && d.dueDate < nextMonth),
      month:active.filter(d => !!d.dueDate && d.dueDate.startsWith(current)),
      overdue:active.filter(d => !!d.dueDate && d.dueDate < today)
    };
  }

  function fixedOverdueMetrics(list){
    let count = 0;
    let total = 0;

    list.forEach(d => {
      if(typeof window.bsDebtOverdueSummary === 'function'){
        try{
          const summary = window.bsDebtOverdueSummary(d);
          if(summary?.count > 0){
            count += summary.count;
            total += Math.max(0,+summary.total || 0);
            return;
          }
        }catch(_error){}
      }
      count += 1;
      total += fixedRemaining(d);
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

  function ensureStyles(){
    if(document.getElementById('bsSectionStandardV276Style')) return;
    const style = document.createElement('style');
    style.id = 'bsSectionStandardV276Style';
    style.textContent = `
      #creditCards #v276CreditCardKpis{margin-bottom:14px}

      #creditCards #creditCardList .bs-v276-cc-card{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        align-items:start!important;
        gap:8px 12px!important;
        padding:14px 15px!important;
      }
      #creditCards #creditCardList .bs-v276-cc-main{min-width:0}
      #creditCards #creditCardList .bs-v276-cc-name{
        display:block;
        color:#172033;
        font-size:16px;
        line-height:1.2;
        font-weight:850;
        letter-spacing:-.02em;
      }
      #creditCards #creditCardList .bs-v276-cc-meta{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:4px 7px;
        margin-top:5px;
        color:#748198;
        font-size:11px!important;
        line-height:1.25!important;
      }
      #creditCards #creditCardList .bs-v276-cc-amount{
        min-width:105px;
        text-align:right;
        white-space:nowrap;
      }
      #creditCards #creditCardList .bs-v276-cc-amount strong{
        display:block;
        color:#172033;
        font-size:20px;
        line-height:1.05;
        font-weight:850;
      }
      #creditCards #creditCardList .bs-v276-cc-amount small{
        display:block;
        margin-top:5px;
        color:#64748B!important;
        font-size:9.5px!important;
        line-height:1.15!important;
        font-weight:700!important;
      }
      #creditCards #creditCardList .bs-v276-cc-status,
      #creditCards #creditCardList .bs-v276-cc-summary{
        grid-column:1/-1;
      }
      #creditCards #creditCardList .bs-v276-cc-status{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:6px;
        color:#748198;
        font-size:10.5px;
        line-height:1.2;
      }
      #creditCards #creditCardList .bs-v276-pill{
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
      #creditCards #creditCardList .bs-v276-pill.green{
        border-color:#BBF7D0;
        background:#F0FDF4;
        color:#15803D;
      }
      #creditCards #creditCardList .bs-v276-pill.orange{
        border-color:#FED7AA;
        background:#FFF7ED;
        color:#C2410C;
      }
      #creditCards #creditCardList .bs-v276-pill.red{
        border-color:#FECACA;
        background:#FFF1F2;
        color:#DC2626;
      }
      #creditCards #creditCardList .bs-v276-cc-summary{
        display:flex;
        flex-wrap:wrap;
        gap:4px 8px;
        padding-top:2px;
        color:#748198;
        font-size:10.5px;
        line-height:1.3;
      }
      #creditCards #creditCardList .bs-v276-cc-summary strong{
        color:#4C5B72;
        font-weight:800;
      }

      /* V2.7.7: Kredi Kartları sekmesi, Borçlar ile aynı görsel standardı kullanır. */
      #creditCards .page-title{
        margin:7px 2px 13px!important;
        min-height:50px!important;
      }
      #creditCards .page-title .eyebrow{
        margin-bottom:4px!important;
        color:#0f8f83!important;
        font-size:9px!important;
        font-weight:850!important;
        letter-spacing:.14em!important;
      }
      #creditCards .page-title h2{
        font-size:26px!important;
        line-height:1.02!important;
        font-weight:860!important;
        letter-spacing:-.04em!important;
      }
      #creditCards #addCreditCardBtn{
        min-height:36px!important;
        padding:8px 12px!important;
        border-radius:11px!important;
        box-shadow:0 3px 9px rgba(37,99,235,.15)!important;
      }

      #creditCards #v276CreditCardKpis{
        gap:8px!important;
        margin:0 0 12px!important;
      }
      #creditCards #v276CreditCardKpis .v175-quick-card{
        position:relative!important;
        overflow:hidden!important;
        min-height:74px!important;
        padding:10px 9px!important;
        border-radius:15px!important;
        background:#fff!important;
        box-shadow:0 2px 8px rgba(15,23,42,.028)!important;
        text-align:left!important;
        align-content:center!important;
        gap:3px!important;
      }
      #creditCards #v276CreditCardKpis .v175-quick-card span{
        font-size:8.5px!important;
        line-height:1.1!important;
        font-weight:850!important;
        letter-spacing:.045em!important;
        color:#6b7a90!important;
      }
      #creditCards #v276CreditCardKpis .v175-quick-card strong{
        font-size:19px!important;
        line-height:1.08!important;
        font-weight:870!important;
        letter-spacing:-.035em!important;
        color:#172033!important;
      }
      #creditCards #v276CreditCardKpis .v175-quick-card small{
        font-size:8.5px!important;
        line-height:1.15!important;
        font-weight:700!important;
        color:#8592a6!important;
      }

      #creditCards [data-credit-quick="active"]{
        border-color:#c7eee7!important;
        border-top:3px solid #14b8a6!important;
      }
      #creditCards [data-credit-quick="month"]{
        border-color:#d6e3ff!important;
        border-top:3px solid #2563eb!important;
      }
      #creditCards [data-credit-quick="overdue"]{
        border-color:#fbd5d8!important;
        border-top:3px solid #ef4444!important;
      }
      #creditCards [data-credit-quick="active"] strong{color:#0f8f83!important}
      #creditCards [data-credit-quick="month"] strong{color:#2563eb!important}
      #creditCards [data-credit-quick="overdue"] strong{color:#dc2626!important}

      #creditCards [data-credit-quick="active"].active{
        border-color:#91DED3!important;
        border-top-color:#14B8A6!important;
        background:linear-gradient(180deg,#F7FFFD 0%,#EDFCF9 100%)!important;
        box-shadow:0 0 0 2px rgba(20,184,166,.10),0 4px 12px rgba(20,184,166,.06)!important;
      }
      #creditCards [data-credit-quick="month"].active{
        border-color:#9FBCFF!important;
        border-top-color:#2563EB!important;
        background:linear-gradient(180deg,#F8FBFF 0%,#F2F7FF 100%)!important;
        box-shadow:0 0 0 2px rgba(37,99,235,.10),0 4px 12px rgba(37,99,235,.06)!important;
      }
      #creditCards [data-credit-quick="overdue"].active{
        border-color:#F5A5AB!important;
        border-top-color:#EF4444!important;
        background:linear-gradient(180deg,#FFF9F9 0%,#FFF2F3 100%)!important;
        box-shadow:0 0 0 2px rgba(239,68,68,.09),0 4px 12px rgba(239,68,68,.055)!important;
      }
      #creditCards [data-credit-quick="active"].active span,
      #creditCards [data-credit-quick="active"].active strong,
      #creditCards [data-credit-quick="active"].active small{color:#0F8F83!important}
      #creditCards [data-credit-quick="month"].active span,
      #creditCards [data-credit-quick="month"].active strong,
      #creditCards [data-credit-quick="month"].active small{color:#2563EB!important}
      #creditCards [data-credit-quick="overdue"].active span,
      #creditCards [data-credit-quick="overdue"].active strong,
      #creditCards [data-credit-quick="overdue"].active small{color:#DC2626!important}

      #creditCards .debt-toolbar{
        gap:8px!important;
        margin:0 0 12px!important;
      }
      #creditCards .debt-toolbar input,
      #creditCards .debt-toolbar select{
        min-height:43px!important;
        padding:9px 11px!important;
        border-radius:12px!important;
        border-color:#d9e1eb!important;
        font-size:12px!important;
        background:#fff!important;
      }
      #creditCards #creditCardSearch{
        font-size:13px!important;
      }
      #creditCards #creditCardSearch::placeholder{
        color:#9aa6b6!important;
      }

      #creditCards #creditCardList{
        gap:8px!important;
      }
      #creditCards #creditCardList .list-card{
        min-height:72px!important;
        padding:12px 13px!important;
        border-radius:15px!important;
        border:1px solid #e2e8f0!important;
        background:#fff!important;
        box-shadow:none!important;
        overflow:hidden!important;
      }
      #creditCards #creditCardList .list-card.debt-owner-basak{
        border-left:3px solid #EC4899!important;
      }
      #creditCards #creditCardList .list-card.debt-owner-suleyman{
        border-left:3px solid #2563EB!important;
      }
      #creditCards #creditCardList .list-card.debt-owner-kurum{
        border-left:3px solid #14B8A6!important;
      }
      #creditCards #creditCardList .bs-v276-cc-main{
        gap:4px!important;
        min-width:0!important;
      }
      #creditCards #creditCardList .bs-v276-cc-name{
        color:#172033!important;
        font-size:13px!important;
        line-height:1.23!important;
        font-weight:820!important;
        letter-spacing:-.018em!important;
      }
      #creditCards #creditCardList .bs-v276-cc-meta{
        margin-top:4px!important;
        color:#738197!important;
        font-size:9px!important;
        line-height:1.3!important;
      }
      #creditCards #creditCardList .bs-v276-cc-amount{
        min-width:auto!important;
        color:#172033!important;
        font-size:14px!important;
        line-height:1.15!important;
        font-weight:870!important;
        letter-spacing:-.025em!important;
      }
      #creditCards #creditCardList .bs-v276-cc-amount strong{
        color:#172033!important;
        font-size:14px!important;
        line-height:1.15!important;
        font-weight:870!important;
        letter-spacing:-.025em!important;
      }
      #creditCards #creditCardList .bs-v276-cc-amount small{
        margin-top:3px!important;
        color:#7c899b!important;
        font-size:8.5px!important;
        font-weight:650!important;
      }
      #creditCards #creditCardList .bs-v276-cc-status{
        gap:6px!important;
        color:#738197!important;
        font-size:9px!important;
        line-height:1.3!important;
      }
      #creditCards #creditCardList .bs-v276-pill{
        min-height:19px!important;
        padding:3px 7px!important;
        font-size:8.5px!important;
      }
      #creditCards #creditCardList .bs-v276-cc-summary{
        gap:3px 7px!important;
        padding-top:0!important;
        color:#738197!important;
        font-size:9px!important;
        line-height:1.3!important;
      }
      #creditCards #creditCardList .bs-v276-cc-summary strong{
        color:#4C5B72!important;
        font-weight:800!important;
      }
      #creditCards #creditCardList .list-card.clickable:active{
        transform:scale(.995)!important;
      }

      @media(max-width:520px){
        #creditCards .page-title{
          margin-bottom:11px!important;
        }
        #creditCards .page-title h2{
          font-size:24px!important;
        }
        #creditCards #v276CreditCardKpis{
          gap:7px!important;
        }
        #creditCards #v276CreditCardKpis .v175-quick-card{
          min-height:70px!important;
          padding:9px 8px!important;
        }
        #creditCards #v276CreditCardKpis .v175-quick-card strong{
          font-size:17px!important;
        }
        #creditCards #v276CreditCardKpis .v175-quick-card span,
        #creditCards #v276CreditCardKpis .v175-quick-card small{
          font-size:8px!important;
        }
        #creditCards #creditCardList .list-card{
          min-height:70px!important;
          padding:11px 12px!important;
        }
        #creditCards #creditCardList .bs-v276-cc-name{
          font-size:12.5px!important;
        }
        #creditCards #creditCardList .bs-v276-cc-amount strong{
          font-size:13.5px!important;
        }
      }

      @media(max-width:520px){
        #creditCards #creditCardList .bs-v276-cc-card{
          gap:7px 9px!important;
          padding:13px!important;
        }
        #creditCards #creditCardList .bs-v276-cc-name{font-size:15px}
        #creditCards #creditCardList .bs-v276-cc-amount{min-width:92px}
        #creditCards #creditCardList .bs-v276-cc-amount strong{font-size:18px}
        #creditCards #creditCardList .bs-v276-cc-summary{font-size:9.8px}
      }
    `;
    document.head.appendChild(style);
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
    ensureStyles();
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
        renderCreditCards();
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

    ensureStyles();
    ensureCreditKpis();
    bindCreditFilters();
    installRenderHooks();

    removeDashboardAttention();
    updateDebtKpis();
    renderCreditCards();
  }

  install();
})();