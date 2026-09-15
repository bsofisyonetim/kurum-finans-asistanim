/* BS OFİS BÜTÇE V2.6.3 - Borç ödeme yapısı ve değişken kredi kartı modeli */
(() => {
  if (window.__bsDebtPaymentStructureV263Loaded) return;
  window.__bsDebtPaymentStructureV263Loaded = true;
  window.__bsCreditCardStatementV262Loaded = true;

  const EPS = 0.005;
  const FIXED = 'Sabit';
  const VARIABLE = 'Değişken';
  const LEGACY_VARIABLE_CARD_NAMES = new Set([
    'başak ziraat kredi kartı asgari',
    'ziraat bankası kredi kartı',
    'işbank kredi kartı'
  ]);

  const normalizeName = value => String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');

  const roundMoney = value => Math.round((+value || 0) * 100) / 100;

  function legacyVariableCard(raw) {
    const d = normalizeDebt(raw || {});
    return LEGACY_VARIABLE_CARD_NAMES.has(normalizeName(d.name));
  }

  function paymentStructure(raw) {
    const d = normalizeDebt(raw || {});
    const stored = String(d.custom?.odeme_yapisi || '').trim();
    if (stored === FIXED || stored === VARIABLE) return stored;
    return legacyVariableCard(d) ? VARIABLE : FIXED;
  }

  function isVariableCard(raw) {
    const d = normalizeDebt(raw || {});
    return paymentStructure(d) === VARIABLE && (d.type === 'Kredi Kartı' || legacyVariableCard(d));
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
      .bs-debt-structure-fields,.bs-cc-statement-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .bs-debt-structure-fields label,.bs-cc-statement-fields label{min-width:0}
      @media (max-width:640px){.bs-debt-structure-fields,.bs-cc-statement-fields{grid-template-columns:1fr}}
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
    const statementText = s.hasStatement
      ? `Ekstre ${money(s.statement)} · Ödenen ${money(s.paid)} · Kalan ${money(s.statementRemaining)}`
      : 'Ekstre bekleniyor';

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
          ${s.hasStatement && s.minimum > EPS ? money(s.minimum) : 'Asgari girilecek'}
          <small>${s.hasStatement ? `Asgari · ${esc(dueText)}` : 'Ekstre girilince hesaplanır'}</small>
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

  if (typeof renderDebts === 'function' && !renderDebts.__bsPaymentStructureV263) {
    const original = renderDebts;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      restoreVariableCards();
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

  const originalMonthlyDebtLoad = monthlyDebtLoad;
  monthlyDebtLoad = function() {
    const current = monthKey();
    return activeDebts().reduce((sum, d) => {
      if (!isVariableCard(d)) return sum + (+d.minimum || 0);
      const s = snapshot(d);
      if (!s.hasStatement || !d.dueDate || !d.dueDate.startsWith(current)) return sum;
      return sum + (+d.minimum || 0);
    }, 0);
  };
  monthlyDebtLoad.__bsPaymentStructureV263 = true;
  monthlyDebtLoad.__previous = originalMonthlyDebtLoad;

  const originalApplyPaymentPlan = applyPaymentPlan;
  applyPaymentPlan = function(raw, paymentDate, ...rest) {
    if (!isVariableCard(raw)) return originalApplyPaymentPlan(raw, paymentDate, ...rest);
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

    const typeInput = form.querySelector('[name="type"]');
    const structureBox = ensureStructureField(form, record);
    const structureInput = structureBox.querySelector('[name="custom__odeme_yapisi"]');
    if (!typeInput || !structureInput) return;

    if (legacyVariableCard(record) && typeInput.value !== 'Kredi Kartı') {
      typeInput.value = 'Kredi Kartı';
    }

    const applyMode = () => {
      const variableCard = structureInput.value === VARIABLE && typeInput.value === 'Kredi Kartı';
      const statementBox = ensureStatementFields(form, record);
      statementBox.style.display = variableCard ? '' : 'none';

      setFieldVisible(form, 'original', !variableCard);
      setFieldVisible(form, 'balance', !variableCard);
      setFieldVisible(form, 'rate', !variableCard);
      setFieldVisible(form, 'frequency', !variableCard);
      setFieldVisible(form, 'custom__remaining_installments', !variableCard);
      setFieldVisible(form, 'custom__next_payment_after_current', !variableCard);

      const minInput = form.querySelector('[name="minimum"]');
      const dueInput = form.querySelector('[name="dueDate"]');
      setLabelText(minInput, variableCard ? 'Asgari ödeme' : fieldLabel('debts', 'minimum'));
      setLabelText(dueInput, variableCard ? 'Son ödeme tarihi' : fieldLabel('debts', 'dueDate'));

      const title = document.querySelector('#recordDialogTitle');
      if (title) {
        title.textContent = variableCard
          ? (record?.id ? 'Kredi Kartı Ekstresini Güncelle' : 'Yeni Kredi Kartı')
          : (record?.id ? 'Kaydı Düzenle' : 'Yeni Borç');
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
      makeDetailRow('Kalan ekstre', s.hasStatement ? money(s.statementRemaining) : '—', 'bs-cc-detail-row'),
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
    console.error('V2.6.3 borç ödeme yapısı render hatası:', error);
  }
})();
