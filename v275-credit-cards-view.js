/* BS OFİS BÜTÇE V2.7.5 - Kredi kartlarını ayrı görünümde yönet */
(() => {
  if(window.__bsCreditCardsViewV275Loaded) return;
  window.__bsCreditCardsViewV275Loaded = true;

  const VIEW = 'creditCards';
  const VARIABLE = 'Değişken';
  const EPS = .005;
  let cardMode = 'all';

  function isVariableCard(raw){
    if(typeof window.bsIsCreditCardDebt === 'function'){
      try{return !!window.bsIsCreditCardDebt(raw);}catch(_error){}
    }
    const d = normalizeDebt(raw || {});
    return d.type === 'Kredi Kartı' && String(d.custom?.odeme_yapisi || '').trim() === VARIABLE;
  }

  function insertMenuItem(target){
    if(!Array.isArray(target)) return false;
    if(target.some(item => item?.view === VIEW)) return false;
    const item = {view:VIEW,label:'Kredi Kartları',icon:'▣',visible:true,locked:false};
    const debtIndex = target.findIndex(x => x?.view === 'debts');
    target.splice(debtIndex >= 0 ? debtIndex + 1 : target.length,0,item);
    return true;
  }

  function ensureMenu(){
    let changed = false;
    if(typeof defaultAppConfig === 'object' && defaultAppConfig){
      changed = insertMenuItem(defaultAppConfig.menus) || changed;
    }
    if(typeof appConfig === 'object' && appConfig){
      changed = insertMenuItem(appConfig.menus) || changed;
      if(changed && typeof saveAppConfig === 'function') saveAppConfig(false);
    }
  }

  function ensureStyle(){
    if(document.getElementById('bsCreditCardsViewV275Style')) return;
    const style=document.createElement('style');
    style.id='bsCreditCardsViewV275Style';
    style.textContent=`
      #dashboard #v177DashboardPanel{display:none!important}
      #dashboard .summary-grid .summary-card{min-height:0!important;padding:12px!important;gap:5px!important}
      #dashboard .summary-grid .summary-card strong{font-size:clamp(19px,5.2vw,26px)!important}
      #dashboard .summary-grid .summary-card small{font-size:11px!important;line-height:1.25!important}
      #dashboard .summary-card.bs-v276-expense strong{color:#dc2626!important}
      #dashboard .summary-card.bs-v276-net strong{color:#15803d!important}
      #dashboard .summary-card.bs-v276-net.negative strong{color:#dc2626!important}
      #dashboard #v244MonthlyReport{padding:10px 12px!important;gap:8px!important;margin:8px 0 12px!important}
      #dashboard #v244MonthlyReport .v244-report-copy small,
      #dashboard #v244MonthlyReport .v244-report-eyebrow{display:none!important}
      #dashboard #v244MonthlyReport .v244-report-title{font-size:15px!important}
      #creditCards #bsV276CardKpis{gap:8px;margin:0 0 12px}
      #creditCards #bsV276CardKpis .v175-quick-card{min-height:74px;padding:10px 9px;border-radius:15px;text-align:left;align-content:center;gap:3px;background:var(--card);border-top:3px solid var(--cc-accent)}
      #creditCards #bsV276CardKpis .v175-quick-card span{font-size:11px!important;line-height:1.15!important;white-space:normal}
      #creditCards #bsV276CardKpis .v175-quick-card strong{font-size:20px!important;color:var(--cc-accent)!important}
      #creditCards #bsV276CardKpis .v175-quick-card small{font-size:11px!important;white-space:normal;overflow-wrap:anywhere}
      #creditCards #bsV276CardKpis .active{border-color:var(--cc-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--cc-accent) 15%,transparent)}
      #creditCards [data-cc-mode="all"]{--cc-accent:#0f8f83}
      #creditCards [data-cc-mode="minimum"]{--cc-accent:#2563eb}
      #creditCards [data-cc-mode="overdue"]{--cc-accent:#dc2626}
      #creditCards #creditCardList .bs-v276-cc{display:block!important;min-height:0!important;padding:14px!important;border-left:3px solid var(--cc-owner,#94a3b8)}
      #creditCards .bs-v276-cc-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px}
      #creditCards .bs-v276-cc-name{display:grid;gap:3px;min-width:0;overflow-wrap:anywhere}
      #creditCards .bs-v276-cc-name strong{font-size:16px!important;line-height:1.2!important}
      #creditCards .bs-v276-cc-name small,#creditCards .bs-v276-cc-total small{color:var(--muted);font-size:12px!important}
      #creditCards .bs-v276-cc-total{text-align:right;display:grid;gap:3px;white-space:nowrap}
      #creditCards .bs-v276-cc-total strong{font-size:20px!important;font-variant-numeric:tabular-nums}
      #creditCards .bs-v276-cc-breakdown{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0;padding:10px 0;border-block:1px solid var(--line)}
      #creditCards .bs-v276-cc-breakdown div{display:grid;gap:3px;min-width:0}
      #creditCards .bs-v276-cc-breakdown small,#creditCards .bs-v276-cc-foot small{font-size:11px!important;color:var(--muted)}
      #creditCards .bs-v276-cc-breakdown strong{font-size:clamp(12px,3.7vw,15px)!important;white-space:nowrap;font-variant-numeric:tabular-nums}
      #creditCards .bs-v276-cc-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:7px}
      #creditCards .bs-v276-cc-foot .badge{white-space:normal}
      @media(max-width:520px){
        .app-shell > .bottom-nav .nav-btn{
          flex:1 1 0!important;
          min-width:52px!important;
          padding-left:2px!important;
          padding-right:2px!important;
        }
        .app-shell > .bottom-nav .nav-btn small{
          max-width:62px!important;
          font-size:8.5px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureView(){
    let section = document.getElementById(VIEW);
    if(section) return section;

    const main = document.getElementById('main');
    if(!main) return null;

    section = document.createElement('section');
    section.id = VIEW;
    section.className = 'view';
    section.innerHTML = `
      <div class="page-title">
        <div>
          <p class="eyebrow">KREDİ KARTLARI</p>
          <h2 id="creditCardsPageTitle">Kredi Kartları</h2>
        </div>
        <button id="addCreditCardBtn" class="primary small">＋ Kart</button>
      </div>
      <div id="bsV276CardKpis" class="v175-quick-grid" aria-label="Kredi kartı özeti">
        <button type="button" class="v175-quick-card" data-cc-mode="all"><span>KALAN EKSTRE</span><strong>₺0</strong><small>0 kart</small></button>
        <button type="button" class="v175-quick-card" data-cc-mode="minimum"><span>ASGARİ KALAN</span><strong>₺0</strong><small>0 kart</small></button>
        <button type="button" class="v175-quick-card" data-cc-mode="overdue"><span>GECİKEN ASGARİ</span><strong>₺0</strong><small>0 kart</small></button>
      </div>
      <div class="toolbar debt-toolbar">
        <input id="creditCardSearch" placeholder="Kart ara…" />
        <select id="creditCardOwnerFilter" aria-label="Kredi kartı sahibi">
          <option value="all">Herkes</option>
          <option value="Süleyman">Süleyman</option>
          <option value="Başak">Başak</option>
        </select>
      </div>
      <div id="creditCardList" class="list"></div>
    `;

    const debts = document.getElementById('debts');
    if(debts?.parentElement === main) debts.insertAdjacentElement('afterend',section);
    else main.appendChild(section);

    section.querySelector('#bsV276CardKpis')?.addEventListener('click',event => {
      const button = event.target.closest('[data-cc-mode]');
      if(!button) return;
      cardMode = button.dataset.ccMode;
      renderCreditCards();
    });
    section.querySelector('#creditCardSearch')?.addEventListener('input',renderCreditCards);
    section.querySelector('#creditCardOwnerFilter')?.addEventListener('change',renderCreditCards);
    section.querySelector('#addCreditCardBtn')?.addEventListener('click',() => {
      openRecordDialog('debts',{
        type:'Kredi Kartı',
        custom:{odeme_yapisi:VARIABLE}
      });
    });

    return section;
  }

  function cardList(){
    const section = ensureView();
    const q = String(section?.querySelector('#creditCardSearch')?.value || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    const owner = section?.querySelector('#creditCardOwnerFilter')?.value || 'all';

    return state.debts
      .map(normalizeDebt)
      .filter(isVariableCard)
      .filter(d => d.status === 'active')
      .filter(d => owner === 'all' || d.custom?.debt_owner === owner)
      .filter(d => !q || `${d.name} ${d.notes} ${JSON.stringify(d.custom)}`
        .toLocaleLowerCase('tr-TR')
        .includes(q))
      .sort((a,b) => {
        const ao = String(a.custom?.debt_owner || '');
        const bo = String(b.custom?.debt_owner || '');
        return ao.localeCompare(bo,'tr') || a.name.localeCompare(b.name,'tr');
      });
  }

  function snapshot(d){
    return typeof window.bsCreditCardSnapshot === 'function' ? window.bsCreditCardSnapshot(d) : null;
  }

  function renderStatementCard(d,s){
    if(!s) return debtCard(d);
    const owner = d.custom?.debt_owner || '';
    const color = owner === 'Başak' ? '#db4d91' : owner === 'Süleyman' ? '#2563eb' : '#94a3b8';
    const due = d.dueDate ? parseDate(d.dueDate).toLocaleDateString('tr-TR') : '—';
    const label = !s.hasStatement ? 'Ekstre bilgisi girin' : s.overdue ? 'Asgari gecikti' : s.statementRemaining <= EPS ? 'Ekstre ödendi' : s.minimumRemaining <= EPS ? 'Asgari ödendi' : 'Asgari bekleniyor';
    const val = n => s.hasStatement ? money(n) : '—';
    return `<article class="list-card clickable bs-cc-card bs-v276-cc" data-debt="${esc(d.id)}" style="--cc-owner:${color}">
      <div class="bs-v276-cc-head">
        <div class="bs-v276-cc-name"><strong>${esc(d.name)}</strong><small>${esc(owner || 'Kredi Kartı')}</small></div>
        <div class="bs-v276-cc-total"><strong>${val(s.statementRemaining)}</strong><small>${s.carryover > EPS ? 'devreden borç' : 'kalan ekstre'}</small></div>
      </div>
      <div class="bs-v276-cc-breakdown">
        <div><small>Ekstre</small><strong>${val(s.statement)}</strong></div>
        <div><small>Ödenen</small><strong>${val(s.paid)}</strong></div>
        <div><small>Asgari kalan</small><strong>${val(s.minimumRemaining)}</strong></div>
      </div>
      <div class="bs-v276-cc-foot"><span class="badge ${esc(s.badge)}">${esc(label)}</span><small>Son ödeme: ${esc(due)}</small></div>
    </article>`;
  }

  function renderCreditCards(){
    const section = ensureView();
    const list = section?.querySelector('#creditCardList');
    if(!list) return;

    const cards = cardList().map(d => ({d,s:snapshot(d)}));
    const known = cards.filter(x => x.s?.hasStatement);
    const modes = {
      all:{rows:cards,amount:known.reduce((sum,x)=>sum+x.s.statementRemaining,0)},
      minimum:{rows:known.filter(x=>x.s.minimumRemaining > EPS),amount:known.reduce((sum,x)=>sum+x.s.minimumRemaining,0)},
      overdue:{rows:known.filter(x=>x.s.overdue && x.s.minimumRemaining > EPS),amount:known.filter(x=>x.s.overdue).reduce((sum,x)=>sum+x.s.minimumRemaining,0)}
    };
    section.querySelectorAll('[data-cc-mode]').forEach(button => {
      const mode = button.dataset.ccMode;
      const info = modes[mode];
      button.querySelector('strong').textContent = mode === 'all' && cards.length && !known.length ? '—' : money(info.amount);
      button.querySelector('small').textContent = mode === 'all' && known.length !== cards.length
        ? `${known.length}/${cards.length} ekstreli` : `${info.rows.length} kart`;
      button.classList.toggle('active',mode === cardMode);
      button.setAttribute('aria-pressed',String(mode === cardMode));
    });
    const visible = modes[cardMode].rows;
    list.innerHTML = visible.length
      ? visible.map(x=>renderStatementCard(x.d,x.s)).join('')
      : empty(cardMode === 'overdue' ? 'Gecikmiş asgari ödeme yok.' : cardMode === 'minimum' ? 'Bekleyen asgari ödeme yok.' : 'Aktif kredi kartı bulunmuyor.');

    const title = section.querySelector('#creditCardsPageTitle');
    const menu = typeof menuItem === 'function' ? menuItem(VIEW) : null;
    if(title && menu?.label) title.textContent = menu.label;
  }

  function removeCardsFromDebtList(){
    const debtList = document.getElementById('debtList');
    if(!debtList) return;

    const ids = new Set(
      state.debts.map(normalizeDebt).filter(isVariableCard).map(d => String(d.id))
    );

    debtList.querySelectorAll('[data-debt]').forEach(card => {
      if(ids.has(String(card.dataset.debt || ''))) card.remove();
    });

    if(!debtList.querySelector('[data-debt]') && !debtList.querySelector('.empty')){
      debtList.innerHTML = empty('Bu filtrede borç kaydı bulunmuyor.');
    }
  }

  function installNavIcon(){
    if(typeof navIcon !== 'function' || navIcon.__bsCreditCardsViewV275) return;
    const original = navIcon;
    const wrapped = function(view){
      if(view === VIEW){
        return `
          <svg viewBox="0 0 24 24" width="21" height="21"
               fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="6" width="18" height="13" rx="2.5"/>
            <path d="M3 10h18"/>
            <path d="M7 15h4"/>
          </svg>`;
      }
      return original(view);
    };
    wrapped.__bsCreditCardsViewV275 = true;
    navIcon = wrapped;
  }

  function updateCompactDashboard(){
    const grid = document.querySelector('#dashboard .summary-grid');
    if(!grid) return;
    const specs = [
      {id:'bsV276Expense',cls:'expense',label:'Bu Ay Harcama',sub:'kaydedilen harcamalar',source:'#v177Expenses',target:'[data-v177-flow="expenses"]'},
      {id:'bsV276Net',cls:'net',label:'Net Nakit Akışı',sub:'gelir − ödemeler − harcamalar',source:'#v177NetCash',target:'#v177BalanceCard'}
    ];
    for(const spec of specs){
      let card = document.getElementById(spec.id);
      if(!card){
        card = document.createElement('article');
        card.id = spec.id;
        card.className = 'summary-card bs-v276-'+spec.cls;
        card.setAttribute('role','button');
        card.tabIndex=0;
        card.innerHTML = `<span>${spec.label}</span><strong>₺0</strong><small>${spec.sub}</small>`;
        const open = () => document.querySelector(spec.target)?.click();
        card.addEventListener('click',open);
        card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
        grid.appendChild(card);
      }
      const source = document.querySelector(spec.source);
      if(source) card.querySelector('strong').textContent = source.textContent;
      if(spec.cls==='net') card.classList.toggle('negative',!!document.querySelector('#v177BalanceCard.negative'));
    }
  }

  function installRenderHooks(){
    if(typeof renderDashboard === 'function' && !renderDashboard.__bsV276Compact){
      const original = renderDashboard;
      const wrapped = function(...args){
        const result = original.apply(this,args);
        updateCompactDashboard();
        return result;
      };
      wrapped.__bsV276Compact = true;
      renderDashboard = wrapped;
    }
    if(typeof renderDebts === 'function' && !renderDebts.__bsCreditCardsViewV275){
      const original = renderDebts;
      const wrapped = function(...args){
        const result = original.apply(this,args);
        removeCardsFromDebtList();
        renderCreditCards();
        return result;
      };
      wrapped.__bsCreditCardsViewV275 = true;
      renderDebts = wrapped;
    }

    if(typeof renderTitles === 'function' && !renderTitles.__bsCreditCardsViewV275){
      const original = renderTitles;
      const wrapped = function(...args){
        const result = original.apply(this,args);
        const title = document.getElementById('creditCardsPageTitle');
        const menu = typeof menuItem === 'function' ? menuItem(VIEW) : null;
        if(title && menu?.label) title.textContent = menu.label;
        return result;
      };
      wrapped.__bsCreditCardsViewV275 = true;
      renderTitles = wrapped;
    }
  }

  function install(){
    if(
      typeof normalizeDebt !== 'function' ||
      typeof debtCard !== 'function' ||
      typeof renderDebts !== 'function' ||
      typeof openRecordDialog !== 'function'
    ){
      setTimeout(install,80);
      return;
    }

    ensureMenu();
    ensureStyle();
    ensureView();
    installNavIcon();
    installRenderHooks();

    renderDebts();
    renderCreditCards();
    updateCompactDashboard();
    if(typeof renderBottomNav === 'function') renderBottomNav();
    if(typeof renderMenuManager === 'function') renderMenuManager();
  }

  install();
})();