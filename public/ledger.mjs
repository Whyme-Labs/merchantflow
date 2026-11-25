export const ASSETS = Object.freeze({ QUSDC: 6, QIE: 18 });
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';
const MAX_GROUP_INPUTS = 24;
const MAX_SOURCE_ROWS = 500;
const MAX_CANDIDATES_PER_ACCOUNT = 100;

export function address(value) {
  if (!ADDRESS.test(value) || value.toLowerCase() === ZERO) {
    throw new Error('Use a non-zero EVM address (0x followed by 40 hex characters).');
  }
  return value.toLowerCase();
}

export function units(value, asset) {
  const decimals = ASSETS[asset];
  if (!Object.hasOwn(ASSETS, asset) || typeof value !== 'string' || !/^\d{1,35}(\.\d+)?$/.test(value)) {
    throw new Error('Use a positive decimal amount and QIE or QUSDC.');
  }
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error('Too many decimal places for ' + asset + '.');
  const result = BigInt(whole + fraction.padEnd(decimals, '0'));
  if (result === 0n) throw new Error('Amounts must be greater than zero.');
  return result;
}

export function amount(value, asset, minDecimals = 2) {
  const decimals = ASSETS[asset];
  const padded = value.toString().padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '').padEnd(minDecimals, '0');
  return fraction ? whole + '.' + fraction : whole;
}

function csvRows(content) {
  if (content.length > 1_000_000) throw new Error('CSV files must be at most 1 MB.');
  const rows = [];
  let row = [], field = '', quoted = false, afterQuote = false;
  const endField = () => { row.push(field.trim()); field = ''; afterQuote = false; };
  const endRow = () => { endField(); if (row.some(Boolean)) rows.push(row); row = []; };
  const input = content.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character !== '"') field += character;
      else if (input[index + 1] === '"') { field += '"'; index += 1; }
      else { quoted = false; afterQuote = true; }
    } else if (character === ',') endField();
    else if (character === '\n' || character === '\r') {
      endRow();
      if (character === '\r' && input[index + 1] === '\n') index += 1;
    } else if (afterQuote || (character === '"' && field)) throw new Error('Unexpected character in a quoted CSV field.');
    else if (character === '"') quoted = true;
    else field += character;
  }
  if (quoted) throw new Error('A quoted CSV field is still open at the end of the file.');
  endRow();
  return rows;
}

function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use dates in YYYY-MM-DD format.');
  const parsed = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Use a valid date.');
  }
  return value;
}

const FIELDS = {
  invoices: ['invoice_id', 'customer', 'payer', 'recipient', 'asset', 'amount', 'issued_at'],
  payments: ['payment_id', 'payer', 'recipient', 'asset', 'amount', 'received_at'],
};

export function importCsv(content, type, source) {
  const [header, ...rows] = csvRows(content);
  const fields = FIELDS[type];
  if (!header || !rows.length || !fields || !fields.every(field => header.includes(field))) {
    throw new Error('Expected CSV columns: ' + fields?.join(', ') + '.');
  }
  if (new Set(header).size !== header.length) throw new Error('CSV column names must be unique.');
  if (rows.length > MAX_SOURCE_ROWS) throw new Error('Import up to 500 rows at a time.');
  const records = rows.map((row, index) => {
    try {
      if (row.length !== header.length) throw new Error('Column count does not match the header.');
      const record = Object.fromEntries(header.map((field, column) => [field, row[column]]));
      const id = record[fields[0]];
      if (!id || id.length > 160 || (type === 'invoices' && !record.customer)) throw new Error('Add a record ID and customer name for invoice rows.');
      return { id, title: record.customer || id, payer: address(record.payer), recipient: address(record.recipient),
        asset: record.asset, value: units(record.amount, record.asset), date: date(record[fields.at(-1)]), source,
        ...(type === 'payments' ? { evidence: { kind: 'statement' } } : {}) };
    } catch (error) {
      throw new Error('Data row ' + (index + 1) + ': ' + error.message);
    }
  });
  return mergeRecords([], records);
}

export function mergeRecords(existing, incoming) {
  const records = new Map(existing.map(record => [record.id, record]));
  for (const record of incoming) {
    const prior = records.get(record.id);
    if (prior) {
      const same = ['payer', 'recipient', 'asset', 'value', 'date', 'title'].every(key => prior[key] === record[key])
        && JSON.stringify(prior.evidence) === JSON.stringify(record.evidence);
      if (!same) throw new Error('Conflicting data for ' + record.id + '.');
      continue;
    }
    records.set(record.id, record);
  }
  if (records.size > MAX_SOURCE_ROWS) throw new Error('A ledger holds up to 500 invoice rows and 500 payment rows.');
  return [...records.values()];
}

