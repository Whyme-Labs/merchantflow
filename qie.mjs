import { address, amount } from './public/ledger.mjs';

export const CHAIN_ID = 1990;
export const MAINNET_RPC = 'https://rpc1mainnet.qie.digital';
export const QUSDC = '0x3f43da82ec9a4f5285f10faf1f26eca7319e5da5';
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const SAMPLE = {
  hash: '0xa3a700ce3f99a455ad95146041cb338095cbfe8a26264dffa082401f554239af',
  recipient: '0x1f41ebf1e60e5daa9cdda69637a78a9381b23388',
};
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_TOPIC = /^0x0{24}[0-9a-f]{40}$/i;

export class InputError extends Error {}

export function rpcClient(url = MAINNET_RPC) {
  return async (method, params = []) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('RPC response was unsuccessful.');
    const data = await response.json();
    if (data.error || !Object.hasOwn(data, 'result')) throw new Error('RPC did not return a result.');
    return data.result;
  };
}

export async function qieNetwork(rpc) {
  const [chainId, block] = await Promise.all([rpc('eth_chainId'), rpc('eth_blockNumber')]);
  if (Number(chainId) !== CHAIN_ID) throw new Error('RPC returned the wrong chain.');
  return { chainId: CHAIN_ID, block: BigInt(block).toString() };
}

export async function qieReceipt(rpc, request) {
  if (!HASH.test(request.tx)) throw new InputError('Enter a transaction hash (0x followed by 64 hex characters).');
  const hash = request.tx.toLowerCase();
  let recipient;
  try { recipient = address(request.recipient); }
  catch (error) { throw new InputError(error.message); }
  if (Number(await rpc('eth_chainId')) !== CHAIN_ID) throw new Error('RPC returned the wrong chain.');
  const receipt = await rpc('eth_getTransactionReceipt', [hash]);
  if (!receipt) throw new InputError('No confirmed QIE mainnet receipt was found.');
  if (receipt.status !== '0x1') throw new InputError('The QIE mainnet transaction failed.');
  const [transaction, block] = await Promise.all([
    rpc('eth_getTransactionByHash', [hash]), rpc('eth_getBlockByNumber', [receipt.blockNumber, false]),
  ]);
  if (!transaction || receipt.transactionHash?.toLowerCase() !== hash || transaction.hash?.toLowerCase() !== hash ||
      !block || receipt.blockHash !== block.hash || transaction.blockHash !== block.hash) {
    throw new Error('The transaction and receipt do not identify the same canonical block.');
  }
  const date = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString().slice(0, 10);
  const payment = (payer, asset, value, position) => ({
    id: CHAIN_ID + ':' + hash + ':' + position, payer: address(payer), recipient, asset,
    amount: amount(value, asset, 0), date,
    evidence: { kind: 'qie-mainnet', chainId: CHAIN_ID, tx: hash, position, block: BigInt(receipt.blockNumber).toString() },
  });
  const results = [];
  if (transaction.to?.toLowerCase() === recipient && transaction.input === '0x' && BigInt(transaction.value) > 0n) {
    results.push(payment(transaction.from, 'QIE', BigInt(transaction.value), 'native'));
  }
  for (const log of receipt.logs) {
    if (log.removed || log.address?.toLowerCase() !== QUSDC || log.topics?.length !== 3 ||
        log.topics[0].toLowerCase() !== TRANSFER_TOPIC || !ADDRESS_TOPIC.test(log.topics[1]) ||
        !ADDRESS_TOPIC.test(log.topics[2]) || '0x' + log.topics[2].slice(-40).toLowerCase() !== recipient ||
        !HASH.test(log.data) || BigInt(log.data) <= 0n) continue;
    const payer = '0x' + log.topics[1].slice(-40);
    if (BigInt(payer) === 0n) continue;
    results.push(payment(payer, 'QUSDC', BigInt(log.data), BigInt(log.logIndex).toString()));
  }
  if (!results.length) throw new InputError('No supported incoming QIE or QUSDC transfer was found for this address.');
  return results;
}
