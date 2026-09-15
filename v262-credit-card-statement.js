/* BS OFİS BÜTÇE V2.6.2.1 - Değişken kredi kartı ekstresi / asgari ödeme modeli */
(() => {
  if (window.__bsCreditCardStatementV262Loaded) return;
  window.__bsCreditCardStatementV262Loaded = true;

  const EPS = 0.005;
  const CARD_NAMES = new Set([
    'başak ziraat kredi kartı asgari',
    'ziraat bankası kredi kartı',
    'işbank kredi kartı'
  ]);

  const normalizeName = value => String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');

  const roundMoney = value => Math.round((+value || 0) * 100) / 100;

  function isCreditCardDebt(raw) {
    if (!raw) return false;
    const d = normalizeDebt(raw);
    return CARD_NAMES.has(normalizeName(d.name));
  }

  function statementDate(raw) {
    const d = normalizeDebt(raw);
    return d.custom?.cc_statement_date || '';
  }

  function statementAmount(raw) {
    const d = normalizeDebt(raw);
    return Math.max(0, roundMoney(d.custom?.cc_statement_amount || 0));
  }

  function paidForCurrentStatement(raw) {
    const d = normalizeDebt(raw);
    const start = statementDate(d);
    if (!start) return 0;

    return roundMoney(
      state.payments
        .map(normalizePayment)
        .filter(p => p.debtId === d.id && p.date && p.date >= start)
        .reduce((sum, p) => sum + Math.max(0, +p.amount || 0), 0)
    );
  }

  function cardSnapshot(raw) {
    const d = normalizeDebt(raw);
    const statement = statementAmount(d);
    const minimum = Math.max(0, roundMoney(d.minimum));
    const paid = paidForCurrentStatement(d);
    const statementRemaining = Math.max(0, roundMoney(statement - paid));
    const minimumRemaining = Math.max(0, roundMoney(minimum - paid));
    const due = d.dueDate || '';
    const today = parseDate(todayISO());
    const dueDate = due ? parseDate(due) : null;
    const hasStatement = !!(statementDate(d) && statement > EPS);
    const overdue = !!(hasStatement && dueDate && today > dueDate && minimumRemaining > EPS);

    let label = 'Ekstre bilgisi girin';
    let badge = 'orange';

    if (!hasStatement) {
      label = 'Ekstre bilgisi girin';
      badge = 'orange';
    } else if (statement > EPS && paid + EPS >= statement) {
      label = 'Ekstre ödendi';
      badge = 'green';
    } else if (minimum > EPS && paid + EPS >= minimum) {
      label = 'Asgari ödendi · borç devrediyor';
      badge = 'green';
    } else if (minimum > EPS && overdue) {
      label = 'Asgari ödeme gecikti';
      badge = 'red';
    } else if (minimum > EPS) {
      label = 'Asgari bekleniyor';
      badge = 'orange';
    }

    return {
      d,
      statement,
      minimum,
      paid,
      statementRemaining,
      minimumRemaining,
      due,
      hasStatement,
      overdue,
      label,
      badge
    };
  }

  window.bsIsCreditCardDebt = isCreditCardDebt;
  window.bsCreditCardSnapshot = cardSnapshot;

  if (typeof window.currentInstallmentRemaining === 'function' && !window.currentInstallmentRemaining.__bsCreditCardV262) {
    const originalCurrentInstallmentRemainingV262 = window.currentInstallmentRemaining;
    const wrappedCurrentInstallmentRemainingV262 = function(raw) {
      if (isCreditCardDebt(raw)) {
        const snapshot = cardSnapshot(raw);
        return snapshot.hasStatement ? snapshot.minimumRemaining : 0;
      }
      return originalCurrentInstallmentRemainingV262(raw);
    };
    wrappedCurrentInstallmentRemainingV262.__bsCreditCardV262 = true;
    window.currentInstallmentRemaining = wrappedCurrentInstallmentRemainingV262;
  }

  function injectStyle() {
    if (document.getElementById('bs-credit-card-v262-style')) return;
    const style = document.createElement('style');
    style.id = 'bs-credit-card-v262-style';
    style.textContent = `
      .bs-cc-card .bs-cc-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin-top:3px}
      .bs-cc-card .bs-cc-subline{display:block;margin-top:4px;color:#64748b}
      .bs-cc-statement-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .bs-cc-statement-fields label{min-width:0}
      @media (max-width:640px){.bs-cc-statement-fields{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  const originalDebtCardV262 = debtCard;
  debtCard = function(raw) {
    const d = normalizeDebt(raw);
    if (!isCreditCardDebt(d)) return originalDebtCardV262(raw);

    const s = cardSnapshot(d);
    const owner = d.custom?.debt_owner || '';
    const dueText = d.dueDate
      ? parseDate(d.dueDate).toLocaleDateString('tr-TR')
      : 'Son ödeme tarihi girilmedi';

    const statementText = s.statement > EPS
      ? `Ekstre ${money(s.statement)} · Ödenen ${money(s.paid)} · Kalan ${money(s.statementRemaining)}`
      : 'Ekstre bekleniyor';

    return `
      <article class="list-card clickable bs-cc-card" data-debt="${esc(d.id)}">
        <div class="main">
          <strong>${esc(d.name)}</strong>
          <small class="bs-cc-meta">
            ${owner ? `<span>${esc(owner)}</span><span>·</span>` : ''}
            <span>Kredi Kartı</span>
            <span class="badge ${esc(s.badge)}">${esc(s.label)}</span>
          </small>
          <small class="bs-cc-subline">${esc(statementText)}</small>
        </div>
        <div class="amount">
          ${s.hasStatement && s.minimum > EPS ? money(s.minimum) : 'Asgari girilecek'}
          <small>${s.hasStatement ? `Asgari · ${esc(dueText)}` : 'Ekstre girilince hesaplanır'}</small>
        </div>
      </article>
    `;
  };

  function restoreCreditCardCardsAfterLegacyDecorators() {
    const byId = new Map(
      state.debts
        .map(normalizeDebt)
        .filter(isCreditCardDebt)
        .map(d => [String(d.id), d])
    );

    document.querySelectorAll('#debtList [data-debt]').forEach(card => {
      const d = byId.get(String(card.dataset.debt || ''));
      if (!d) return;
      const holder = document.createElement('div');
      holder.innerHTML = debtCard(d).trim();
      const fresh = holder.firstElementChild;
      if (fresh) card.replaceWith(fresh);
    });
  }

  if (typeof renderDebts === 'function' && !renderDebts.__bsCreditCardV262) {
    const originalRenderDebtsV262 = renderDebts;
    const wrappedRenderDebtsV262 = function(...args) {
      const result = originalRenderDebtsV262.apply(this, args);
      restoreCreditCardCardsAfterLegacyDecorators();
      return result;
    };
    wrappedRenderDebtsV262.__bsCreditCardV262 = true;
    renderDebts = wrappedRenderDebtsV262;
  }

  const originalDueItemsV262 = dueItems;
  dueItems = function() {
    const regular = originalDueItemsV262().filter(x => !isCreditCardDebt(x));
    const now = parseDate(todayISO());

    const cards = activeDebts()
      .filter(isCreditCardDebt)
      .filter(d => d.dueDate)
      .map(d => {
        const s = cardSnapshot(d);
        if (!s.hasStatement || s.minimumRemaining <= EPS) return null;
        const date = parseDate(d.dueDate);
        return {
          ...d,
          type: 'Kredi Kartı',
          date,
          days: daysBetween(now, date),
          amount: s.minimumRemaining
        };
      })
      .filter(Boolean);

    return [...regular, ...cards].sort((a, b) => a.date - b.date);
  };

  const originalMonthlyDebtLoadV262 = monthlyDebtLoad;
  monthlyDebtLoad = function() {
    const current = monthKey();
    return activeDebts().reduce((sum, d) => {
      if (!isCreditCardDebt(d)) return sum + (+d.minimum || 0);
      const s = cardSnapshot(d);
      if (!s.hasStatement || !d.dueDate || !d.dueDate.startsWith(current)) return sum;
      return sum + (+d.minimum || 0);
    }, 0);
  };
  monthlyDebtLoad.__bsCreditCardV262 = true;
  monthlyDebtLoad.__previous = originalMonthlyDebtLoadV262;

  const originalApplyPaymentPlanV262 = applyPaymentPlan;
  applyPaymentPlan = function(raw, paymentDate, ...rest) {
    if (!isCreditCardDebt(raw)) {
      return originalApplyPaymentPlanV262(raw, paymentDate, ...rest);
    }

    raw.status = 'active';
    raw.updatedAt = new Date().toISOString();
    return raw;
  };
  applyPaymentPlan.__bsCreditCardV262 = true;

  const originalParseCustomValuesV262 = parseCustomValues;
  parseCustomValues = function(fd, module, oldCustom = {}) {
    const out = originalParseCustomValuesV262(fd, module, oldCustom);
    if (module !== 'debts') return out;

    if ('cc_statement_date' in fd) {
      out.cc_statement_date = fd.cc_statement_date || '';
    }
    if ('cc_statement_amount' in fd) {
      out.cc_statement_amount = fd.cc_statement_amount === ''
        ? ''
        : Math.max(0, roundMoney(fd.cc_statement_amount));
    }
    return out;
  };

  function setLabelText(input, text) {
    const label = input?.closest('label');
    if (!label) return;
    let node = [...label.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (!node) {
      node = document.createTextNode('');
      label.prepend(node);
    }
    node.textContent = `
        ${text}
        `;
  }

  function setFieldVisible(form, name, visible) {
    const input = form.querySelector(`[name="${name}"]`);
    const label = input?.closest('label');
    if (label) label.style.display = visible ? '' : 'none';
  }

  function ensureStatementFields(form, record) {
    let box = form.querySelector('#bsCreditCardStatementFields');
    if (box) return box;

    box = document.createElement('div');
    box.id = 'bsCreditCardStatementFields';
    box.className = 'bs-cc-statement-fields';

    const d = record ? normalizeDebt(record) : null;
    const dateValue = d?.custom?.cc_statement_date || '';
    const amountValue = d?.custom?.cc_statement_amount ?? '';

    box.innerHTML = `
      <label>
        Ekstre kesim tarihi
        <input name="cc_statement_date" type="date" value="${esc(dateValue)}">
      </label>
      <label>
        Ekstre tutarı
        <input name="cc_statement_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(amountValue)}" placeholder="Örn. 48000">
      </label>
    `;

    const minimumLabel = form.querySelector('[name="minimum"]')?.closest('label');
    if (minimumLabel) minimumLabel.before(box);
    else form.querySelector('#recordFields')?.prepend(box);
    return box;
  }

  function configureDebtForm(record = null) {
    const form = document.querySelector('#recordForm');
    if (!form || form.querySelector('[name="module"]')?.value !== 'debts') return;

    const typeInput = form.querySelector('[name="type"]');
    const nameInput = form.querySelector('[name="name"]');
    if (!typeInput) return;

    const recognizedByName = record && CARD_NAMES.has(normalizeName(normalizeDebt(record).name));
    if (recognizedByName && typeInput.value !== 'Kredi Kartı') {
      typeInput.value = 'Kredi Kartı';
    }

    const applyMode = () => {
      const currentName = nameInput?.value || normalizeDebt(record || {}).name || '';
      const card = CARD_NAMES.has(normalizeName(currentName));
      const box = ensureStatementFields(form, record);
      box.style.display = card ? '' : 'none';

      setFieldVisible(form, 'original', !card);
      setFieldVisible(form, 'balance', !card);
      setFieldVisible(form, 'rate', !card);
      setFieldVisible(form, 'frequency', !card);
      setFieldVisible(form, 'custom__remaining_installments', !card);
      setFieldVisible(form, 'custom__next_payment_after_current', !card);

      const minInput = form.querySelector('[name="minimum"]');
      const dueInput = form.querySelector('[name="dueDate"]');
      setLabelText(minInput, card ? 'Asgari ödeme' : fieldLabel('debts', 'minimum'));
      setLabelText(dueInput, card ? 'Son ödeme tarihi' : fieldLabel('debts', 'dueDate'));

      const title = document.querySelector('#recordDialogTitle');
      if (title) {
        title.textContent = card
          ? (record?.id ? 'Kredi Kartı Ekstresini Güncelle' : 'Yeni Kredi Kartı')
          : (record?.id ? 'Kaydı Düzenle' : 'Yeni Borçlar');
      }
    };

    typeInput.addEventListener('change', applyMode);
    nameInput?.addEventListener('input', applyMode);
    applyMode();
  }

  const originalOpenRecordDialogV262 = openRecordDialog;
  openRecordDialog = function(module, record = null) {
    const result = originalOpenRecordDialogV262(module, record);
    if (module === 'debts') configureDebtForm(record);
    return result;
  };

  function makeDetailRow(label, value, className = '') {
    const row = document.createElement('div');
    row.className = `detail-row ${className}`.trim();
    row.innerHTML = `<span>${esc(label)}</span><strong>${value}</strong>`;
    return row;
  }

  const originalShowDetailV262 = showDetail;
  showDetail = function(module, record) {
    originalShowDetailV262(module, record);
    if (module !== 'debts' || !isCreditCardDebt(record)) return;

    const d = normalizeDebt(record);
    const s = cardSnapshot(d);
    const grid = document.querySelector('#detailContent .detail-grid');
    if (!grid) return;

    grid.querySelector('.bs-debt-balance-row')?.remove();

    const hideLabels = new Set([
      'İlk borç',
      'Kalan toplam borç',
      'Faiz oranı',
      'Tekrar',
      'Kalan taksit',
      'Sonraki aylardaki ödeme'
    ]);

    [...grid.querySelectorAll('.detail-row')].forEach(row => {
      const key = row.querySelector('span')?.textContent?.trim() || '';
      if (hideLabels.has(key)) row.remove();
      if (key === fieldLabel('debts', 'minimum')) row.querySelector('span').textContent = 'Asgari ödeme';
      if (key === fieldLabel('debts', 'dueDate')) row.querySelector('span').textContent = 'Son ödeme tarihi';
      if (key === fieldLabel('debts', 'type')) row.querySelector('strong').textContent = 'Kredi Kartı';
    });

    const rows = [
      makeDetailRow('Ekstre kesim tarihi', statementDate(d) ? parseDate(statementDate(d)).toLocaleDateString('tr-TR') : '—', 'bs-cc-detail-row'),
      makeDetailRow('Ekstre tutarı', s.statement > EPS ? money(s.statement) : '—', 'bs-cc-detail-row'),
      makeDetailRow('Bu ekstre ödendi', money(s.paid), 'bs-cc-detail-row'),
      makeDetailRow('Kalan ekstre', s.statement > EPS ? money(s.statementRemaining) : '—', 'bs-cc-detail-row'),
      makeDetailRow('Asgari durum', esc(s.label), 'bs-cc-detail-row')
    ];

    for (let i = rows.length - 1; i >= 0; i--) grid.prepend(rows[i]);

    const edit = document.querySelector('#detailContent [data-edit-record="debts"]');
    if (edit) edit.textContent = 'Ekstreyi Güncelle';
  };

  injectStyle();

  try {
    renderAll();
  } catch (error) {
    console.error('V2.6.2 kredi kartı modeli render hatası:', error);
  }
})();
