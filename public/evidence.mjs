import { auditRecord } from './ledger.mjs';

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const HASH = /^0x[0-9a-f]{64}$/;

async function commitmentFor(record) {
  const bytes = new TextEncoder().encode(JSON.stringify(record));
  return '0x' + hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

export function newSalt() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createEvidence(match, salt) {
  const record = auditRecord(match, salt);
  return { algorithm: 'sha256', commitment: await commitmentFor(record), record };
}

export async function verifyEvidence(document) {
  const { algorithm, commitment, record } = document || {};
  if (algorithm !== 'sha256' || !HASH.test(commitment) || record?.version !== 'merchantflow/reconciliation/1' ||
      !/^[0-9a-f]{64}$/.test(record.salt)) throw new Error('Choose a supported MerchantFlow evidence export.');
  if (await commitmentFor(record) !== commitment) throw new Error('The evidence digest does not match.');
  return commitment;
}
