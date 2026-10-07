/* BS OFİS BÜTÇE V2.7.4 - Değişken kredi kartı ödeme formu */
(() => {
  if (window.__bsVariableCardPaymentUiV274Loaded) return;
  window.__bsVariableCardPaymentUiV274Loaded = true;

  const EPS = 0.005;
  const roundMoney = value => Math.round((+value || 0) * 100) / 100;

  function selectedDebt(form) {
    const debtId = form?.querySelector('[name="debtId"]')?.value || '';
    return state.debts.map(normalizeDebt).find(d => d.id === debtId) || null;
  }

  function isVariableCard(debt) {
    return !!(
      debt &&
      typeof window.bsIsCreditCardDebt === 'function' &&
      window.bsIsCreditCardDebt(debt)
    );
  }

  function variableSnapshot(debt) {
    if (!debt || typeof window.bsCreditCardSnapshot !== 'function') return null;
    try {
      return window.bsCreditCardSnapshot(debt);
    } catch (_error) {
      return null;
    }
  }

  function variableRemaining(debt) {
    const snapshot = variableSnapshot(debt);
    if (snapshot?.hasStatement) {
      return Math.max(0, roundMoney(snapshot.minimumRemaining));
    }
    return Math.max(0, roundMoney(debt?.minimum || 0));
  }

  function writeVariableHint(form, forceAmount = false) {
    const debt = selectedDebt(form);
    if (!isVariableCard(debt)) return false;

    const amountInput = form.querySelector('[name="amount"]');
    const hint = document.querySelector('#bsPartialPaymentHint');
    if (!amountInput || !hint) return false;

    const snapshot = variableSnapshot(debt);
    const remaining = variableRemaining(debt);

    if ((forceAmount || !amountInput.value || +amountInput.value <= 0) && remaining > EPS) {
      amountInput.value = String(remaining);
    }

    const entered = Math.max(0, roundMoney(amountInput.value));

    if (!snapshot?.hasStatement) {
      hint.innerHTML = '<strong style="color:#2563eb">Kredi kartı ödemesi</strong> · Ekstre bilgisi girilmedi. Ödeme tutarı serbesttir; kredi kartı açık kalır ve taksit/vade otomatik ilerletilmez.';
      return true;
    }

    if (entered <= EPS) {
      hint.textContent = `Ekstre ${money(snapshot.statement)} · Asgari ${money(snapshot.minimum)} · Bu ekstrede ödenen ${money(snapshot.paid)} · Kalan asgari ${money(snapshot.minimumRemaining)}.`;
      return true;
    }

    if (entered + EPS < snapshot.minimumRemaining) {
      hint.innerHTML = `<strong style="color:#c97800">Kısmi asgari ödeme</strong> · Bu ödeme sonrası asgaride ${money(roundMoney(snapshot.minimumRemaining - entered))} kalacak. Kredi kartında taksit/vade ilerletilmez.`;
      return true;
    }

    if (Math.abs(entered - snapshot.minimumRemaining) <= EPS) {
      hint.innerHTML = '<strong style="color:#168a42">Asgari ödeme tamamlanacak</strong> · Kredi kartı açık kalır; sonraki vade veya taksit otomatik oluşturulmaz.';
      return true;
    }

    const extra = Math.max(0, roundMoney(entered - snapshot.minimumRemaining));
    hint.innerHTML = `<strong style="color:#2563eb">Asgari üstü ödeme</strong> · Asgari ödeme tamamlanır${extra > EPS ? `; ${money(extra)} ekstre borcundan ayrıca düşer` : ''}. Kredi kartı kapanmaz ve taksit/vade ilerlemez.`;
    return true;
  }

  function configurePaymentForm() {
    const form = document.querySelector('#recordForm');
    if (!form || form.querySelector('[name="module"]')?.value !== 'payments') return;

    const debtSelect = form.querySelector('[name="debtId"]');
    const amountInput = form.querySelector('[name="amount"]');
    if (!debtSelect || !amountInput) return;

    const previousDebtChange = debtSelect.onchange;
    const previousAmountInput = amountInput.oninput;

    debtSelect.onchange = function(event) {
      const debt = selectedDebt(form);
      if (isVariableCard(debt)) {
        writeVariableHint(form, true);
        return;
      }
      if (typeof previousDebtChange === 'function') {
        previousDebtChange.call(this, event);
      }
    };

    amountInput.oninput = function(event) {
      const debt = selectedDebt(form);
      if (isVariableCard(debt)) {
        writeVariableHint(form, false);
        return;
      }
      if (typeof previousAmountInput === 'function') {
        previousAmountInput.call(this, event);
      }
    };

    writeVariableHint(form, false);
  }

  function install() {
    if (
      typeof openRecordDialog !== 'function' ||
      typeof normalizeDebt !== 'function' ||
      typeof window.bsIsCreditCardDebt !== 'function' ||
      typeof window.bsCreditCardSnapshot !== 'function'
    ) {
      setTimeout(install, 80);
      return;
    }

    if (openRecordDialog.__bsVariableCardPaymentUiV274) return;

    const original = openRecordDialog;
    const wrapped = function(module, record = null) {
      const result = original(module, record);
      if (module === 'payments') {
        // payment-plan.js kendi ipucu/handler'larını setTimeout(0) ile kurar.
        // Bir sonraki kuyrukta değişken kart davranışı bunun üzerine güvenle uygulanır.
        setTimeout(configurePaymentForm, 0);
      }
      return result;
    };

    wrapped.__bsVariableCardPaymentUiV274 = true;
    openRecordDialog = wrapped;
  }

  install();
})();