const sum = records => records.reduce((total, record) => total + record.value, 0n);
const accountKey = record => [record.asset, record.payer, record.recipient].join(':');
const recordKeys = match => [...match.invoices.map(row => 'i:' + row.id), ...match.payments.map(row => 'p:' + row.id)];

function bundles(records) {
  const options = [];
  for (const [i, first] of records.entries()) {
    for (let j = i + 1; j < records.length; j += 1) {
      options.push([first, records[j]]);
      for (let k = j + 1; k < records.length; k += 1) options.push([first, records[j], records[k]]);
    }
  }
  return options;
}

function candidates(invoices, payments) {
  const matches = [];
  const add = (invoiceRows, paymentRows) => {
    const value = sum(invoiceRows);
    if (value !== sum(paymentRows) || paymentRows.some(payment => invoiceRows.some(invoice => payment.date < invoice.date))) return;
    matches.push({
      id: JSON.stringify([invoiceRows.map(row => row.id).sort(), paymentRows.map(row => row.id).sort()]),
      type: invoiceRows.length > 1 ? 'Bundled' : paymentRows.length > 1 ? 'Split' : 'Direct',
      invoices: invoiceRows, payments: paymentRows, asset: invoiceRows[0].asset, value,
    });
  };
  const paymentBundles = bundles(payments), invoiceBundles = bundles(invoices);
  for (const invoice of invoices) {
    for (const payment of payments) add([invoice], [payment]);
    for (const group of paymentBundles) add([invoice], group);
    if (matches.length > MAX_CANDIDATES_PER_ACCOUNT) return null;
  }
  for (const payment of payments) {
    for (const group of invoiceBundles) add(group, [payment]);
    if (matches.length > MAX_CANDIDATES_PER_ACCOUNT) return null;
  }
  return matches;
}

function groupMatches(matches) {
  const byRecord = new Map();
  for (const match of matches) {
    for (const key of recordKeys(match)) {
      if (!byRecord.has(key)) byRecord.set(key, []);
      byRecord.get(key).push(match);
    }
  }
  const visited = new Set();
  const groups = [];
  for (const match of matches) {
    if (visited.has(match.id)) continue;
    const group = [match];
    visited.add(match.id);
    for (const option of group) {
      for (const key of recordKeys(option)) {
        for (const neighbor of byRecord.get(key)) {
          if (visited.has(neighbor.id)) continue;
          group.push(neighbor);
          visited.add(neighbor.id);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export function reconcile(invoices, payments, approvals = []) {
  const reserved = new Set(approvals.flatMap(recordKeys));
  const openInvoices = invoices.filter(row => !reserved.has('i:' + row.id));
  const openPayments = payments.filter(row => !reserved.has('p:' + row.id));
  const accounts = new Map();
  const add = (rows, side) => {
    for (const row of rows) {
      const key = accountKey(row);
      if (!accounts.has(key)) accounts.set(key, { invoices: [], payments: [] });
      accounts.get(key)[side].push(row);
    }
  };
  add(openInvoices, 'invoices');
  add(openPayments, 'payments');
  const groups = [], withheld = [];
  for (const batch of accounts.values()) {
    if (!batch.invoices.length || !batch.payments.length) continue;
    const matches = Math.max(batch.invoices.length, batch.payments.length) <= MAX_GROUP_INPUTS
      ? candidates(batch.invoices, batch.payments) : null;
    if (matches) groups.push(...groupMatches(matches));
    else withheld.push(batch);
  }
  const proposed = new Set([...groups.flat().flatMap(recordKeys), ...withheld.flatMap(recordKeys)]);
  return {
    groups: groups.sort((a, b) => b.length - a.length), withheld,
    unmatchedInvoices: openInvoices.filter(row => !proposed.has('i:' + row.id)),
    unmatchedPayments: openPayments.filter(row => !proposed.has('p:' + row.id)),
  };
}

export function approve(invoices, payments, approvals, matchId) {
  const option = reconcile(invoices, payments, approvals).groups.flat().find(match => match.id === matchId);
  if (!option) throw new Error('This option is no longer available. Refresh the review.');
  return [...approvals, option];
}

export function auditRecord(match, salt) {
  const pair = row => [row.id, row.value.toString()];
  const byId = (a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  return {
    version: 'merchantflow/reconciliation/1', salt, asset: match.asset, value: match.value.toString(),
    payer: match.invoices[0].payer, recipient: match.invoices[0].recipient,
    invoices: match.invoices.map(pair).sort(byId),
    payments: match.payments.map(row => [...pair(row), row.evidence]).sort(byId),
  };
}
