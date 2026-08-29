(() => {
  'use strict';

  const STORAGE_KEY = 'tradeIdeas.debitSpreads.v1';

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
  const segCall = document.getElementById('segCall');
  const segPut = document.getElementById('segPut');
  const expirationInput = document.getElementById('expiration');
  const dteHint = document.getElementById('dteHint');
  const longStrikeInput = document.getElementById('longStrike');
  const shortStrikeInput = document.getElementById('shortStrike');
  const widthHint = document.getElementById('widthHint');
  const targetDebitInput = document.getElementById('targetDebit');
  const saveBtn = document.getElementById('saveBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  let trades = load();
  let editingId = null;
  let currentType = 'call';

  // ---------- storage ----------

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
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
      'Debit Spreads · ' + new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    countBadge.textContent = trades.length + (trades.length === 1 ? ' QUEUED' : ' QUEUED');

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
    const width = Math.abs(t.longStrike - t.shortStrike);
    const widthStr = Number.isInteger(width) ? width : width.toFixed(1);
    const pillClass = t.spreadType === 'call' ? 'call' : 'put';
    const pillLabel = t.spreadType === 'call' ? 'CALL SPREAD' : 'PUT SPREAD';
    const bottomLabel = expired
      ? 'Expired ' + formatDate(t.expiration)
      : 'Exp ' + formatDate(t.expiration) + ' · ' + dte + ' DTE';

    return `
      <div class="card" data-id="${escapeAttr(t.id)}">
        <div class="card-top">
          <div class="card-ticker">${escapeHTML(t.ticker)}</div>
          <div class="pill ${pillClass}">${pillLabel}</div>
        </div>
        <div class="card-mid">
          <div class="col-left">
            <div class="field-label">Strikes</div>
            <div class="card-value">${fmtStrike(t.longStrike)} / ${fmtStrike(t.shortStrike)} <span class="dim">· $${widthStr} wide</span></div>
          </div>
          <div class="col-right">
            <div class="field-label">Target Debit</div>
            <div class="card-value debit">$${Number(t.targetDebit).toFixed(2)}</div>
          </div>
        </div>
        <div class="card-bottom${expired ? ' expired' : ''}">${bottomLabel}</div>
      </div>
    `;
  }

  function fmtStrike(n) {
    return Number.isInteger(n) ? String(n) : String(n);
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

  function setType(type) {
    currentType = type;
    segCall.classList.toggle('active', type === 'call');
    segPut.classList.toggle('active', type === 'put');
    saveBtn.classList.toggle('put', type === 'put');
    saveBtn.textContent = deleteBtn.hidden ? 'Save Trade Idea' : 'Save Changes';
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
      longStrikeInput.value = t.longStrike;
      shortStrikeInput.value = t.shortStrike;
      targetDebitInput.value = t.targetDebit;
      setType(t.spreadType);
      deleteBtn.hidden = false;
    } else {
      editingId = null;
      sheetTitle.textContent = 'New Trade Idea';
      setType('call');
      deleteBtn.hidden = true;
    }

    saveBtn.textContent = editingId ? 'Save Changes' : 'Save Trade Idea';
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
    const longStrike = parseFloat(longStrikeInput.value);
    const shortStrike = parseFloat(shortStrikeInput.value);
    const targetDebit = parseFloat(targetDebitInput.value);

    if (!ticker) return showError('Enter a ticker.');
    if (!expiration) return showError('Pick an expiration date.');
    if (isNaN(longStrike) || isNaN(shortStrike)) return showError('Enter both strikes.');
    if (longStrike === shortStrike) return showError('Long and short strikes must differ.');
    if (isNaN(targetDebit) || targetDebit <= 0) return showError('Enter a target debit above 0.');

    const trade = {
      id: editingId || uid(),
      ticker,
      spreadType: currentType,
      expiration,
      longStrike,
      shortStrike,
      targetDebit,
      createdAt: editingId
        ? (trades.find((t) => t.id === editingId) || {}).createdAt || Date.now()
        : Date.now(),
    };

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

  // ---------- wire up ----------

  document.getElementById('addBtn').addEventListener('click', () => openForm(null));
  document.getElementById('closeBtn').addEventListener('click', closeForm);
  overlay.addEventListener('click', closeForm);
  segCall.addEventListener('click', () => setType('call'));
  segPut.addEventListener('click', () => setType('put'));
  longStrikeInput.addEventListener('input', updateWidthHint);
  shortStrikeInput.addEventListener('input', updateWidthHint);
  expirationInput.addEventListener('change', updateDteHint);
  tradeForm.addEventListener('submit', handleSubmit);
  deleteBtn.addEventListener('click', handleDelete);

  render();

  // ---------- service worker ----------

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
