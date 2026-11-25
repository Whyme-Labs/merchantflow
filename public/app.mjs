import { amount, approve, auditRecord, importCsv, mergeRecords, reconcile, units } from './ledger.mjs';
import { SAMPLE_INVOICES, SAMPLE_PAYMENTS } from './sample.mjs';

const $ = selector => document.querySelector(selector);
const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = value => String(value).replace(/[&<>"']/g, match => escapes[match]);
const money = (value, asset) => amount(value, asset) + ' ' + asset;
const short = value => value.length > 22 ? value.slice(0, 10) + '…' + value.slice(-6) : value;
const count = (n, singular, plural = singular + 's') => n + ' ' + (n === 1 ? singular : plural);
const fromDemo = () => ({
  mode: 'demo', invoices: importCsv(SAMPLE_INVOICES, 'invoices', 'Sample invoice CSV'),
  payments: importCsv(SAMPLE_PAYMENTS, 'payments', 'Sample transfer statement'),
  approvals: [], salts: new Map(), selected: null, tab: 'review', status: '',
});
const emptyLedger = () => ({ mode: 'live', invoices: [], payments: [], approvals: [], salts: new Map(), selected: null, tab: 'review', status: '' });
let state = fromDemo();
let receiptPreview = [];
let receiptSequence = 0;

function summary(results) {
  const totals = new Map();
  for (const match of state.approvals) totals.set(match.asset, (totals.get(match.asset) || 0n) + match.value);
  const [firstTotal] = totals;
  const totalLabel = totals.size === 1 ? money(firstTotal[1], firstTotal[0])
    : totals.size > 1 ? count(totals.size, 'asset') : '0';
  const pending = results.groups.length;
  const ambiguous = results.groups.filter(group => group.length > 1).length;
  const cells = [
    ['Invoices', state.invoices.length, state.mode === 'demo' ? 'Sample records' : 'From CSV'],
    ['Incoming payments', state.payments.length, state.mode === 'demo' ? 'Sample records' : 'Verified QIE mainnet receipts'],
    ['Review groups', pending, ambiguous ? count(ambiguous, 'ambiguous group') : 'Ready for review'],
    ['Approved value', totalLabel, count(state.approvals.length, 'match', 'matches')],
  ];
  $('#summary').innerHTML = cells.map(([label, value, detail]) => `<div class="summary-cell"><span class="summary-label">${label}</span><span class="summary-value">${escape(value)}</span><span class="summary-detail">${detail}</span></div>`).join('');
}

function card(match, options, alreadyApproved) {
  const selected = match.id === state.selected;
  const refs = [...match.invoices, ...match.payments].map(row => short(row.id)).join(' · ');
  const status = alreadyApproved ? 'Approved' : options > 1 ? 'Needs review' : 'Single candidate';
  return `<button class="match-card" type="button" aria-pressed="${selected}" data-match="${escape(match.id)}">
    <span><strong>${escape(match.invoices[0].title)}</strong><small class="shape">${match.type} · ${count(match.invoices.length, 'invoice')} / ${count(match.payments.length, 'payment')}</small></span>
    <span><span class="money">${money(match.value, match.asset)}</span></span>
    <small class="refs">${escape(refs)}</small><span><span class="pill${options > 1 ? ' warn' : ''}">${status}</span></span>
  </button>`;
}

function reviewQueue(results) {
  const list = results.groups.map(group => `<section class="queue-group">${group.length > 1 ? `<h3>${count(group.length, 'candidate')} compete for the same records</h3>` : ''}${group.map(option => card(option, group.length, false)).join('')}</section>`).join('');
  const exceptionRows = [...results.unmatchedInvoices.map(row => ['Invoice', row]), ...results.unmatchedPayments.map(row => ['Payment', row])];
  const withheldCount = results.withheld.reduce((total, batch) => total + batch.invoices.length + batch.payments.length, 0);
  const exceptions = [...exceptionRows.map(([type, row]) => `<li>${type} ${escape(short(row.id))} · ${money(row.value, row.asset)} · no exact eligible match</li>`),
    ...(withheldCount ? [`<li>${count(withheldCount, 'record')} exceeded the matching limit. Prepare a smaller ledger for that payer.</li>`] : [])];
  return (list || '<p class="empty">No proposed matches. Import invoices and verify incoming QIE receipts to get started.</p>') +
    (exceptions.length ? `<details class="exceptions"><summary>${count(exceptionRows.length + withheldCount, 'record')} without a proposed match</summary><ul>${exceptions.join('')}</ul></details>` : '');
}

function evidencePayment(row) {
  if (row.evidence.kind === 'statement') return `<small>${escape(row.source)} · ${row.date}</small>`;
  const { tx, block, position } = row.evidence;
  return `<small><a href="https://mainnet.qie.digital/tx/${encodeURIComponent(tx)}" target="_blank" rel="noopener">Explorer receipt ↗</a> · block ${escape(block)} · ${position === 'native' ? 'native transfer' : 'log ' + escape(position)} · ${row.date}</small>`;
}

function inspector(match, options) {
  if (!match) return '<h2>Match evidence</h2><p class="explanation">Select a match to inspect its invoice records and payment evidence.</p>';
  const isApproved = state.tab === 'approved';
  const explanation = isApproved ? 'This approval reserves all listed records. Export its evidence before closing the tab.'
    : options > 1 ? 'Another exact match uses some of these records. Confirm the invoice allocation before approving.'
      : 'Amounts, asset, payer and recipient agree. No payment predates an invoice in this match.';
  const rows = (records, evidence) => records.map(row => `<div class="detail-item"><span>${escape(short(row.id))}<br>${evidence(row)}</span><span>${money(row.value, row.asset)}</span></div>`).join('');
  return `<h2>Match evidence</h2><p class="explanation">${explanation}</p>
    <div class="detail-block"><h3>${count(match.invoices.length, 'invoice')}</h3>${rows(match.invoices, row => `<small>${escape(row.source)} · ${row.date}</small>`)}</div>
    <div class="detail-block"><h3>${count(match.payments.length, 'payment')}</h3>${rows(match.payments, evidencePayment)}</div>
    <div class="detail-block"><h3>Settlement wallets</h3>
      <div class="detail-account"><span>Payer</span><code tabindex="0" title="${match.invoices[0].payer}">${match.invoices[0].payer}</code></div>
      <div class="detail-account"><span>Recipient</span><code tabindex="0" title="${match.invoices[0].recipient}">${match.invoices[0].recipient}</code></div>
    </div>
    <div class="approval">${isApproved ? '<button class="button primary" type="button" id="export">Export evidence ↓</button><button class="text-button" type="button" id="undo">Undo approval</button>'
    : '<button class="button primary" type="button" id="approve">Approve match</button>'}</div>`;
}

function render() {
  const results = reconcile(state.invoices, state.payments, state.approvals);
  if (state.tab === 'review') {
    const available = results.groups.flat();
    if (!available.some(match => match.id === state.selected)) state.selected = available[0]?.id;
  } else if (!state.approvals.some(match => match.id === state.selected)) state.selected = state.approvals.at(-1)?.id;
  summary(results);
  for (const tab of document.querySelectorAll('[data-tab]')) {
    tab.setAttribute('aria-pressed', String(tab.dataset.tab === state.tab));
  }
  const mode = state.mode === 'demo' ? 'Sample ledger' : 'Live ledger';
  const switchLabel = state.mode === 'demo' ? 'New ledger' : 'Load demo';
  $('#ledger-mode').innerHTML = `<span class="mode-label">${mode}</span><button class="text-button" id="switch-mode" type="button">${switchLabel}</button>`;
  const status = $('#ledger-status');
  status.textContent = state.status;
  status.hidden = !state.status;
  $('#queue').innerHTML = state.tab === 'review' ? reviewQueue(results) : (state.approvals.length
    ? `<section class="queue-group">${state.approvals.map(match => card(match, 1, true)).join('')}</section>` : '<p class="empty">Approved matches will appear here.</p>');
  const selectedGroup = results.groups.find(group => group.some(match => match.id === state.selected));
  const selected = (state.tab === 'review' ? selectedGroup : state.approvals)?.find(match => match.id === state.selected);
  $('#inspector').innerHTML = inspector(selected, selectedGroup?.length || 0);
  return selected;
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

async function exportEvidence(match) {
  if (!state.salts.has(match.id)) state.salts.set(match.id, hex(crypto.getRandomValues(new Uint8Array(32))));
  const salt = state.salts.get(match.id);
  const record = auditRecord(match, salt);
  const bytes = new TextEncoder().encode(JSON.stringify(record));
  const commitment = '0x' + hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  download('merchantflow-evidence.json', JSON.stringify({ algorithm: 'sha256', commitment, record }, null, 2) + '\n', 'application/json');
}

function errorAt(selector, message = '') {
  const target = $(selector);
  target.textContent = message;
  target.hidden = !message;
}

async function get(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

async function checkNetwork() {
  const button = $('#network');
  button.disabled = true;
  try {
    const result = await get('/api/network');
    button.className = 'network live';
    button.lastChild.textContent = 'QIE mainnet · Block ' + result.block;
  } catch {
    button.className = 'network offline';
    button.lastChild.textContent = 'QIE check unavailable · Retry';
  } finally { button.disabled = false; }
}

function receiptControls(disabled) {
  for (const control of $('#receipt-form').querySelectorAll('input, button')) control.disabled = disabled;
}

async function verifyReceipt(sample) {
  const form = new FormData($('#receipt-form'));
  const sequence = ++receiptSequence;
  errorAt('#receipt-error');
  receiptPreview = [];
  const preview = $('#receipt-preview');
  preview.textContent = 'Looking up QIE mainnet receipt…';
  receiptControls(true);
  try {
    const query = new URLSearchParams({ tx: form.get('tx')?.trim(), recipient: form.get('recipient')?.trim() });
    const rows = await get(sample ? '/api/sample-receipt' : '/api/receipt?' + query);
    if (sequence !== receiptSequence) return;
    receiptPreview = rows.map(row => ({ ...row, title: row.id, value: units(row.amount, row.asset), source: 'QIE mainnet' }));
    preview.innerHTML = rows.map(row => `<p><strong>${escape(row.amount)} ${escape(row.asset)}</strong> · ${evidencePayment(row)}</p>`).join('') +
      `<p>Recipient ${escape(rows[0].recipient)}</p><button id="add-receipt" class="button primary" type="button">${state.mode === 'demo' ? 'Start ledger with receipt' : 'Add to ledger'}</button>`;
  } catch (error) {
    if (sequence !== receiptSequence) return;
    preview.textContent = '';
    errorAt('#receipt-error', error.message);
  } finally { if (sequence === receiptSequence) receiptControls(false); }
}

$('#invoice-open').addEventListener('click', () => {
  errorAt('#invoice-error');
  $('#invoice-form').reset();
  $('#invoice-dialog').showModal();
});
$('#template').addEventListener('click', event => {
  event.preventDefault();
  download('merchantflow-invoice-template.csv', SAMPLE_INVOICES.split('\n')[0] + '\n', 'text/csv');
});
$('#invoice-form').addEventListener('submit', async event => {
  event.preventDefault();
  const file = $('#invoice-file').files[0];
  errorAt('#invoice-error');
  try {
    if (!file || file.size > 1_000_000) throw new Error('Choose a CSV file no larger than 1 MB.');
    const records = importCsv(await file.text(), 'invoices', file.name);
    const working = state.mode === 'demo' ? emptyLedger() : state;
    const invoices = mergeRecords(working.invoices, records);
    state = { ...working, invoices, status: count(invoices.length - working.invoices.length, 'invoice') + ' added.' };
    $('#invoice-dialog').close();
    render();
  } catch (error) { errorAt('#invoice-error', error.message); }
});
$('#receipt-open').addEventListener('click', () => {
  receiptPreview = [];
  errorAt('#receipt-error');
  $('#receipt-form').reset();
  receiptControls(false);
  $('#receipt-preview').textContent = '';
  $('#receipt-dialog').showModal();
});
$('#receipt-dialog').addEventListener('close', () => { receiptSequence += 1; });
$('#receipt-form').addEventListener('submit', event => { event.preventDefault(); verifyReceipt(false); });
$('#sample-receipt').addEventListener('click', () => verifyReceipt(true));
$('#network').addEventListener('click', checkNetwork);

function addReceipt() {
  try {
    const working = state.mode === 'demo' ? emptyLedger() : state;
    const payments = mergeRecords(working.payments, receiptPreview);
    state = { ...working, payments, status: count(payments.length - working.payments.length, 'payment') + ' added.' };
    $('#receipt-dialog').close();
    render();
  } catch (error) { errorAt('#receipt-error', error.message); }
}

function selectMatch(button) {
  state.selected = button.dataset.match;
  render();
  const selected = document.querySelector('.match-card[aria-pressed="true"]');
  if (window.matchMedia('(max-width: 690px)').matches) $('#inspector').scrollIntoView({ block: 'nearest' });
  selected?.focus({ preventScroll: true });
}

async function evidenceAction(action) {
  try {
    if (action === 'approve') {
      state.approvals = approve(state.invoices, state.payments, state.approvals, state.selected);
      state.tab = 'approved';
      state.status = 'Match approved. Its invoice and payment records are reserved.';
    } else if (action === 'undo') {
      state.approvals = state.approvals.filter(match => match.id !== state.selected);
      state.salts.delete(state.selected);
      state.tab = 'review';
      state.status = 'Approval undone. Its records are available for review.';
    } else {
      await exportEvidence(state.approvals.find(match => match.id === state.selected));
      state.status = 'Evidence exported.';
    }
  } catch (error) { state.status = error.message; }
  render();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.tab) { state.tab = button.dataset.tab; render(); }
  else if (button.dataset.match) selectMatch(button);
  else if (button.id === 'switch-mode') {
    if (state.mode === 'live' && (state.invoices.length || state.payments.length) && !confirm('Discard this tab’s live ledger and load the demo?')) return;
    state = state.mode === 'demo' ? emptyLedger() : fromDemo();
    render();
  } else if (button.id === 'add-receipt') addReceipt();
  else if (['approve', 'undo', 'export'].includes(button.id)) evidenceAction(button.id);
});
render();
checkNetwork();
