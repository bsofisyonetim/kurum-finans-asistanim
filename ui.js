/* BS OFİS BÜTÇE V2.7.1 - Sade arayüz davranış katmanı
   Marka, tipografi ve görsel stiller CSS dosyalarında yönetilir. */
(() => {
  if(window.__bsCurrentUiLoaded) return;
  window.__bsCurrentUiLoaded = true;

  const ICONS = {
    income:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M8.7 10h4.7a2 2 0 0 1 0 4h-2.8a2 2 0 0 0 0 4H16"/></svg>',
    due:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M7 11h10M8 15h3"/></svg>',
    paid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.1 2.4 2.4 5.3-5.4"/></svg>',
    remaining:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10M7 20h10M8 4c0 4 8 4 8 8s-8 4-8 8"/></svg>',
    sort:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h12M4 12h8M4 17h4"/><path d="m17 15 3 3 3-3"/></svg>'
  };

  function ensureCompatibilityMarker(){
    if(document.querySelector('#bsCurrentUiStyles')) return;
    const marker = document.createElement('style');
    marker.id = 'bsCurrentUiStyles';
    marker.dataset.compatMarker = 'v271';
    document.head.appendChild(marker);
  }

  function installFastDashboardPaint(){
    if(document.getElementById('bsFastDashboardPaintV271')) return;
    const style = document.createElement('style');
    style.id = 'bsFastDashboardPaintV271';
    style.textContent = `
      html.bs-finance-refresh-pending body #dashboard #totalDebt,
      html.bs-finance-refresh-pending body #dashboard #monthOut,
      html.bs-finance-refresh-pending body #dashboard #monthPaid,
      html.bs-finance-refresh-pending body #dashboard #monthRemaining,
      html.bs-finance-refresh-pending body #dashboard #v177NetCash,
      html.bs-finance-refresh-pending body #dashboard #v177Income,
      html.bs-finance-refresh-pending body #dashboard #v177Payments,
      html.bs-finance-refresh-pending body #dashboard #v177Expenses{
        opacity:1!important;
      }
    `;
    document.head.appendChild(style);
  }

  function upgradeSummaryCards(){
    const cards = [...document.querySelectorAll('#dashboard .summary-grid .summary-card')];
    const kinds = ['income','due','paid','remaining'];

    cards.forEach((card,index) => {
      if(card.querySelector('.bs-summary-head')) return;

      const label = card.querySelector(':scope > span');
      if(!label) return;

      const head = document.createElement('div');
      head.className = 'bs-summary-head';
      head.innerHTML = `<span class="bs-summary-icon" aria-hidden="true">${ICONS[kinds[index]] || ICONS.income}</span><span class="bs-summary-label">${label.textContent}</span>`;
      label.replaceWith(head);
    });
  }

  function reorderDashboard(){
    const summary = document.querySelector('#dashboard .summary-grid');
    const quick = document.querySelector('#v178QuickActions');
    const panel = document.querySelector('#v177DashboardPanel');
    if(!summary || !quick || !panel) return;

    if(summary.nextElementSibling !== quick){
      summary.insertAdjacentElement('afterend',quick);
    }
    if(quick.nextElementSibling !== panel){
      quick.insertAdjacentElement('afterend',panel);
    }
  }

  function applyExpenseUx(){
    const netCashLabel = document.querySelector('#v177BalanceCard .v177-balance-main > span');
    if(netCashLabel){
      netCashLabel.textContent = 'BU AY NET NAKİT AKIŞI';
    }

    const expenseFlow = document.querySelector('[data-v177-flow="expenses"]');
    if(expenseFlow){
      expenseFlow.title = 'Harcamaları görüntüle';
      expenseFlow.setAttribute('aria-label','Bu ayın harcamalarını görüntüle');
    }

    const expenseCount = document.querySelector('#v177ExpenseCount');
    if(expenseCount){
      const base = expenseCount.textContent
        .replace(/\s*·\s*Aç\s*›?\s*$/u,'')
        .trim();
      expenseCount.textContent = `${base} · Aç ›`;
    }
  }

  function calendarGroupHtml(title,items){
    if(!items.length) return '';
    const total = items.reduce((sum,item) => sum + (+item.amount || 0),0);
    return `
      <div class="v175-calendar-group">
        <strong>${esc(title)}</strong>
        <small>${items.length} kayıt · ${money(total)}</small>
      </div>
      ${items.map(dueCard).join('')}
    `;
  }

  function sortCalendarItems(items,mode){
    const list = [...items];
    if(mode === 'amount'){
      return list.sort((a,b) => (+b.amount || 0) - (+a.amount || 0) || a.days - b.days);
    }
    return list.sort((a,b) => a.days - b.days || (+b.amount || 0) - (+a.amount || 0));
  }

  function applyCalendarSort(){
    const list = document.querySelector('#calendarList');
    if(!list || typeof dueItems !== 'function' || typeof dueCard !== 'function') return;

    const activeMode = document.querySelector('[data-calendar-quick].active')?.dataset.calendarQuick || 'all';
    const sortMode = document.querySelector('#bsCalendarSortSelect')?.value || 'due';
    const due = dueItems();

    let filtered = due;
    if(activeMode === 'overdue') filtered = due.filter(item => item.days < 0);
    if(activeMode === 'week') filtered = due.filter(item => item.days >= 0 && item.days <= 7);
    if(!filtered.length) return;

    const overdue = sortCalendarItems(filtered.filter(item => item.days < 0),sortMode);
    const today = sortCalendarItems(filtered.filter(item => item.days === 0),sortMode);
    const week = sortCalendarItems(filtered.filter(item => item.days > 0 && item.days <= 7),sortMode);
    const later = sortCalendarItems(filtered.filter(item => item.days > 7),sortMode);

    list.innerHTML =
      calendarGroupHtml('Geciken',overdue) +
      calendarGroupHtml('Bugün',today) +
      calendarGroupHtml('Önümüzdeki 7 Gün',week) +
      calendarGroupHtml('Daha Sonra',later);
  }

  function ensureCalendarSort(){
    const calendar = document.querySelector('#calendar');
    const kpis = document.querySelector('#v175CalendarKpis');
    if(!calendar || !kpis) return null;

    let wrap = document.querySelector('#bsCalendarSort');
    if(wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'bsCalendarSort';
    wrap.className = 'bs-calendar-sort';
    wrap.innerHTML = `
      <label>
        <span class="bs-calendar-sort-icon" aria-hidden="true">${ICONS.sort}</span>
        <span class="bs-calendar-sort-copy">
          <small>Sırala</small>
          <select id="bsCalendarSortSelect" aria-label="Takvim sıralaması">
            <option value="due">Vade Tarihine Göre</option>
            <option value="amount">Tutara Göre</option>
          </select>
        </span>
      </label>
    `;
    kpis.insertAdjacentElement('afterend',wrap);
    wrap.querySelector('select')?.addEventListener('change',applyCalendarSort);
    return wrap;
  }

  function installCreditCardCompact(){
    if(
      typeof debtCard !== 'function' ||
      typeof normalizeDebt !== 'function' ||
      typeof window.bsCreditCardSnapshot !== 'function' ||
      typeof window.bsIsCreditCardDebt !== 'function'
    ){
      setTimeout(installCreditCardCompact,100);
      return;
    }

    if(debtCard.__bsV271CreditCardCompact) return;

    if(!document.getElementById('bsCreditCardCompactV271Style')){
      const style = document.createElement('style');
      style.id = 'bsCreditCardCompactV271Style';
      style.textContent = `
        #debts #debtList .bs-cc-card-v271{
          display:grid!important;
          grid-template-columns:minmax(0,1fr) auto!important;
          gap:7px 12px!important;
          align-items:start!important;
          min-height:0!important;
          padding:13px 14px!important;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-main-v271{min-width:0}
        #debts #debtList .bs-cc-card-v271 .bs-cc-name-v271{
          display:block;
          color:#172033;
          font-size:16px;
          line-height:1.18;
          font-weight:850;
          letter-spacing:-.02em;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-meta-v271{
          display:flex;
          align-items:center;
          flex-wrap:wrap;
          gap:2px 6px;
          margin-top:5px;
          color:#748198;
          font-size:11px!important;
          line-height:1.25!important;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-amount-v271{
          text-align:right;
          white-space:nowrap;
          font-size:20px!important;
          line-height:1.05!important;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-amount-v271 small{
          display:block;
          margin-top:5px!important;
          font-size:10px!important;
          font-weight:650!important;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-status-v271,
        #debts #debtList .bs-cc-card-v271 .bs-cc-finance-v271{
          grid-column:1/-1;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-status-v271{
          display:flex;
          align-items:center;
          gap:8px;
          min-width:0;
          color:#748198;
          font-size:10.5px;
          line-height:1.2;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-status-v271 .badge{
          flex:0 0 auto;
          margin:0!important;
          padding:5px 9px!important;
          font-size:10.5px!important;
          line-height:1!important;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-finance-v271{
          display:flex;
          flex-wrap:nowrap;
          align-items:center;
          gap:5px 8px;
          color:#748198;
          font-size:10.5px;
          line-height:1.2;
          white-space:nowrap;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-finance-v271 strong{
          color:#4c5b72;
          font-weight:780;
        }
        #debts #debtList .bs-cc-card-v271 .bs-cc-sep-v271{color:#c1c9d5}
        @media(max-width:390px){
          #debts #debtList .bs-cc-card-v271{gap:7px 8px!important;padding:12px!important}
          #debts #debtList .bs-cc-card-v271 .bs-cc-name-v271{font-size:15px}
          #debts #debtList .bs-cc-card-v271 .bs-cc-amount-v271{font-size:18px!important}
          #debts #debtList .bs-cc-card-v271 .bs-cc-finance-v271{font-size:9.6px;gap:4px 6px}
        }
      `;
      document.head.appendChild(style);
    }

    const original = debtCard;
    const compact = function(raw){
      const d = normalizeDebt(raw);
      if(!window.bsIsCreditCardDebt(d)) return original(raw);

      const s = window.bsCreditCardSnapshot(d);
      const owner = d.custom?.debt_owner || '';
      const dueText = d.dueDate
        ? parseDate(d.dueDate).toLocaleDateString('tr-TR')
        : 'tarih girilmedi';

      let lateDays = 0;
      if(s.overdue && d.dueDate){
        const today = parseDate(todayISO());
        const dueDate = parseDate(d.dueDate);
        lateDays = Math.max(1,Math.ceil((today-dueDate)/86400000));
      }

      let statusText = s.label;
      if(lateDays>0) statusText = `${lateDays} gün gecikti`;
      else if(statusText === 'Asgari ödendi · borç devrediyor') statusText = 'Asgari ödendi';

      let amountText = 'Ekstre yok';
      let amountLabel = 'bu ay ₺0';
      if(s.hasStatement && s.minimumRemaining > 0.005){
        amountText = money(s.minimumRemaining);
        amountLabel = 'kalan asgari';
      }else if(s.hasStatement && s.carryover > 0.005){
        amountText = money(s.carryover);
        amountLabel = 'devreden borç';
      }else if(s.hasStatement){
        amountText = money(0);
        amountLabel = 'ekstre ödendi';
      }

      const remainingLabel = s.carryover > 0.005 ? 'Devreden' : 'Kalan';
      const statusClass = s.badge || 'orange';

      return `
        <article class="list-card clickable bs-cc-card bs-cc-card-v271" data-debt="${esc(d.id)}">
          <div class="bs-cc-main-v271">
            <strong class="bs-cc-name-v271">${esc(d.name)}</strong>
            <small class="bs-cc-meta-v271">
              ${owner ? `<span>${esc(owner)}</span><span>·</span>` : ''}
              <span>Kredi Kartı</span><span>·</span><span>Değişken</span>
            </small>
          </div>
          <div class="amount bs-cc-amount-v271">
            ${amountText}
            <small>${esc(amountLabel)}</small>
          </div>
          <div class="bs-cc-status-v271">
            <span class="badge ${esc(statusClass)}">${esc(statusText)}</span>
            ${s.hasStatement ? `<span>Son ödeme ${esc(dueText)}</span>` : '<span>Ekstre bilgisi bekleniyor</span>'}
          </div>
          ${s.hasStatement ? `
            <div class="bs-cc-finance-v271">
              <span>Ekstre <strong>${money(s.statement)}</strong></span>
              <span class="bs-cc-sep-v271">·</span>
              <span>Ödenen <strong>${money(s.paid)}</strong></span>
              <span class="bs-cc-sep-v271">·</span>
              <span>${remainingLabel} <strong>${money(s.statementRemaining)}</strong></span>
            </div>
          ` : ''}
        </article>
      `;
    };

    compact.__bsV271CreditCardCompact = true;
    compact.__previous = original;
    debtCard = compact;

    if(typeof renderDebts === 'function') renderDebts();
  }

  function applyCurrentUi(){
    ensureCompatibilityMarker();
    installFastDashboardPaint();
    upgradeSummaryCards();
    reorderDashboard();
    applyExpenseUx();
    ensureCalendarSort();
    applyCalendarSort();
    installCreditCardCompact();

    if(typeof renderDashboard === 'function' && !renderDashboard.__bsV257UiWrapped){
      const original = renderDashboard;
      const wrapped = function(){
        original();
        upgradeSummaryCards();
        reorderDashboard();
        applyExpenseUx();
      };
      wrapped.__bsV257UiWrapped = true;
      renderDashboard = wrapped;
    }

    if(typeof renderCalendar === 'function' && !renderCalendar.__bsV257UiWrapped){
      const original = renderCalendar;
      const wrapped = function(){
        original();
        ensureCalendarSort();
        applyCalendarSort();
      };
      wrapped.__bsV257UiWrapped = true;
      renderCalendar = wrapped;
    }

    window.__bsCurrentUiReady = true;
  }

  applyCurrentUi();
})();
