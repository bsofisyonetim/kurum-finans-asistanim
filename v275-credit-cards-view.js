/* BS OFİS BÜTÇE V2.7.5 - Kredi kartlarını ayrı görünümde yönet */
(() => {
  if(window.__bsCreditCardsViewV275Loaded) return;
  window.__bsCreditCardsViewV275Loaded = true;

  const VIEW = 'creditCards';
  const VARIABLE = 'Değişken';
  let finalCreditRenderer = null;
  // V286: the final renderer takes over the existing handlers and debt hook.
  window.bsSetCreditCardRendererV286 = renderer => {
    if(typeof renderer !== 'function') return false;
    finalCreditRenderer = renderer;
    return true;
  };

  function isVariableCard(raw){
    if(typeof window.bsIsCreditCardDebt === 'function'){
      try{return !!window.bsIsCreditCardDebt(raw);}catch(_error){}
    }
    const d = normalizeDebt(raw || {});
    return d.type === 'Kredi Kartı' && String(d.custom?.odeme_yapisi || '').trim() === VARIABLE;
  }

  function ensureView(){
    const section = document.getElementById(VIEW);
    if(!section) return null;
    if(section.dataset.bsCreditControlsBound !== '1'){
      const search = section.querySelector('#creditCardSearch');
      const owner = section.querySelector('#creditCardOwnerFilter');
      const add = section.querySelector('#addCreditCardBtn');
      search?.addEventListener('input',renderCreditCards);
      owner?.addEventListener('change',renderCreditCards);
      add?.addEventListener('click',() => {
        openRecordDialog('debts',{type:'Kredi Kartı',custom:{odeme_yapisi:VARIABLE}});
      });
      [search,owner,add].forEach(control=>{if(control) control.disabled=false;});
      section.dataset.bsCreditControlsBound = '1';
    }
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

    if(finalCreditRenderer){
      finalCreditRenderer();
    }else{
      const cards = cardList();
      list.innerHTML = cards.length
        ? cards.map(debtCard).join('')
        : empty('Aktif kredi kartı bulunmuyor.');
    }

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

    ensureView();
    installRenderHooks();

    renderDebts();
  }

  install();
})();