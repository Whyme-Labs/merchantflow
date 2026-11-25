import test from 'node:test';
import assert from 'node:assert/strict';
import { amount, approve, auditRecord, importCsv, mergeRecords, reconcile, units } from '../public/ledger.mjs';
import { SAMPLE_INVOICES, SAMPLE_PAYMENTS } from '../public/sample.mjs';

const invoices = importCsv(SAMPLE_INVOICES, 'invoices', 'demo');
const payments = importCsv(SAMPLE_PAYMENTS, 'payments', 'demo');

test('represents full QIE and QUSDC precision and validates amount inputs', () => {
  assert.equal(units('0.000000000000000001', 'QIE'), 1n);
  assert.equal(amount(1n, 'QIE'), '0.000000000000000001');
  assert.equal(units('185.123456', 'QUSDC') + units('114.876544', 'QUSDC'), units('300', 'QUSDC'));
  assert.equal(amount(units('9007199254740993.000002', 'QUSDC'), 'QUSDC'), '9007199254740993.000002');
  for (const row of ['0', '-1', '1e3', '0.0000001']) assert.throws(() => units(row, 'QUSDC'));
});

test('recognizes exact split, bundled and direct candidates and flags conflicts', () => {
  const result = reconcile(invoices, payments);
  assert.deepEqual(result.groups.map(group => group.length).sort(), [1, 1, 1, 2]);
  assert.deepEqual(new Set(result.groups.flat().map(match => match.type)), new Set(['Direct', 'Split', 'Bundled']));
  assert.deepEqual(result.unmatchedInvoices.map(row => row.id), ['INV-1054']);
  assert.deepEqual(result.unmatchedPayments.map(row => row.id), ['PAY-231']);
  for (const match of result.groups.flat()) {
    const total = rows => rows.reduce((sum, row) => sum + row.value, 0n);
    assert.equal(total(match.invoices), total(match.payments));
  }
});

test('a reviewer approval reserves the payment across all competing matches', () => {
  const [first, alternate] = reconcile(invoices, payments).groups[0];
  const approved = approve(invoices, payments, [], first.id);
  assert.throws(() => approve(invoices, payments, approved, alternate.id), /no longer available/);
  assert.deepEqual(reconcile(invoices, payments, approved).unmatchedInvoices.map(row => row.id), ['INV-1052', 'INV-1054']);
  const receipt = auditRecord(first, 'review-salt');
  assert.deepEqual(receipt.invoices, [[first.invoices[0].id, '125000000']]);
  assert.equal(receipt.payments[0][1], receipt.value);
});

test('recipient, payer, currency and issuance date are strict boundaries', () => {
  const invoice = invoices[5];
  const payment = payments[4];
  for (const changes of [{ recipient: invoice.payer }, { payer: invoice.recipient }, { asset: 'QIE' }, { date: '2026-11-20' }]) {
    assert.equal(reconcile([invoice], [{ ...payment, ...changes }]).groups.length, 0);
  }
});

test('validates spreadsheet CSV, handles quoted fields and rejects conflicting repeated IDs', () => {
  const sample = '\uFEFF' + SAMPLE_INVOICES.replace('Horizon Supply', '"Horizon, ""Supply"""').replaceAll('\n', '\r\n');
  const records = importCsv(sample, 'invoices', 'quoted spreadsheet');
  assert.equal(records[0].title, 'Horizon, "Supply"');
  assert.throws(() => importCsv(SAMPLE_INVOICES.replace('2026-11-20', '2026-11-31'), 'invoices', 'bad date'), /valid date/);
  assert.equal(mergeRecords(invoices, invoices).length, invoices.length);
  assert.throws(() => mergeRecords(invoices, [{ ...invoices[0], value: 12n }]), /Conflicting data/);
});

test('large accounts are held for review instead of silently dropping possible conflicts', () => {
  const duplicates = Array.from({ length: 25 }, (_, index) => ({ ...invoices[0], id: 'invoice-' + index }));
  const result = reconcile(duplicates, payments);
  assert.equal(result.groups.length, 0);
  assert.equal(result.withheld[0].invoices.length, 25);
});
