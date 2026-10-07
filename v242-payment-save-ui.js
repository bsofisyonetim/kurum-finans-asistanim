/* BS OFİS BÜTÇE V2.4.2 / V2.7.4 - Ödeme kayıt durumu, modal güvenliği ve değişken kart ödeme UX */
(() => {
  if(window.__bsV242PaymentSaveUiLoaded) return;
  window.__bsV242PaymentSaveUiLoaded=true;

  const dialog=document.querySelector('#recordDialog');
  const form=document.querySelector('#recordForm');
  if(!dialog||!form) return;

  function submitButton(){return form.querySelector('button[type="submit"]');}

  function resetSubmitButton(){
    const button=submitButton();
    if(!button) return;
    button.disabled=false;
    button.textContent='Kaydet';
  }

  function currentEdit(){
    const module=form.querySelector('[name="module"]')?.value;
    const id=form.querySelector('[name="id"]')?.value;
    if(!dialog.open||module!=='payments'||!id) return null;
    const target=state.payments.map(normalizePayment).find(p=>p.id===id);
    if(!target) return null;
    const amount=Number(form.querySelector('[name="amount"]')?.value||0);
    const date=String(form.querySelector('[name="date"]')?.value||'');
    return {id,target,amount,date};
  }

  function isSameEffectPaymentEdit(payment){
    const edit=currentEdit();
    if(!edit||payment?.id!==edit.id) return false;
    return Math.abs((+edit.amount||0)-(+edit.target.amount||0))<=0.005
      &&edit.date===String(edit.target.date||'');
  }

  if(typeof openRecordDialog==='function'&&!openRecordDialog.__bsV242SubmitReset){
    const originalOpenRecordDialog=openRecordDialog;
    const wrapped=function(...args){
      resetSubmitButton();
      const result=originalOpenRecordDialog.apply(this,args);
      resetSubmitButton();
      return result;
    };
    wrapped.__bsV242SubmitReset=true;
    openRecordDialog=wrapped;
  }

  if(typeof cloudUpsertPayment==='function'&&!cloudUpsertPayment.__bsV242CloseSameEffectEdit){
    const originalCloudUpsertPayment=cloudUpsertPayment;
    const wrapped=async function(payment,...rest){
      const closeAfterSuccess=isSameEffectPaymentEdit(payment);
      const result=await originalCloudUpsertPayment.call(this,payment,...rest);
      if(closeAfterSuccess){
        resetSubmitButton();
        if(dialog.open) dialog.close();
      }
      return result;
    };
    wrapped.__bsV242CloseSameEffectEdit=true;
    cloudUpsertPayment=wrapped;
  }

  dialog.addEventListener('close',resetSubmitButton);
  dialog.addEventListener('cancel',resetSubmitButton);
  resetSubmitButton();
})();

