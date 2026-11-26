/* BS OFİS BÜTÇE V2.7.5 - Kredi kartlarını ayrı görünümde yönet */
(() => {
  if(window.__bsCreditCardsViewV275Loaded) return;
  window.__bsCreditCardsViewV275Loaded = true;

  const VIEW = 'creditCards';
  const VARIABLE = 'Değişken';

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

  function renderCreditCards(){
    const section = ensureView();
    const list = section?.querySelector('#creditCardList');
    if(!list) return;

    const cards = cardList();
    list.innerHTML = cards.length
      ? cards.map(debtCard).join('')
      : empty('Aktif kredi kartı bulunmuyor.');

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

  function installRenderHooks(){
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
    ensureView();
    installNavIcon();
    installRenderHooks();

    renderDebts();
    renderCreditCards();
    if(typeof renderBottomNav === 'function') renderBottomNav();
    if(typeof renderMenuManager === 'function') renderMenuManager();
  }

  install();
})();