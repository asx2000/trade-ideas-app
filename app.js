(() => {
  'use strict';

  const STORAGE_KEY = 'tradeIdeas.debitSpreads.v1';

  const STRATEGIES = {
    debit_spread: { label: 'Debit Spread', pillClass: null /* uses call/put */ },
    csp: { label: 'Cash Secured Put', pillClass: 'csp', pillText: 'CASH SECURED PUT' },
    cc: { label: 'Covered Call', pillClass: 'cc', pillText: 'COVERED CALL' },
  };

  const list = document.getElementById('list');
  const emptyState = document.getElementById('emptyState');
  const countBadge = document.getElementById('countBadge');
  const subtitleDate = document.getElementById('subtitleDate');

  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('sheet');
  const sheetTitle = document.getElementById('sheetTitle');
  const tradeForm = document.getElementById('tradeForm');
  const formError = document.getElementById('formError');

  const tickerInput = document.getElementById('ticker');

  const segStratDS = document.getElementById('segStratDS');
  const segStratCSP = document.getElementById('segStratCSP');
  const segStratCC = document.getElementById('segStratCC');
  const dsTypeField = document.getElementById('dsTypeField');
  const segCall = document.getElementById('segCall');
  const segPut = document.getElementById('segPut');

  const expirationInput = document.getElementById('expiration');
  const dteHint = document.getElementById('dteHint');

  const dsStrikesField = document.getElementById('dsStrikesField');
  const longStrikeInput = document.getElementById('longStrike');
  const shortStrikeInput = document.getElementById('shortStrike');
  const widthHint = document.getElementById('widthHint');

  const singleStrikeField = document.getElementById('singleStrikeField');
  const singleStrikeLabel = document.getElementById('singleStrikeLabel');
  const strikeInput = document.getElementById('strike');

  const premiumLabel = document.getElementById('premiumLabel');
  const premiumInput = document.getElementById('premium');

  const saveBtn = document.getElementById('saveBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const shareBtn = document.getElementById('shareBtn');
  const toast = document.getElementById('toast');

  let trades = load();
  let editingId = null;
  let currentStrategy = 'debit_spread';
  let currentType = 'call'; // debit spread only: call | put

  // ---------- storage ----------

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      // Legacy records (pre-CSP/CC) have no `strategy` field.
      return parsed.map((t) => (t.strategy ? t : { ...t, strategy: 'debit_spread' }));
    } catch (e) {
      return [];
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  // ---------- date helpers ----------

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function parseLocalDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function computeDTE(isoDate) {
    const exp = parseLocalDate(isoDate);
    const diffMs = exp.getTime() - startOfToday().getTime();
    return Math.round(diffMs / 86400000);
  }

  function formatDate(isoDate) {
    return parseLocalDate(isoDate).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  // ---------- rendering ----------

  function render() {
    subtitleDate.textContent =
      'Debit Spreads · Wheel · ' + new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    countBadge.textContent = trades.length + ' QUEUED';

    if (trades.length === 0) {
      list.hidden = true;
      emptyState.hidden = false;
      list.innerHTML = '';
      return;
    }

    emptyState.hidden = true;
    list.hidden = false;

    const sorted = [...trades].sort((a, b) => a.expiration.localeCompare(b.expiration));

    list.innerHTML = sorted.map(cardHTML).join('');

    list.querySelectorAll('[data-id]').forEach((el) => {
      el.addEventListener('click', () => openForm(el.getAttribute('data-id')));
    });
  }

  function cardHTML(t) {
    const dte = computeDTE(t.expiration);
    const expired = dte < 0;
    const bottomLabel = expired
      ? 'Expired ' + formatDate(t.expiration)
      : 'Exp ' + formatDate(t.expiration) + ' · ' + dte + ' DTE';

    let pillClass, pillLabel, midHTML, premiumLabelText;

    if (t.strategy === 'csp' || t.strategy === 'cc') {
      pillClass = STRATEGIES[t.strategy].pillClass;
      pillLabel = STRATEGIES[t.strategy].pillText;
      premiumLabelText = 'Target Premium';
      midHTML = `
        <div class="col-left">
          <div class="field-label">Strike</div>
          <div class="card-value">${fmtStrike(t.strike)}</div>
        </div>
        <div class="col-right">
          <div class="field-label">${premiumLabelText}</div>
          <div class="card-value premium">$${Number(t.targetPremium).toFixed(2)}</div>
        </div>
      `;
    } else {
      const width = Math.abs(t.longStrike - t.shortStrike);
      const widthStr = Number.isInteger(width) ? width : width.toFixed(1);
      pillClass = t.spreadType === 'call' ? 'call' : 'put';
      pillLabel = t.spreadType === 'call' ? 'CALL SPREAD' : 'PUT SPREAD';
      midHTML = `
        <div class="col-left">
          <div class="field-label">Strikes</div>
          <div class="card-value">${fmtStrike(t.longStrike)} / ${fmtStrike(t.shortStrike)} <span class="dim">· $${widthStr} wide</span></div>
        </div>
        <div class="col-right">
          <div class="field-label">Target Debit</div>
          <div class="card-value premium">$${Number(t.targetDebit).toFixed(2)}</div>
        </div>
      `;
    }

    return `
      <div class="card" data-id="${escapeAttr(t.id)}">
        <div class="card-top">
          <div class="card-ticker">${escapeHTML(t.ticker)}</div>
          <div class="pill ${pillClass}">${pillLabel}</div>
        </div>
        <div class="card-mid">${midHTML}</div>
        <div class="card-bottom${expired ? ' expired' : ''}">${bottomLabel}</div>
      </div>
    `;
  }

  function fmtStrike(n) {
    return String(n);
  }

  function escapeHTML(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  // ---------- form ----------

  function setStrategy(strategy) {
    currentStrategy = strategy;

    segStratDS.classList.toggle('active', strategy === 'debit_spread');
    segStratCSP.classList.toggle('active', strategy === 'csp');
    segStratCC.classList.toggle('active', strategy === 'cc');

    const isSpread = strategy === 'debit_spread';
    dsTypeField.hidden = !isSpread;
    dsStrikesField.hidden = !isSpread;
    singleStrikeField.hidden = isSpread;

    if (strategy === 'csp') {
      singleStrikeLabel.textContent = 'Strike (Put)';
    } else if (strategy === 'cc') {
      singleStrikeLabel.textContent = 'Strike (Call)';
    }

    premiumLabel.textContent = isSpread ? 'Ideal Premium (Debit)' : 'Target Premium (Credit)';

    updateSaveButtonStyle();
  }

  function updateSaveButtonStyle() {
    saveBtn.classList.remove('put', 'csp', 'cc');
    if (currentStrategy === 'debit_spread') {
      saveBtn.classList.toggle('put', currentType === 'put');
    } else {
      saveBtn.classList.add(currentStrategy);
    }
    saveBtn.textContent = editingId ? 'Save Changes' : 'Save Trade Idea';
  }

  function setType(type) {
    currentType = type;
    segCall.classList.toggle('active', type === 'call');
    segPut.classList.toggle('active', type === 'put');
    updateSaveButtonStyle();
  }

  function updateWidthHint() {
    const l = parseFloat(longStrikeInput.value);
    const s = parseFloat(shortStrikeInput.value);
    if (!isNaN(l) && !isNaN(s) && l !== s) {
      const w = Math.abs(l - s);
      widthHint.textContent = '$' + (Number.isInteger(w) ? w : w.toFixed(1)) + ' wide';
    } else {
      widthHint.innerHTML = '&nbsp;';
    }
  }

  function updateDteHint() {
    if (expirationInput.value) {
      const dte = computeDTE(expirationInput.value);
      dteHint.textContent = dte < 0 ? 'Expired' : dte + ' DTE';
    } else {
      dteHint.textContent = '';
    }
  }

  function openForm(id) {
    formError.textContent = '';
    tradeForm.reset();

    if (id) {
      const t = trades.find((x) => x.id === id);
      if (!t) return;
      editingId = id;
      sheetTitle.textContent = 'Edit Trade Idea';
      tickerInput.value = t.ticker;
      expirationInput.value = t.expiration;

      setStrategy(t.strategy);

      if (t.strategy === 'debit_spread') {
        longStrikeInput.value = t.longStrike;
        shortStrikeInput.value = t.shortStrike;
        premiumInput.value = t.targetDebit;
        setType(t.spreadType);
      } else {
        strikeInput.value = t.strike;
        premiumInput.value = t.targetPremium;
      }

      deleteBtn.hidden = false;
    } else {
      editingId = null;
      sheetTitle.textContent = 'New Trade Idea';
      setStrategy('debit_spread');
      setType('call');
      deleteBtn.hidden = true;
    }

    updateSaveButtonStyle();
    updateWidthHint();
    updateDteHint();

    overlay.classList.add('open');
    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => tickerInput.focus({ preventScroll: true }), 300);
  }

  function closeForm() {
    overlay.classList.remove('open');
    sheet.classList.remove('open');
    document.body.style.overflow = '';
    editingId = null;
  }

  function handleSubmit(e) {
    e.preventDefault();
    formError.textContent = '';

    const ticker = tickerInput.value.trim().toUpperCase();
    const expiration = expirationInput.value;
    const premium = parseFloat(premiumInput.value);

    if (!ticker) return showError('Enter a ticker.');
    if (!expiration) return showError('Pick an expiration date.');
    if (isNaN(premium) || premium <= 0) {
      return showError(currentStrategy === 'debit_spread' ? 'Enter a target debit above 0.' : 'Enter a target premium above 0.');
    }

    let trade = {
      id: editingId || uid(),
      strategy: currentStrategy,
      ticker,
      expiration,
      createdAt: editingId
        ? (trades.find((t) => t.id === editingId) || {}).createdAt || Date.now()
        : Date.now(),
    };

    if (currentStrategy === 'debit_spread') {
      const longStrike = parseFloat(longStrikeInput.value);
      const shortStrike = parseFloat(shortStrikeInput.value);
      if (isNaN(longStrike) || isNaN(shortStrike)) return showError('Enter both strikes.');
      if (longStrike === shortStrike) return showError('Long and short strikes must differ.');
      trade.spreadType = currentType;
      trade.longStrike = longStrike;
      trade.shortStrike = shortStrike;
      trade.targetDebit = premium;
    } else {
      const strike = parseFloat(strikeInput.value);
      if (isNaN(strike)) return showError('Enter a strike.');
      trade.strike = strike;
      trade.targetPremium = premium;
    }

    if (editingId) {
      trades = trades.map((t) => (t.id === editingId ? trade : t));
    } else {
      trades.push(trade);
    }

    persist();
    render();
    closeForm();
  }

  function showError(msg) {
    formError.textContent = msg;
  }

  function handleDelete() {
    if (!editingId) return;
    if (!confirm('Delete this trade idea?')) return;
    trades = trades.filter((t) => t.id !== editingId);
    persist();
    render();
    closeForm();
  }

  // ---------- export / share ----------

  function buildMarkdown() {
    const exportedOn = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    let md = `# Session Plan\n_Exported ${exportedOn}_\n`;

    if (trades.length === 0) {
      return md + '\nNo trade ideas queued.\n';
    }

    const byStrategy = (s) => trades.filter((t) => t.strategy === s).sort((a, b) => a.expiration.localeCompare(b.expiration));
    const ds = byStrategy('debit_spread');
    const csp = byStrategy('csp');
    const cc = byStrategy('cc');

    if (ds.length) {
      md += '\n## Debit Spreads\n\n';
      md += '| Ticker | Type | Strikes | Width | Expiration | DTE | Target Debit |\n';
      md += '|---|---|---|---|---|---|---|\n';
      ds.forEach((t) => {
        const width = Math.abs(t.longStrike - t.shortStrike);
        const widthStr = Number.isInteger(width) ? width : width.toFixed(1);
        const typeLabel = t.spreadType === 'call' ? 'Call Spread' : 'Put Spread';
        md += `| ${t.ticker} | ${typeLabel} | ${fmtStrike(t.longStrike)} / ${fmtStrike(t.shortStrike)} | $${widthStr} | ${formatDate(t.expiration)} | ${computeDTE(t.expiration)} | $${Number(t.targetDebit).toFixed(2)} |\n`;
      });
    }

    if (csp.length) {
      md += '\n## Cash Secured Puts\n\n';
      md += '| Ticker | Strike | Expiration | DTE | Target Premium |\n';
      md += '|---|---|---|---|---|\n';
      csp.forEach((t) => {
        md += `| ${t.ticker} | ${fmtStrike(t.strike)} | ${formatDate(t.expiration)} | ${computeDTE(t.expiration)} | $${Number(t.targetPremium).toFixed(2)} |\n`;
      });
    }

    if (cc.length) {
      md += '\n## Covered Calls\n\n';
      md += '| Ticker | Strike | Expiration | DTE | Target Premium |\n';
      md += '|---|---|---|---|---|\n';
      cc.forEach((t) => {
        md += `| ${t.ticker} | ${fmtStrike(t.strike)} | ${formatDate(t.expiration)} | ${computeDTE(t.expiration)} | $${Number(t.targetPremium).toFixed(2)} |\n`;
      });
    }

    return md;
  }

  let toastTimer = null;
  function flashToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  async function handleShare() {
    const markdown = buildMarkdown();
    const filename = `session-plan-${new Date().toISOString().slice(0, 10)}.md`;

    if (navigator.share) {
      try {
        const file = new File([markdown], filename, { type: 'text/markdown' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Session Plan' });
          return;
        }
        await navigator.share({ title: 'Session Plan', text: markdown });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user dismissed the share sheet
        // fall through to clipboard fallback below
      }
    }

    try {
      await navigator.clipboard.writeText(markdown);
      flashToast('Copied to clipboard');
    } catch (e) {
      flashToast('Could not share');
    }
  }

  // ---------- wire up ----------

  document.getElementById('addBtn').addEventListener('click', () => openForm(null));
  document.getElementById('closeBtn').addEventListener('click', closeForm);
  overlay.addEventListener('click', closeForm);

  segStratDS.addEventListener('click', () => setStrategy('debit_spread'));
  segStratCSP.addEventListener('click', () => setStrategy('csp'));
  segStratCC.addEventListener('click', () => setStrategy('cc'));

  segCall.addEventListener('click', () => setType('call'));
  segPut.addEventListener('click', () => setType('put'));
  longStrikeInput.addEventListener('input', updateWidthHint);
  shortStrikeInput.addEventListener('input', updateWidthHint);
  expirationInput.addEventListener('change', updateDteHint);
  tradeForm.addEventListener('submit', handleSubmit);
  deleteBtn.addEventListener('click', handleDelete);
  shareBtn.addEventListener('click', handleShare);

  render();

  // ---------- service worker ----------

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then((reg) => reg.update()) // force a check for a new version on every launch
        .catch(() => {});
    });

    // When a new service worker takes over (a real update, not first
    // install), reload once so the page picks up the new version right
    // away instead of needing a second manual relaunch.
    let refreshedOnce = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshedOnce) return;
      refreshedOnce = true;
      window.location.reload();
    });
  }
})();
