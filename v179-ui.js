/* BS OFİS BÜTÇE V2.7.8 - Detay kartları; özet ödeme planı kaldırıldı */
(() => {
  if(window.__bsOfisV179Loaded) return;
  window.__bsOfisV179Loaded = true;

  function ensureV179Styles(){
    if(document.querySelector('#v179Styles')) return;

    const style = document.createElement('style');
    style.id = 'v179Styles';
    style.textContent = `
      .topbar{
        border-bottom:1px solid rgba(229,233,242,.72);
      }
      .bottom-nav{
        box-shadow:0 -10px 30px rgba(20,33,61,.06);
      }
      .nav-btn span{
        min-width:38px;
        min-height:29px;
        display:grid;
        place-items:center;
        border-radius:10px;
        transition:background .15s ease,transform .15s ease;
      }
      .nav-btn.active span{
        background:#eef4ff;
      }
      .nav-btn:active span{
        transform:scale(.95);
      }
      .summary-card,.kpi,.v175-quick-card,.income-owner-kpi{
        box-shadow:0 5px 18px rgba(20,33,61,.045);
      }
      .list-card{
        position:relative;
        overflow:hidden;
        box-shadow:0 3px 13px rgba(20,33,61,.035);
        transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;
      }
      .list-card.clickable:active,.income-bs-card:active{
        transform:scale(.992);
      }
      .list-card.clickable:hover,.income-bs-card:hover{
        border-color:#cfd8ea;
        box-shadow:0 5px 18px rgba(20,33,61,.055);
      }
      .v179-status-overdue{border-left:3px solid var(--danger)}
      .v179-status-soon{border-left:3px solid var(--orange)}
      .v179-status-later{border-left:3px solid #9bb4e8}
      .v179-debt-closed{opacity:.78}
      .v179-payment-card{border-left:3px solid #8eb1ff}
      .v179-expense-card{border-left:3px solid #d8deea}
      dialog{
        border:1px solid rgba(229,233,242,.9);
      }
      #detailDialog .dialog-form{
        gap:13px;
      }
      .v179-detail-hero{
        border:1px solid var(--line);
        border-radius:16px;
        padding:14px 15px;
        background:#f8faff;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
      }
      .v179-detail-main{
        min-width:0;
        display:grid;
        gap:4px;
      }
      .v179-detail-main span{
        color:var(--muted);
        font-size:9px;
        font-weight:850;
        letter-spacing:.06em;
      }
      .v179-detail-main strong{
        font-size:24px;
        line-height:1.05;
        color:var(--ink);
      }
      .v179-detail-main small{
        color:var(--muted);
        font-size:10px;
        line-height:1.3;
      }
      .v179-detail-pill{
        flex:0 0 auto;
        border-radius:999px;
        padding:6px 9px;
        font-size:9px;
        font-weight:850;
        background:#eaf0ff;
        color:#315fc9;
        text-align:center;
      }
      .v179-detail-pill.overdue{background:#fdebec;color:var(--danger)}
      .v179-detail-pill.soon{background:#fff2dd;color:var(--orange)}
      .v179-detail-pill.closed{background:#e6f7ef;color:var(--success)}
      #detailDialog .detail-grid{
        border:1px solid var(--line);
        border-radius:14px;
        padding:4px 13px;
        background:var(--card);
      }
      #detailDialog .detail-row:last-child{border-bottom:0}
      #detailDialog .detail-actions [data-pay]{
        grid-column:1/-1;
        min-height:44px;
      }
      .v179-progress-card{
        appearance:none;
        width:100%;
        border:1px solid var(--line);
        background:var(--card);
        border-radius:15px;
        padding:12px 14px;
        display:grid;
        gap:8px;
        color:var(--ink);
        text-align:left;
        cursor:pointer;
        box-shadow:0 4px 15px rgba(20,33,61,.035);
        -webkit-tap-highlight-color:transparent;
        transition:transform .15s ease,border-color .15s ease;
      }
      .v179-progress-card:active{transform:scale(.992)}
      .v179-progress-card:hover{border-color:#c5d2eb}
      .v179-progress-head,.v179-progress-foot{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .v179-progress-head span{
        color:var(--muted);
        font-size:10px;
        font-weight:850;
        letter-spacing:.04em;
      }
      .v179-progress-head strong{
        font-size:12px;
        color:var(--accent);
      }
      .v179-progress-track{
        height:8px;
        border-radius:999px;
        overflow:hidden;
        background:#edf1f7;
      }
      .v179-progress-track span{
        display:block;
        width:0;
        height:100%;
        border-radius:inherit;
        background:linear-gradient(90deg,#246bfd,#6f98ff);
        transition:width .25s ease;
      }
      .v179-progress-foot span,.v179-progress-foot small{
        color:var(--muted);
        font-size:9px;
      }
      .v179-progress-foot strong{
        font-size:10px;
      }
      .v178-quick-btn[data-v178-action="income"] .v178-quick-icon{background:#e9f8f1;color:var(--success)}
      .v178-quick-btn[data-v178-action="payment"] .v178-quick-icon{background:#eef4ff;color:var(--accent)}
      .v178-quick-btn[data-v178-action="debt"] .v178-quick-icon{background:#fff2dd;color:var(--orange)}
      .v178-quick-btn[data-v178-action="expense"] .v178-quick-icon{background:#fdecee;color:var(--danger)}
      @media(max-width:380px){
        .v179-detail-hero{padding:12px}
        .v179-detail-main strong{font-size:21px}
        .v179-detail-pill{font-size:8px;padding:5px 7px}
      }
    `;
    document.head.appendChild(style);
  }

  function injectCardClass(html, className){
    return html.replace(
      'class="list-card clickable"',
      `class="list-card clickable ${className}"`
    );
  }

  const originalDueCardV179 = dueCard;
  dueCard = function(d){
    const className = d.days < 0
      ? 'v179-status-overdue'
      : d.days <= 7
        ? 'v179-status-soon'
        : 'v179-status-later';
    return injectCardClass(originalDueCardV179(d), className);
  };

  const originalDebtCardV179 = debtCard;
  debtCard = function(d){
    const className = d.status === 'closed'
      ? 'v179-debt-closed'
      : 'v179-debt-active';
    return injectCardClass(originalDebtCardV179(d), className);
  };

  const originalPaymentCardV179 = paymentCard;
  paymentCard = function(p){
    return injectCardClass(originalPaymentCardV179(p), 'v179-payment-card');
  };

  const originalExpenseCardV179 = expenseCard;
  expenseCard = function(x){
    return injectCardClass(originalExpenseCardV179(x), 'v179-expense-card');
  };

  function debtDueInfo(d){
    if(d.status === 'closed'){
      return {label:'Kapandı',className:'closed'};
    }
    if(!d.dueDate){
      return {label:'Vade yok',className:''};
    }

    const now = parseDate(todayISO());
    const due = parseDate(d.dueDate);
    const days = daysBetween(now,due);

    if(days < 0){
      return {label:`${Math.abs(days)} gün gecikti`,className:'overdue'};
    }
    if(days === 0){
      return {label:'Bugün',className:'soon'};
    }
    if(days <= 7){
      return {label:`${days} gün kaldı`,className:'soon'};
    }
    return {label:due.toLocaleDateString('tr-TR'),className:''};
  }

  function detailHero(module,record){
    if(module === 'debts'){
      const d = normalizeDebt(record);
      const due = debtDueInfo(d);
      const owner = d.custom?.debt_owner || '';
      const rem = d.custom?.remaining_installments;
      const meta = [
        owner,
        rem !== '' && rem != null ? `${fmt(rem)} taksit kaldı` : '',
        d.balance > 0 ? `Toplam kalan ${money(d.balance)}` : ''
      ].filter(Boolean).join(' · ');

      return `
        <section class="v179-detail-hero">
          <div class="v179-detail-main">
            <span>AYLIK / MEVCUT ÖDEME</span>
            <strong>${d.minimum > 0 ? money(d.minimum) : 'Tutar girilecek'}</strong>
            <small>${esc(meta || d.type)}</small>
          </div>
          <span class="v179-detail-pill ${due.className}">${esc(due.label)}</span>
        </section>
      `;
    }

    if(module === 'payments'){
      const p = normalizePayment(record);
      const debt = state.debts.map(normalizeDebt).find(d => d.id === p.debtId);
      return `
        <section class="v179-detail-hero">
          <div class="v179-detail-main">
            <span>BORÇ ÖDEMESİ</span>
            <strong>${money(p.amount)}</strong>
            <small>${esc(debt?.name || 'Silinmiş borç')}</small>
          </div>
          <span class="v179-detail-pill">${parseDate(p.date).toLocaleDateString('tr-TR')}</span>
        </section>
      `;
    }

    if(module === 'expenses'){
      const x = normalizeExpense(record);
      return `
        <section class="v179-detail-hero">
          <div class="v179-detail-main">
            <span>HARCAMA</span>
            <strong>${money(x.amount)}</strong>
            <small>${esc(x.category)} · ${esc(x.method)}</small>
          </div>
          <span class="v179-detail-pill">${parseDate(x.date).toLocaleDateString('tr-TR')}</span>
        </section>
      `;
    }

    return '';
  }

  const originalShowDetailV179 = showDetail;
  showDetail = function(module,record){
    originalShowDetailV179(module,record);

    const content = document.querySelector('#detailContent');
    const head = content?.querySelector('.dialog-head');
    if(!content || !head || content.querySelector('.v179-detail-hero')) return;

    const html = detailHero(module,record);
    if(html){
      head.insertAdjacentHTML('afterend',html);
    }
  };

  function ensureDebtProgress(){
    document.querySelector('#v179DebtProgress')?.remove();
    return null;
  }

  function updateDebtProgress(){
    document.querySelector('#v179DebtProgress')?.remove();
  }

  ensureV179Styles();
  ensureDebtProgress();
  updateDebtProgress();

  const originalRenderDashboardV179 = renderDashboard;
  renderDashboard = function(){
    originalRenderDashboardV179();
    ensureDebtProgress();
    updateDebtProgress();
  };

  // Kart sınıflarının hemen görünmesi için mevcut ekranları bir kez yenile.
  renderDebts();
  renderPayments();
  renderExpenses();
  renderCalendar();
})();