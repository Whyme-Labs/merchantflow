import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvidence, newSalt, verifyEvidence } from '../public/evidence.mjs';
import { importCsv, reconcile } from '../public/ledger.mjs';
import { SAMPLE_INVOICES, SAMPLE_PAYMENTS } from '../public/sample.mjs';
import { qieAnchorStatus } from '../public/qie.mjs';

const invoices = importCsv(SAMPLE_INVOICES, 'invoices', 'fixture');
const payments = importCsv(SAMPLE_PAYMENTS, 'payments', 'fixture');

test('matches a browser-style export to its commitment and rejects changed evidence and unsupported algorithms', async () => {
  const [[match]] = reconcile(invoices, payments).groups;
  const salt = newSalt();
  const expected = await createEvidence(match, salt);
  const reread = JSON.parse(JSON.stringify(expected));
  assert.equal(await verifyEvidence(reread), expected.commitment);
  assert.deepEqual(await createEvidence(match, salt), expected);
  reread.record.value = '2';
  await assert.rejects(verifyEvidence(reread), /digest does not match/);
  await assert.rejects(verifyEvidence({ ...expected, algorithm: 'none' }), /supported MerchantFlow evidence/);
});

test('rejects an unknown runtime without asking it to interpret an anchor', async () => {
  const callLog = [];
  const rpc = async method => {
    callLog.push(method);
    return { eth_chainId: '0x7c6', eth_blockNumber: '0x2', eth_getCode: '0x1234' }[method];
  };
  await assert.rejects(qieAnchorStatus(rpc, '0x' + 'a'.repeat(40), {
    publisher: '0x' + 'b'.repeat(40), commitment: '0x' + 'c'.repeat(64),
  }), /runtime bytecode/);
  assert.equal(callLog.includes('eth_call'), false);
});
