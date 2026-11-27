/* BS OFİS BÜTÇE V2.7.9 - Hızlı işlemler + rapor yükleme + startup gate */
(() => {
  function ensureV178Styles(){
    if(document.querySelector('#v178Styles')) return;

    const style = document.createElement('style');
    style.id = 'v178Styles';
    style.textContent = `
      .v178-quick-actions{
        margin:0 0 18px;
      }
      .v178-quick-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin:0 2px 8px;
      }
      .v178-quick-head strong{
        font-size:12px;
      }
      .v178-quick-head small{
        color:var(--muted);
        font-size:10px;
      }
      .v178-quick-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }
      .v178-quick-btn{
        appearance:none;
        border:1px solid var(--line);
        background:var(--card);
        color:var(--ink);
        border-radius:14px;
        min-height:72px;
        padding:10px 8px;
        display:grid;
        justify-items:center;
        align-content:center;
        gap:6px;
        text-align:left;
        cursor:pointer;
        box-shadow:0 4px 14px rgba(20,33,61,.035);
        -webkit-tap-highlight-color:transparent;
        transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease;
      }
      .v178-quick-btn:hover{
        border-color:#b9cbef;
        box-shadow:0 6px 18px rgba(20,33,61,.055);
      }
      .v178-quick-btn:active{
        transform:scale(.985);
        background:#f7f9fe;
      }
      .v178-quick-btn:focus-visible{
        outline:2px solid #8eb1ff;
        outline-offset:2px;
      }
      .v178-quick-icon{
        width:32px;
        height:32px;
        border-radius:10px;
        display:grid;
        place-items:center;
        background:#eef4ff;
        color:var(--accent);
      }
      .v178-quick-icon svg{
        width:19px;
        height:19px;
        display:block;
      }
      .v178-quick-label{
        font-size:10px;
        font-weight:800;
        line-height:1.15;
        text-align:center;
      }
      @media(max-width:520px){
        .v178-quick-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:8px;
        }
        .v178-quick-btn{
          min-height:58px;
          padding:10px 11px;
          grid-template-columns:34px minmax(0,1fr);
          align-items:center;
          align-content:center;
          justify-items:start;
          gap:9px;
        }
        .v178-quick-icon{
          width:32px;
          height:32px;
        }
        .v178-quick-label{
          text-align:left;
          font-size:11px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureQuickActions(){
    const dashboard = document.querySelector('#dashboard');
    const summary = dashboard?.querySelector('.summary-grid');
    if(!dashboard || !summary || document.querySelector('#v178QuickActions')) return;

    const wrap = document.createElement('section');
    wrap.id = 'v178QuickActions';
    wrap.className = 'v178-quick-actions';
    wrap.innerHTML = `
      <div class="v178-quick-head">
        <strong>Hızlı İşlemler</strong>
        <small>tek dokunuş</small>
      </div>
      <div class="v178-quick-grid">
        <button type="button" class="v178-quick-btn" data-v178-action="income" aria-label="Yeni gelir ekle">
          <span class="v178-quick-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7.5h16v10H4z"/><path d="M16.5 11.5h3.5"/><path d="M8 4.5v6"/><path d="m5.5 8 2.5 2.5L10.5 8"/>
            </svg>
          </span>
          <span class="v178-quick-label">Gelir Ekle</span>
        </button>
        <button type="button" class="v178-quick-btn" data-v178-action="payment" aria-label="Yeni borç ödemesi yap">
          <span class="v178-quick-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5"/>
            </svg>
          </span>
          <span class="v178-quick-label">Ödeme Yap</span>
        </button>
        <button type="button" class="v178-quick-btn" data-v178-action="debt" aria-label="Yeni borç ekle">
          <span class="v178-quick-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 4.5h12v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2z"/><path d="M9 9h6"/><path d="M9 13h4"/>
            </svg>
          </span>
          <span class="v178-quick-label">Borç Ekle</span>
        </button>
        <button type="button" class="v178-quick-btn" data-v178-action="expense" aria-label="Yeni harcama ekle">
          <span class="v178-quick-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7.5h16v10H4z"/><path d="M16.5 11.5h3.5"/><path d="M16 10v6"/><path d="m13.5 13.5 2.5 2.5 2.5-2.5"/>
            </svg>
          </span>
          <span class="v178-quick-label">Harcama Ekle</span>
        </button>
      </div>
    `;

    summary.insertAdjacentElement('afterend',wrap);

    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-v178-action]');
      if(!btn) return;

      const action = btn.dataset.v178Action;

      if(action === 'income'){
        openIncomeDialog();
        return;
      }

      if(action === 'payment'){
        if(!activeDebts().length){
          toast('Ödeme yapmak için önce aktif bir borç ekleyin.');
          return;
        }
        openRecordDialog('payments',{date:todayISO()});
        return;
      }

      if(action === 'debt'){
        openRecordDialog('debts');
        return;
      }

      if(action === 'expense'){
        openRecordDialog('expenses');
      }
    });
  }

  function loadScriptV2612(src,marker){
    return new Promise((resolve,reject) => {
      if(marker && window[marker]) return resolve();
      const selector = `script[data-v2612-src="${src}"]`;
      const existing = document.querySelector(selector);
      if(existing){
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',reject,{once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.dataset.v2612Src = src;
      script.addEventListener('load',resolve,{once:true});
      script.addEventListener('error',()=>reject(new Error(`${src} yüklenemedi`)),{once:true});
      document.body.appendChild(script);
    });
  }

  async function preloadReportModulesV2612(){
    try{
      await loadScriptV2612('./v244-monthly-report.js?v=289','__bsMonthlyReportV244Loaded');
      await loadScriptV2612('./v246-direct-pdf-report.js?v=290','__bsDirectPdfReportV246Loaded');
    }catch(error){
      console.error('V261.2 rapor ön yükleme hatası:',error);
    }
  }

  function loadCashFlowDetailV2611(){
    if(window.__bsCashFlowDetailV2611Loaded || document.querySelector('script[data-v2611-cash-flow]')) return;
    const script = document.createElement('script');
    script.src = './v2611-cash-flow-detail.js?v=2611';
    script.dataset.v2611CashFlow = '1';
    script.addEventListener('error',()=>console.error('V261.1 nakit akışı detay modülü yüklenemedi.'),{once:true});
    document.body.appendChild(script);
  }

  function startStartupGateV2613(){
    const root = document.documentElement;
    if(root.classList.contains('bs-startup-ready')) return;

    const started = performance.now();
    const NO_SESSION_GRACE_MS = 1200;
    const MAX_WAIT_MS = 4000;
    let timer = 0;

    const modernUiReady = () => !!(
      document.querySelector('#v178QuickActions') &&
      document.querySelector('#v244MonthlyReport') &&
      window.__bsCurrentUiReady === true &&
      window.__bsDirectPdfReportV246Loaded === true &&
      !root.classList.contains('bs-summary-engine-pending')
    );

    const cloudReady = () => {
      const configured = typeof cloud === 'object' && !!cloud?.url && !!cloud?.key;
      if(!configured) return true;

      const badge = document.querySelector('#syncBadge')?.textContent?.trim() || '';
      const elapsed = performance.now() - started;

      if(badge === 'Bulut') return true;
      if(badge === 'Giriş yok' && elapsed >= NO_SESSION_GRACE_MS) return true;
      return elapsed >= MAX_WAIT_MS;
    };

    const reveal = reason => {
      clearTimeout(timer);
      root.classList.add('bs-startup-ready');
      root.dataset.bsStartupReady = reason;
      try{performance.mark('bs-startup-ready');}catch(_error){}
    };

    const check = () => {
      const elapsed = performance.now() - started;

      if(modernUiReady() && cloudReady()){
        reveal('ready');
        return;
      }

      if(elapsed >= MAX_WAIT_MS && document.querySelector('#dashboard')){
        reveal('fallback');
        return;
      }

      timer = setTimeout(check,50);
    };

    check();
  }

  ensureV178Styles();
  ensureQuickActions();
  preloadReportModulesV2612();
  loadCashFlowDetailV2611();
  startStartupGateV2613();
})();
