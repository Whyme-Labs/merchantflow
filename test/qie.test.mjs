import test from 'node:test';
import assert from 'node:assert/strict';
import { QUSDC, qieReceipt, qieNetwork, TRANSFER_TOPIC } from '../qie.mjs';

const payer = '0x' + 'a'.repeat(40);
const recipient = '0x' + 'b'.repeat(40);
const hash = '0x' + 'f'.repeat(64);
const blockHash = '0x' + '1'.repeat(64);
const topic = value => '0x' + '0'.repeat(24) + value.slice(2);
const word = bigint => '0x' + bigint.toString(16).padStart(64, '0');
const log = { address: QUSDC, topics: [TRANSFER_TOPIC, topic(payer), topic(recipient)], data: word(2100000n), logIndex: '0x3' };
const receipt = { blockHash, blockNumber: '0x2a', status: '0x1', transactionHash: hash, logs: [log] };
const transfer = { blockHash, hash, from: payer, to: recipient, value: '0x1', input: '0x' };
const defaults = { eth_chainId: '0x7c6', eth_blockNumber: '0x2a', eth_getTransactionReceipt: receipt,
  eth_getTransactionByHash: transfer, eth_getBlockByNumber: { hash: blockHash, timestamp: '0x6a4d4580' } };
const rpc = changes => async method => ({ ...defaults, ...changes })[method];
const input = { tx: hash, recipient };

test('separates native and QUSDC transfers with canonical evidence IDs', async () => {
  assert.deepEqual(await qieNetwork(rpc()), { chainId: 1990, block: '42' });
  const [native, token] = await qieReceipt(rpc(), input);
  assert.equal(native.amount, '0.000000000000000001');
  assert.equal(token.amount, '2.1');
  assert.equal(token.payer, payer);
  assert.equal(token.id, `1990:${hash}:3`);
  assert.equal(token.evidence.block, '42');
});

test('rejects incorrect chain, failed receipt and mismatched canonical block', async () => {
  await assert.rejects(qieReceipt(rpc({ eth_chainId: '0x7bf' }), input), /wrong chain/);
  await assert.rejects(qieReceipt(rpc({ eth_getTransactionReceipt: { ...receipt, status: '0x0' } }), input), /transaction failed/);
  await assert.rejects(qieReceipt(rpc({ eth_getBlockByNumber: { hash } }), input), /canonical block/);
});

test('excludes transfers to different recipients, nonofficial tokens and mint events', async () => {
  const logs = [{ ...log, address: payer }, { ...log, topics: [TRANSFER_TOPIC, topic(payer), topic(payer)] },
    { ...log, topics: [TRANSFER_TOPIC, topic('0x' + '0'.repeat(40)), topic(recipient)] }];
  await assert.rejects(qieReceipt(rpc({ eth_getTransactionByHash: { ...transfer, to: payer },
    eth_getTransactionReceipt: { ...receipt, logs } }), input), /No supported incoming/);
});
