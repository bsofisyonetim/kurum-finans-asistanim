/* BS OFİS BÜTÇE - Kısmi ödeme / taksit planı V4 */
(() => {
  // Dinamik UI modülleri paralel yüklenebildiği için bu modül en son devreye girer.
  if(!window.__bsOfisV179Loaded || !document.querySelector('#bsCurrentUiStyles')){
    if(!window.__bsPaymentPlanV3Waiting){
      window.__bsPaymentPlanV3Waiting=true;
      const retry=()=>{
        if(window.__bsOfisV179Loaded && document.querySelector('#bsCurrentUiStyles')){
          window.__bsPaymentPlanV3Waiting=false;
          const script=document.createElement('script');
          script.src='payment-plan.js?v=200&final=1';
          script.dataset.paymentPlanFinal='1';
          document.head.appendChild(script);
          return;
        }
        setTimeout(retry,80);
      };
      setTimeout(retry,80);
    }
    return;
  }

  if(window.__bsPaymentPlanV3Loaded) return;
  window.__bsPaymentPlanV3Loaded=true;

  const EPS=.005;
  const roundMoney=n=>Math.round((+n||0)*100)/100;

  function debtCustom(d){
    return {...(d?.custom||d?.ozel_alanlar||{})};
  }

  function installmentPaid(d){
    const x=normalizeDebt(d);
    return Math.max(0,+x.custom?.current_installment_paid||0);
  }

  function currentInstallmentRemaining(d){
    const x=normalizeDebt(d);
    const planned=Math.max(0,+x.minimum||0);
    if(planned<=0) return 0;
    return Math.max(0,roundMoney(planned-installmentPaid(x)));
  }

  window.currentInstallmentRemaining=currentInstallmentRemaining;

  // Sıradaki Ödemeler'de tam taksit yerine, kısmi ödeme sonrası gerçekten kalan tutarı göster.
  dueItems=function(){
    const now=parseDate(todayISO());

    return activeDebts()
      .filter(d=>d.dueDate)
      .map(d=>{
        const date=parseDate(d.dueDate);
        return {
          ...d,
          date,
          days:daysBetween(now,date),
          amount:currentInstallmentRemaining(d),
          installmentPaid:installmentPaid(d),
          installmentPlanned:+d.minimum||0
        };
      })
      .filter(d=>d.amount>EPS || (+d.minimum||0)<=0)
      .sort((a,b)=>a.date-b.date);
  };

  function ensureUpcomingPayStyles(){
    if(document.querySelector('#bsUpcomingPayStyles')) return;
    const style=document.createElement('style');
    style.id='bsUpcomingPayStyles';
    style.textContent=`
      #upcomingMini .amount .bs-upcoming-pay{
        appearance:none;
        display:block;
        margin:7px 0 0 auto;
        padding:6px 10px;
        border:1px solid #c7d8ff;
        border-radius:999px;
        background:#eff6ff;
        color:#2563eb;
        font:800 10px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      #upcomingMini .amount .bs-upcoming-pay:active{
        transform:scale(.97);
        background:#dfeaff;
      }
      #upcomingMini .amount .bs-upcoming-pay.partial{
        border-color:#f2d59e;
        background:#fff7e8;
        color:#c97800;
      }
      @media(max-width:520px){
        #upcomingMini .amount .bs-upcoming-pay{padding:6px 9px;font-size:9px}
      }
    `;
    document.head.appendChild(style);
  }

  const originalDueCardPaymentPlan=dueCard;
  dueCard=function(d){
    const html=originalDueCardPaymentPlan(d);
    if(!d?.id) return html;

    const template=document.createElement('template');
    template.innerHTML=html.trim();
    const card=template.content.firstElementChild;
    const amount=card?.querySelector('.amount');
    if(!card||!amount) return html;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className=`bs-upcoming-pay${(+d.installmentPaid||0)>EPS?' partial':''}`;
    btn.dataset.upcomingPay=d.id;
    btn.setAttribute('aria-label',`${d.name||'Borç'} için ödeme yap`);
    btn.textContent=(+d.installmentPaid||0)>EPS?'Kalanı Öde':'Öde';
    amount.appendChild(btn);

    return card.outerHTML;
  };

  function resolveLatestLocalPayment(debtId,paymentDate){
    for(let i=state.payments.length-1;i>=0;i--){
      const p=normalizePayment(state.payments[i]);
      if(p.debtId===debtId && p.date===paymentDate){
        return state.payments[i];
      }
    }
    return null;
  }

  function decoratePaymentRecord(paymentRecord,meta){
    if(!paymentRecord) return;
    const custom={...(paymentRecord.custom||paymentRecord.ozel_alanlar||{})};
    Object.assign(custom,meta,{payment_plan_v2:true,payment_plan_v3:true});
    paymentRecord.custom=custom;
  }

  // Bir ödeme, mevcut taksiti tamamen bitirmedikçe vade/taksit ilerlemez.
  applyPaymentPlan=function(raw,paymentDate,explicitAmount=null,paymentRecord=null){
    if(!raw) return raw;

    const before=normalizeDebt(raw);
    const custom=debtCustom(before);

    let rawPayment=paymentRecord;
    if(!rawPayment && explicitAmount==null){
      rawPayment=resolveLatestLocalPayment(before.id,paymentDate);
    }

    const amount=roundMoney(
      explicitAmount!=null
        ?explicitAmount
        :rawPayment
          ?normalizePayment(rawPayment).amount
          :0
    );

    if(amount<=0) return raw;

    let installment=Math.max(0,+before.minimum||0);
    let paidBefore=Math.max(0,+custom.current_installment_paid||0);
    let dueDate=before.dueDate||'';
    let left=amount;
    let completed=0;

    const remRaw=custom.remaining_installments;
    const hasRemainingCount=
      remRaw!=='' && remRaw!=null && !Number.isNaN(+remRaw);
    let remainingCount=hasRemainingCount?Math.max(0,+remRaw):null;

    const originalDueDate=dueDate;
    const originalInstallment=installment;
    const originalPaid=paidBefore;
    const originalRemaining=Math.max(0,roundMoney(installment-paidBefore));

    if(installment>EPS){
      let guard=0;
      while(left>EPS && guard<120){
        guard++;

        const dueNow=Math.max(0,roundMoney(installment-paidBefore));
        if(dueNow<=EPS){
          paidBefore=0;
        }else{
          const applied=Math.min(left,dueNow);
          paidBefore=roundMoney(paidBefore+applied);
          left=roundMoney(left-applied);

          if(paidBefore+EPS<installment){
            break;
          }
        }

        // Mevcut taksit tamamen ödendi.
        paidBefore=0;
        completed++;

        if(hasRemainingCount){
          remainingCount=Math.max(0,remainingCount-1);
          custom.remaining_installments=remainingCount;
        }

        if(before.frequency==='oneoff'){
          remainingCount=0;
          break;
        }

        if(hasRemainingCount && remainingCount<=0){
          break;
        }

        const next=+custom.next_payment_after_current||0;
        if(next>EPS){
          installment=roundMoney(next);
          delete custom.next_payment_after_current;
        }

        if(before.frequency==='monthly' && dueDate){
          dueDate=addMonths(parseDate(dueDate),1)
            .toISOString()
            .slice(0,10);
        }
      }
    }

    if(paidBefore>EPS){
      custom.current_installment_paid=roundMoney(paidBefore);
    }else{
      delete custom.current_installment_paid;
    }

    raw.minimum=installment;
    raw.dueDate=dueDate;
    raw.custom=custom;
    raw.updatedAt=new Date().toISOString();

    if(before.frequency==='oneoff' && completed>0){
      raw.status='closed';
    }else if(hasRemainingCount && remainingCount<=0){
      raw.status='closed';
    }else{
      raw.status='active';
    }

    const finalRemaining=
      raw.status==='closed'
        ?0
        :Math.max(0,roundMoney(installment-paidBefore));

    let paymentStatus='partial';
    if(completed>0 && paidBefore>EPS) paymentStatus='completed_plus_partial';
    else if(completed>0) paymentStatus='completed';

    decoratePaymentRecord(rawPayment,{
      payment_status:paymentStatus,
      installment_due_date:originalDueDate,
      installment_amount_at_payment:originalInstallment,
      installment_paid_before:originalPaid,
      installment_remaining_before:originalRemaining,
      installment_remaining_after:
        completed===0
          ?Math.max(0,roundMoney(originalRemaining-amount))
          :paymentStatus==='completed_plus_partial'
            ?finalRemaining
            :0,
      completed_installments:completed,
      unapplied_amount:Math.max(0,roundMoney(left))
    });

    return raw;
  };

  // Bulutta da aynı hesap kullanılır; ödeme ve borç planı birlikte güncellenir.
  payCloud=async function(debtId,amount,date,notes,custom){
    if(!session) return false;

    const currentRaw=state.debts.find(x=>normalizeDebt(x).id===debtId);
    if(!currentRaw) return false;

    const updatedDebt=clone(currentRaw);
    const payment=normalizePayment({
      id:uid(),
      debtId,
      amount:+amount||0,
      date,
      notes:notes||'',
      custom:custom||{},
      addedBy:deviceName(),
      createdAt:new Date().toISOString()
    });

    applyPaymentPlan(updatedDebt,date,payment.amount,payment);

    try{
      await cloudUpsertPayment(payment);
      try{
        await cloudUpsertDebt(normalizeDebt(updatedDebt));
      }catch(e){
        try{await deleteCloud('odemeler',payment.id);}catch(_rollbackError){}
        throw e;
      }
      await pullCloud();
      return true;
    }catch(e){
      alert(`Ödeme kaydedilemedi: ${e.message}`);
      throw e;
    }
  };

  const originalPaymentCard=paymentCard;
  paymentCard=function(p){
    const x=normalizePayment(p);
    const meta=x.custom||{};
    if(!meta.payment_plan_v2 && !meta.payment_plan_v3) return originalPaymentCard(x);

    const d=state.debts.map(normalizeDebt).find(v=>v.id===x.debtId);
    const status=meta.payment_status;

    let statusHtml='';
    if(status==='partial'){
      statusHtml='<span class="badge orange">Kısmi ödeme</span>';
    }else if(status==='completed_plus_partial'){
      statusHtml='<span class="badge green">Taksit ödendi + sonraki taksite aktarıldı</span>';
    }else if(status==='completed'){
      statusHtml='<span class="badge green">Taksit ödendi</span>';
    }

    let secondLine='';
    if(status==='partial'){
      secondLine=`<small>${statusHtml} · Taksitte kalan ${money(meta.installment_remaining_after||0)}</small>`;
    }else if(status==='completed_plus_partial'){
      secondLine=`<small>${statusHtml} · Sonraki taksitte kalan ${money(meta.installment_remaining_after||0)}</small>`;
    }else if(status==='completed'){
      secondLine=`<small>${statusHtml}</small>`;
    }

    return `
      <article class="list-card clickable v179-payment-card" data-payment="${esc(x.id)}">
        <div class="main">
          <strong>${esc(d?.name||'Silinmiş borç')}</strong>
          <small>${parseDate(x.date).toLocaleDateString('tr-TR')}${x.addedBy?` · ${esc(x.addedBy)}`:''}</small>
          ${secondLine}
        </div>
        <div class="amount">${money(x.amount)}</div>
      </article>
    `;
  };

  const originalDebtCard=debtCard;
  debtCard=function(d){
    const x=normalizeDebt(d);
    const paid=installmentPaid(x);
    if(paid<=EPS) return originalDebtCard(x);

    const owner=x.custom?.debt_owner||'';
    const rem=x.custom?.remaining_installments;
    const left=rem!==''&&rem!=null?`${fmt(rem)} taksit`:'';
    const remaining=currentInstallmentRemaining(x);

    return `
      <article class="list-card clickable" data-debt="${x.id}">
        <div class="main">
          <strong>${esc(x.name)}</strong>
          <small>${owner?`${esc(owner)} · `:''}${esc(x.type)}${left?` · ${esc(left)}`:''} · <span class="badge orange">Kısmi</span></small>
          <small>${money(paid)} ödendi · bu taksitte ${money(remaining)} kaldı</small>
        </div>
        <div class="amount">
          ${remaining>0?money(remaining):'Tamamlandı'}
          <small>${x.dueDate?parseDate(x.dueDate).toLocaleDateString('tr-TR'):'Tarih girilmedi'}</small>
        </div>
      </article>
    `;
  };

  function enhancePaymentForm(){
    const form=document.querySelector('#recordForm');
    if(!form) return;
    const module=form.querySelector('[name="module"]')?.value;
    if(module!=='payments') return;

    const debtSelect=form.querySelector('[name="debtId"]');
    const amountInput=form.querySelector('[name="amount"]');
    if(!debtSelect||!amountInput) return;

    let hint=document.querySelector('#bsPartialPaymentHint');
    if(!hint){
      hint=document.createElement('div');
      hint.id='bsPartialPaymentHint';
      hint.style.cssText='margin:-5px 0 2px;padding:9px 10px;border-radius:11px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.35';
      amountInput.closest('label')?.insertAdjacentElement('afterend',hint);
    }

    const selectedDebt=()=>state.debts.map(normalizeDebt).find(x=>x.id===debtSelect.value);

    const suggestAmount=force=>{
      const d=selectedDebt();
      if(!d) return;
      const remaining=currentInstallmentRemaining(d);
      if(remaining<=EPS) return;
      if(force || !amountInput.value || +amountInput.value<=0){
        amountInput.value=String(remaining);
      }
    };

    const update=()=>{
      const d=selectedDebt();
      if(!d){hint.textContent='Ödeme yapılacak borcu seçin.';return;}

      const remaining=currentInstallmentRemaining(d);
      const paid=installmentPaid(d);
      const entered=Math.max(0,+amountInput.value||0);

      if((+d.minimum||0)<=0){
        hint.textContent='Bu borç için planlı taksit tutarı tanımlanmamış.';
        return;
      }

      if(entered<=0){
        hint.textContent=paid>0
          ?`Bu taksit ${money(d.minimum)} · daha önce ${money(paid)} ödendi · kalan ${money(remaining)}.`
          :`Bu taksit için kalan tutar ${money(remaining)}.`;
        return;
      }

      if(entered+EPS<remaining){
        hint.innerHTML=`<strong style="color:#c97800">Kısmi ödeme</strong> · Bu işlemden sonra aynı taksitte ${money(remaining-entered)} kalacak.`;
      }else if(Math.abs(entered-remaining)<=EPS){
        hint.innerHTML=`<strong style="color:#168a42">Taksit tamamlanacak</strong> · Sonraki vade ancak bu ödeme tamamlandıktan sonra açılacak.`;
      }else{
        hint.innerHTML=`<strong style="color:#2563eb">Fazla ödeme</strong> · Mevcut taksit kapanır; kalan ${money(entered-remaining)} sonraki taksite aktarılır.`;
      }
    };

    debtSelect.onchange=()=>{
      suggestAmount(true);
      update();
    };
    amountInput.oninput=update;

    suggestAmount(false);
    update();
  }

  if(typeof openRecordDialog==='function' && !openRecordDialog.__bsPartialWrapped){
    const originalOpenRecordDialog=openRecordDialog;
    const wrapped=function(module,record=null){
      originalOpenRecordDialog(module,record);
      if(module==='payments') setTimeout(enhancePaymentForm,0);
    };
    wrapped.__bsPartialWrapped=true;
    openRecordDialog=wrapped;
  }

  // Eski sistemde 12.08.2026 tarihinde yanlışlıkla tam taksit gibi ilerleyen
  // Vakıfbank Kredi Kartı ₺11.973 kaydını kontrollü ve idempotent şekilde onar.
  async function repairKnownLegacyPartial(){
    const rawPayment=state.payments.find(raw=>{
      const p=normalizePayment(raw);
      if(p.date!=='2026-08-12' || Math.abs(p.amount-11973)>EPS) return false;
      const d=state.debts.map(normalizeDebt).find(x=>x.id===p.debtId);
      return d?.name==='Vakıfbank Kredi Kartı';
    });
    if(!rawPayment) return false;

    const p=normalizePayment(rawPayment);
    if(p.custom?.legacy_partial_repaired_v3) return false;

    const rawDebt=state.debts.find(raw=>normalizeDebt(raw).id===p.debtId);
    if(!rawDebt) return false;

    const d=normalizeDebt(rawDebt);
    const custom=debtCustom(d);
    const planned=20326;
    const paid=11973;
    const remaining=8353;

    // Eski motor vade tarihini 10.09'a taşıdıysa bir ay geri al.
    if(d.dueDate==='2026-09-10'){
      rawDebt.dueDate='2026-08-10';
      const rem=custom.remaining_installments;
      if(rem!=='' && rem!=null && !Number.isNaN(+rem)){
        custom.remaining_installments=Math.max(0,+rem)+1;
      }
    }

    rawDebt.minimum=planned;
    rawDebt.status='active';
    custom.current_installment_paid=paid;
    custom.legacy_partial_repaired_v3=true;
    rawDebt.custom=custom;
    rawDebt.updatedAt=new Date().toISOString();

    decoratePaymentRecord(rawPayment,{
      payment_status:'partial',
      installment_due_date:'2026-08-10',
      installment_amount_at_payment:planned,
      installment_paid_before:0,
      installment_remaining_before:planned,
      installment_remaining_after:remaining,
      completed_installments:0,
      unapplied_amount:0,
      legacy_partial_repaired_v3:true
    });

    saveState(false);

    if(session){
      try{
        await cloudUpsertPayment(normalizePayment(rawPayment));
        await cloudUpsertDebt(normalizeDebt(rawDebt));
      }catch(e){
        console.warn('Kısmi ödeme eski kayıt bulut onarımı tamamlanamadı:',e);
      }
    }

    return true;
  }

  async function refreshAfterRepair(){
    const changed=await repairKnownLegacyPartial();
    if(changed){
      try{
        renderDashboard();
        renderDebts();
        renderPayments();
      }catch(_e){}
    }
  }

  ensureUpcomingPayStyles();
  setTimeout(enhancePaymentForm,0);
  setTimeout(refreshAfterRepair,0);

  // Yeni dueItems / Sıradaki Ödemeler görünümü ekrana hemen yansısın.
  try{
    renderDashboard();
    renderDebts();
    renderPayments();
  }catch(_e){}
})();