/* BS OFİS BÜTÇE V2.7.2 - Sabit / Değişken borç kartı ve stabil özet başlangıcı */
(() => {
  if (window.__bsDebtPaymentStructureV263Loaded) return;
  window.__bsDebtPaymentStructureV263Loaded = true;
  window.__bsCreditCardStatementV262Loaded = true;

  const EPS = 0.005;
  const FIXED = 'Sabit';
  const VARIABLE = 'Değişken';
  const roundMoney = value => Math.round((+value || 0) * 100) / 100;

  function paymentStructure(raw) {
    const d = normalizeDebt(raw || {});
    const stored = String(d.custom?.odeme_yapisi || '').trim();
    return stored === VARIABLE ? VARIABLE : FIXED;
  }

  function isVariableCard(raw) {
    const d = normalizeDebt(raw || {});
    return paymentStructure(d) === VARIABLE && d.type === 'Kredi Kartı';
  }

  function statementDate(raw) {
    return normalizeDebt(raw || {}).custom?.cc_statement_date || '';
  }

  function statementAmount(raw) {
    return Math.max(0, roundMoney(normalizeDebt(raw || {}).custom?.cc_statement_amount || 0));
  }

  function paidForCurrentStatement(raw) {
    const d = normalizeDebt(raw || {});
    const start = statementDate(d);
    if (!start) return 0;

    return roundMoney(
      state.payments
        .map(normalizePayment)
        .filter(p => p.debtId === d.id && p.date && p.date >= start)
        .reduce((sum, p) => sum + Math.max(0, +p.amount || 0), 0)
    );
  }

  function snapshot(raw) {
    const d = normalizeDebt(raw || {});
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
    const carryover = !!(
      hasStatement &&
      minimum > EPS &&
      paid + EPS >= minimum &&
      paid + EPS < statement
    ) ? statementRemaining : 0;

    let label = 'Ekstre bilgisi girin';
    let badge = 'orange';

    if (hasStatement && paid + EPS >= statement) {
      label = 'Ekstre ödendi';
      badge = 'green';
    } else if (hasStatement && minimum > EPS && paid + EPS >= minimum) {
      label = 'Asgari ödendi · borç devrediyor';
      badge = 'green';
    } else if (hasStatement && minimum > EPS && overdue) {
      label = 'Asgari ödeme gecikti';
      badge = 'red';
    } else if (hasStatement && minimum > EPS) {
      label = 'Asgari bekleniyor';
    }

    return {
      d,
      statement,
      minimum,
      paid,
      statementRemaining,
      minimumRemaining,
      carryover,
      due,
      hasStatement,
      overdue,
      label,
      badge
    };
  }

  window.bsDebtPaymentStructure = paymentStructure;
  window.bsIsCreditCardDebt = isVariableCard;
  window.bsCreditCardSnapshot = snapshot;

  if (typeof window.currentInstallmentRemaining === 'function' && !window.currentInstallmentRemaining.__bsPaymentStructureV263) {
    const original = window.currentInstallmentRemaining;
    const wrapped = function(raw) {
      if (isVariableCard(raw)) {
        const s = snapshot(raw);
        return s.hasStatement ? s.minimumRemaining : 0;
      }
      return original(raw);
    };
    wrapped.__bsPaymentStructureV263 = true;
    window.currentInstallmentRemaining = wrapped;
  }

  function injectStyle() {
    if (document.getElementById('bs-debt-payment-structure-v263-style')) return;
    const style = document.createElement('style');
    style.id = 'bs-debt-payment-structure-v263-style';
    style.textContent = `
      .bs-cc-card .bs-cc-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin-top:3px}
      .bs-cc-card .bs-cc-subline{display:block;margin-top:4px;color:#64748b}
      .bs-debt-structure-fields{display:grid;grid-template-columns:1fr;gap:12px}
      .bs-cc-statement-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .bs-debt-structure-fields label,.bs-cc-statement-fields label{min-width:0}
      @media (max-width:640px){.bs-cc-statement-fields{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  const originalDebtCard = debtCard;
  debtCard = function(raw) {
    const d = normalizeDebt(raw);
    if (!isVariableCard(d)) return originalDebtCard(raw);

    const s = snapshot(d);
    const owner = d.custom?.debt_owner || '';
    const dueText = d.dueDate
      ? parseDate(d.dueDate).toLocaleDateString('tr-TR')
      : 'Son ödeme tarihi girilmedi';
    const remainingLabel = s.carryover > EPS ? 'Devreden borç' : 'Kalan ekstre';
    const statementText = s.hasStatement
      ? `Ekstre ${money(s.statement)} · Ödenen ${money(s.paid)} · ${remainingLabel} ${money(s.statementRemaining)}`
      : 'Ekstre girilmedi · Bu ay ödenecek ₺0';

    let amountText = 'Ekstre yok';
    let amountSubline = 'bu ay ödenecek ₺0';
    if (s.hasStatement && s.minimumRemaining > EPS) {
      amountText = money(s.minimumRemaining);
      amountSubline = `kalan asgari · ${dueText}`;
    } else if (s.hasStatement && s.carryover > EPS) {
      amountText = money(s.carryover);
      amountSubline = 'devreden borç';
    } else if (s.hasStatement) {
      amountText = money(0);
      amountSubline = 'ekstre ödendi';
    }

    return `
      <article class="list-card clickable bs-cc-card" data-debt="${esc(d.id)}">
        <div class="main">
          <strong>${esc(d.name)}</strong>
          <small class="bs-cc-meta">
            ${owner ? `<span>${esc(owner)}</span><span>·</span>` : ''}
            <span>Kredi Kartı · ${VARIABLE}</span>
            <span class="badge ${esc(s.badge)}">${esc(s.label)}</span>
          </small>
          <small class="bs-cc-subline">${esc(statementText)}</small>
        </div>
        <div class="amount">
          ${amountText}
          <small>${esc(amountSubline)}</small>
        </div>
      </article>
    `;
  };

  function restoreVariableCards() {
    const byId = new Map(
      state.debts.map(normalizeDebt).filter(isVariableCard).map(d => [String(d.id), d])
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

  function fixedRemainingInstallments(raw) {
    const d = normalizeDebt(raw || {});
    const value = d.custom?.remaining_installments;
    if (value === '' || value == null || Number.isNaN(+value)) return null;
    return Math.max(0, Math.floor(+value));
  }

  function decorateFixedCards() {
    const byId = new Map(
      state.debts
        .map(normalizeDebt)
        .filter(d => paymentStructure(d) === FIXED)
        .map(d => [String(d.id), d])
    );

    document.querySelectorAll('#debtList [data-debt]').forEach(card => {
      const d = byId.get(String(card.dataset.debt || ''));
      if (!d) return;

      const status = card.querySelector('.bs-v2598-debt-status');
      if (!status) return;

      status.querySelectorAll('[data-bs-fixed-structure]').forEach(node => node.remove());
      const structure = document.createElement('span');
      structure.className = 'bs-v2598-pill';
      structure.dataset.bsFixedStructure = '1';
      structure.textContent = FIXED;
      status.prepend(structure);

      const remainingInstallments = fixedRemainingInstallments(d);
      if (remainingInstallments != null) {
        const installment = document.createElement('span');
        installment.className = 'bs-v2598-pill';
        installment.dataset.bsFixedStructure = '1';
        installment.textContent = `${remainingInstallments} taksit kaldı`;
        status.appendChild(installment);
      }

      const paid = Math.max(0, roundMoney(d.custom?.current_installment_paid || 0));
      const label = card.querySelector('.bs-v2598-remaining-label');
      if (label) label.textContent = paid > EPS ? 'bu taksitte kalan' : 'bu taksit';
    });
  }

  if (typeof renderDebts === 'function' && !renderDebts.__bsPaymentStructureV263) {
    const original = renderDebts;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      restoreVariableCards();
      decorateFixedCards();
      return result;
    };
    wrapped.__bsPaymentStructureV263 = true;
    renderDebts = wrapped;
  }

  const originalDueItems = dueItems;
  dueItems = function() {
    const regular = originalDueItems().filter(x => !isVariableCard(x));
    const now = parseDate(todayISO());
    const cards = activeDebts()
      .filter(isVariableCard)
      .filter(d => d.dueDate)
      .map(d => {
        const s = snapshot(d);
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

  function addMonthlyPlannedAmount(map, current, date, amount) {
    const key = String(date || '');
    const value = Math.max(0, roundMoney(amount));
    if (!key.startsWith(current) || value <= EPS) return;
    map.set(key, Math.max(map.get(key) || 0, value));
  }

  function fixedMonthlyAmount(raw, current) {
    const d = normalizeDebt(raw || {});
    const plannedByDate = new Map();

    try {
      const rows = typeof window.bsDebtInstallmentPlan === 'function'
        ? window.bsDebtInstallmentPlan(d)
        : [];
      if (Array.isArray(rows)) {
        rows.forEach(row => {
          addMonthlyPlannedAmount(
            plannedByDate,
            current,
            row?.date,
            row?.planned ?? row?.amount
          );
        });
      }
    } catch (_error) {}

    state.payments
      .map(normalizePayment)
      .filter(p => p.debtId === d.id)
      .forEach(p => {
        const meta = p.custom || {};
        addMonthlyPlannedAmount(
          plannedByDate,
          current,
          meta.installment_due_date,
          meta.installment_amount_at_payment
        );
      });

    if (plannedByDate.size) {
      return roundMoney([...plannedByDate.values()].reduce((sum, amount) => sum + amount, 0));
    }

    if (d.status === 'closed') return 0;
    if (!d.dueDate) {
      return d.frequency === 'monthly'
        ? Math.max(0, roundMoney(d.minimum))
        : 0;
    }
    if (d.dueDate.startsWith(current)) {
      return Math.max(0, roundMoney(d.minimum));
    }
    return 0;
  }

  function monthlyPlannedAmount(raw, current = monthKey()) {
    const d = normalizeDebt(raw || {});
    if (isVariableCard(d)) {
      const s = snapshot(d);
      if (!s.hasStatement || !d.dueDate || !d.dueDate.startsWith(current)) return 0;
      return Math.max(0, roundMoney(s.minimum));
    }
    return fixedMonthlyAmount(d, current);
  }

  window.bsDebtMonthlyPlannedAmount = monthlyPlannedAmount;

  const originalMonthlyDebtLoad = monthlyDebtLoad;
  monthlyDebtLoad = function() {
    const current = monthKey();
    return roundMoney(
      state.debts
        .map(normalizeDebt)
        .reduce((sum, d) => sum + monthlyPlannedAmount(d, current), 0)
    );
  };
  monthlyDebtLoad.__bsPaymentStructureV263 = true;
  monthlyDebtLoad.__previous = originalMonthlyDebtLoad;

  const VARIABLE_UNDO_CUSTOM_KEYS = [
    'remaining_installments',
    'current_installment_paid',
    'next_payment_after_current',
    'next_payment_source',
    'balance_source'
  ];

  function captureVariableCardUndo(raw) {
    const d = normalizeDebt(raw || {});
    const source = d.custom || {};
    const customPresent = [];
    const customValues = {};

    VARIABLE_UNDO_CUSTOM_KEYS.forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(source, key)) return;
      customPresent.push(key);
      customValues[key] = clone(source[key]);
    });

    return {
      version: 3,
      minimum: roundMoney(d.minimum),
      dueDate: d.dueDate || '',
      balance: Math.max(0, roundMoney(d.balance)),
      status: d.status || 'active',
      customPresent,
      customValues
    };
  }

  function resolveVariablePaymentRecord(raw, paymentDate, explicitAmount, paymentRecord) {
    if (paymentRecord) return paymentRecord;
    if (explicitAmount != null) return null;

    const debtId = normalizeDebt(raw || {}).id;
    for (let i = state.payments.length - 1; i >= 0; i--) {
      const p = normalizePayment(state.payments[i]);
      if (p.debtId === debtId && p.date === paymentDate) return state.payments[i];
    }
    return null;
  }

  function ensureVariableCardUndo(raw, paymentDate, explicitAmount, paymentRecord) {
    const target = resolveVariablePaymentRecord(raw, paymentDate, explicitAmount, paymentRecord);
    if (!target) return;

    const custom = {...(target.custom || target.ozel_alanlar || {})};
    if (!custom.payment_undo_v240 && !custom.payment_undo_v239 && !custom.payment_undo_v238) {
      custom.payment_undo_v240 = captureVariableCardUndo(raw);
    }
    target.custom = custom;
  }

  const originalApplyPaymentPlan = applyPaymentPlan;
  applyPaymentPlan = function(raw, paymentDate, explicitAmount = null, paymentRecord = null) {
    if (!isVariableCard(raw)) {
      return originalApplyPaymentPlan(raw, paymentDate, explicitAmount, paymentRecord);
    }

    ensureVariableCardUndo(raw, paymentDate, explicitAmount, paymentRecord);
    raw.status = 'active';
    raw.updatedAt = new Date().toISOString();
    return raw;
  };
  applyPaymentPlan.__bsPaymentStructureV263 = true;

  const originalParseCustomValues = parseCustomValues;
  parseCustomValues = function(fd, module, oldCustom = {}) {
    const out = originalParseCustomValues(fd, module, oldCustom);
    if (module !== 'debts') return out;

    if ('custom__odeme_yapisi' in fd) {
      out.odeme_yapisi = fd.custom__odeme_yapisi === VARIABLE ? VARIABLE : FIXED;
    }

    if (out.odeme_yapisi === VARIABLE) {
      if ('cc_statement_date' in fd) out.cc_statement_date = fd.cc_statement_date || '';
      if ('cc_statement_amount' in fd) {
        out.cc_statement_amount = fd.cc_statement_amount === ''
          ? ''
          : Math.max(0, roundMoney(fd.cc_statement_amount));
      }
    } else {
      delete out.cc_statement_date;
      delete out.cc_statement_amount;
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
    node.textContent = `\n        ${text}\n        `;
  }

  function setFieldVisible(form, name, visible) {
    const input = form.querySelector(`[name="${name}"]`);
    const label = input?.closest('label');
    if (label) label.style.display = visible ? '' : 'none';
  }

  function arrangeDebtForm(form, structureBox, statementBox) {
    const holder = form.querySelector('#recordFields');
    if (!holder) return;

    const labelFor = name => form.querySelector(`[name="${name}"]`)?.closest('label');
    const ordered = [
      labelFor('name'),
      labelFor('type'),
      structureBox,
      statementBox,
      labelFor('minimum'),
      labelFor('dueDate'),
      labelFor('custom__remaining_installments'),
      labelFor('custom__debt_owner'),
      labelFor('notes')
    ].filter(Boolean);

    let anchor = null;
    for (const node of ordered) {
      if (!anchor) holder.prepend(node);
      else anchor.after(node);
      anchor = node;
    }
  }

  function ensureStructureField(form, record) {
    let box = form.querySelector('#bsDebtPaymentStructureFields');
    if (box) return box;

    box = document.createElement('div');
    box.id = 'bsDebtPaymentStructureFields';
    box.className = 'bs-debt-structure-fields';
    const value = paymentStructure(record || {});
    box.innerHTML = `
      <label>
        Ödeme yapısı
        <select name="custom__odeme_yapisi" required>
          <option value="${FIXED}" ${value === FIXED ? 'selected' : ''}>${FIXED}</option>
          <option value="${VARIABLE}" ${value === VARIABLE ? 'selected' : ''}>${VARIABLE}</option>
        </select>
      </label>
    `;

    const typeLabel = form.querySelector('[name="type"]')?.closest('label');
    if (typeLabel) typeLabel.after(box);
    else form.querySelector('#recordFields')?.prepend(box);
    return box;
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
    else form.querySelector('#recordFields')?.append(box);
    return box;
  }

  function configureDebtForm(record = null) {
    const form = document.querySelector('#recordForm');
    if (!form || form.querySelector('[name="module"]')?.value !== 'debts') return;

    const nameInput = form.querySelector('[name="name"]');
    const typeInput = form.querySelector('[name="type"]');
    const structureBox = ensureStructureField(form, record);
    const structureInput = structureBox.querySelector('[name="custom__odeme_yapisi"]');
    if (!typeInput || !structureInput) return;

    const statementBox = ensureStatementFields(form, record);
    arrangeDebtForm(form, structureBox, statementBox);
    setLabelText(nameInput, 'Borç adı');
    setLabelText(typeInput, 'Borç türü');

    const applyMode = () => {
      const fixed = structureInput.value === FIXED;
      const variableCard = structureInput.value === VARIABLE && typeInput.value === 'Kredi Kartı';
      statementBox.style.display = variableCard ? '' : 'none';

      setFieldVisible(form, 'original', false);
      setFieldVisible(form, 'balance', false);
      setFieldVisible(form, 'rate', false);
      setFieldVisible(form, 'frequency', false);
      setFieldVisible(form, 'custom__remaining_installments', fixed);
      setFieldVisible(form, 'custom__next_payment_after_current', false);
      setFieldVisible(form, 'custom__debt_owner', true);
      setFieldVisible(form, 'notes', true);

      const minInput = form.querySelector('[name="minimum"]');
      const dueInput = form.querySelector('[name="dueDate"]');
      setLabelText(
        minInput,
        variableCard
          ? 'Asgari ödeme'
          : fixed
            ? 'Aylık / taksit tutarı'
            : 'Planlanan ödeme'
      );
      setLabelText(
        dueInput,
        variableCard
          ? 'Son ödeme tarihi'
          : fixed
            ? 'Sıradaki ödeme tarihi'
            : 'Ödeme tarihi'
      );

      const title = document.querySelector('#recordDialogTitle');
      if (title) {
        title.textContent = variableCard
          ? (record?.id ? 'Kredi Kartı Ekstresini Güncelle' : 'Yeni Kredi Kartı')
          : (record?.id ? 'Borcu Düzenle' : 'Yeni Borç');
      }
    };

    typeInput.addEventListener('change', applyMode);
    structureInput.addEventListener('change', applyMode);
    applyMode();
  }

  const originalOpenRecordDialog = openRecordDialog;
  openRecordDialog = function(module, record = null) {
    const result = originalOpenRecordDialog(module, record);
    if (module === 'debts') configureDebtForm(record);
    return result;
  };

  function makeDetailRow(label, value, className = '') {
    const row = document.createElement('div');
    row.className = `detail-row ${className}`.trim();
    row.innerHTML = `<span>${esc(label)}</span><strong>${value}</strong>`;
    return row;
  }

  const originalShowDetail = showDetail;
  showDetail = function(module, record) {
    originalShowDetail(module, record);
    if (module !== 'debts') return;

    const d = normalizeDebt(record);
    const grid = document.querySelector('#detailContent .detail-grid');
    if (!grid) return;

    grid.prepend(makeDetailRow('Ödeme yapısı', esc(paymentStructure(d)), 'bs-payment-structure-row'));
    if (!isVariableCard(d)) return;

    const s = snapshot(d);
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
      makeDetailRow('Ekstre tutarı', s.hasStatement ? money(s.statement) : '—', 'bs-cc-detail-row'),
      makeDetailRow('Bu ekstre ödendi', money(s.paid), 'bs-cc-detail-row'),
      makeDetailRow(s.carryover > EPS ? 'Devreden borç' : 'Kalan ekstre', s.hasStatement ? money(s.statementRemaining) : '—', 'bs-cc-detail-row'),
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
    console.error('V2.7.2 borç kartı render hatası:', error);
  } finally {
    // İlk ekranda eski aylık borç formülünün kısa süre görünmesini engeller.
    document.documentElement.classList.remove('bs-summary-engine-pending');
  }
})();