/* V2.7.4 - Değişken kredi kartlarında taksit terminolojisini ve önerisini kaldır. */
(() => {
  if(window.__bsVariableCardPaymentUiV274Loaded) return;
  window.__bsVariableCardPaymentUiV274Loaded=true;

  const EPS=.005;
  const roundMoney=value=>Math.round((+value||0)*100)/100;

  function selectedDebt(form){
    const debtId=form?.querySelector('[name="debtId"]')?.value||'';
    return state.debts.map(normalizeDebt).find(d=>d.id===debtId)||null;
  }

  function isVariableCard(debt){
    return !!(
      debt&&
      typeof window.bsIsCreditCardDebt==='function'&&
      window.bsIsCreditCardDebt(debt)
    );
  }

  function snapshot(debt){
    if(!debt||typeof window.bsCreditCardSnapshot!=='function') return null;
    try{return window.bsCreditCardSnapshot(debt);}catch(_error){return null;}
  }

  function remainingMinimum(debt){
    const s=snapshot(debt);
    if(s?.hasStatement) return Math.max(0,roundMoney(s.minimumRemaining));
    return Math.max(0,roundMoney(debt?.minimum||0));
  }

  function renderVariableHint(form,forceAmount=false){
    const debt=selectedDebt(form);
    if(!isVariableCard(debt)) return false;

    const amountInput=form.querySelector('[name="amount"]');
    const hint=document.querySelector('#bsPartialPaymentHint');
    if(!amountInput||!hint) return false;

    const s=snapshot(debt);
    const remaining=remainingMinimum(debt);

    if((forceAmount||!amountInput.value||+amountInput.value<=0)&&remaining>EPS){
      amountInput.value=String(remaining);
    }

    const entered=Math.max(0,roundMoney(amountInput.value));

    if(!s?.hasStatement){
      hint.innerHTML='<strong style="color:#2563eb">Kredi kartı ödemesi</strong> · Ekstre bilgisi girilmedi. Ödeme tutarı serbesttir; kredi kartı açık kalır ve taksit/vade otomatik ilerletilmez.';
      return true;
    }

    if(entered<=EPS){
      hint.textContent=`Ekstre ${money(s.statement)} · Asgari ${money(s.minimum)} · Bu ekstrede ödenen ${money(s.paid)} · Kalan asgari ${money(s.minimumRemaining)}.`;
      return true;
    }

    if(entered+EPS<s.minimumRemaining){
      hint.innerHTML=`<strong style="color:#c97800">Kısmi asgari ödeme</strong> · Bu ödeme sonrası asgaride ${money(roundMoney(s.minimumRemaining-entered))} kalacak. Kredi kartında taksit/vade ilerletilmez.`;
      return true;
    }

    if(Math.abs(entered-s.minimumRemaining)<=EPS){
      hint.innerHTML='<strong style="color:#168a42">Asgari ödeme tamamlanacak</strong> · Kredi kartı açık kalır; sonraki vade veya taksit otomatik oluşturulmaz.';
      return true;
    }

    const extra=Math.max(0,roundMoney(entered-s.minimumRemaining));
    hint.innerHTML=`<strong style="color:#2563eb">Asgari üstü ödeme</strong> · Asgari ödeme tamamlanır${extra>EPS?`; ${money(extra)} ekstre borcundan ayrıca düşer`:''}. Kredi kartı kapanmaz ve taksit/vade ilerlemez.`;
    return true;
  }

  function configurePaymentForm(){
    const form=document.querySelector('#recordForm');
    if(!form||form.querySelector('[name="module"]')?.value!=='payments') return;

    const debtSelect=form.querySelector('[name="debtId"]');
    const amountInput=form.querySelector('[name="amount"]');
    if(!debtSelect||!amountInput) return;

    const oldDebtChange=debtSelect.onchange;
    const oldAmountInput=amountInput.oninput;

    debtSelect.onchange=function(event){
      const debt=selectedDebt(form);
      if(isVariableCard(debt)){
        renderVariableHint(form,true);
        return;
      }
      if(typeof oldDebtChange==='function') oldDebtChange.call(this,event);
    };

    amountInput.oninput=function(event){
      const debt=selectedDebt(form);
      if(isVariableCard(debt)){
        renderVariableHint(form,false);
        return;
      }
      if(typeof oldAmountInput==='function') oldAmountInput.call(this,event);
    };

    const editing=!!form.querySelector('[name="id"]')?.value;
    renderVariableHint(form,!editing);
  }

  function install(){
    if(
      typeof openRecordDialog!=='function'||
      typeof normalizeDebt!=='function'||
      typeof window.bsIsCreditCardDebt!=='function'||
      typeof window.bsCreditCardSnapshot!=='function'
    ){
      setTimeout(install,80);
      return;
    }

    if(openRecordDialog.__bsVariableCardPaymentUiV274) return;

    const original=openRecordDialog;
    const wrapped=function(module,record=null){
      const result=original(module,record);
      if(module==='payments'){
        // Eski payment-plan.js ipucunu önce oluşturur; ardından kart tipine göre düzeltiriz.
        setTimeout(configurePaymentForm,0);
      }
      return result;
    };

    wrapped.__bsVariableCardPaymentUiV274=true;
    openRecordDialog=wrapped;
  }

  install();
})();
