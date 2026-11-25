import { readFile } from 'node:fs/promises';
import { address, amount } from '../public/ledger.mjs';
import { qieNetwork, rpcClient } from '../qie.mjs';

try {
  const artifact = JSON.parse(await readFile(new URL('../out/ReceiptAnchor.sol/ReceiptAnchor.json', import.meta.url), 'utf8'));
  const data = artifact.bytecode.object;
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(data)) throw new Error('ReceiptAnchor artifact does not contain valid creation bytecode.');
  const from = process.argv[2] ? address(process.argv[2]) : undefined;
  const call = { data, value: '0x0', ...(from ? { from } : {}) };
  const rpc = rpcClient();
  const { chainId, block } = await qieNetwork(rpc);
  const blockTag = '0x' + BigInt(block).toString(16);
  const [gas, gasPrice, priority, snapshot] = await Promise.all([
    rpc('eth_estimateGas', [call]), rpc('eth_gasPrice'), rpc('eth_maxPriorityFeePerGas'), rpc('eth_getBlockByNumber', [blockTag, false]),
  ]);
  console.log(JSON.stringify({ chainId, block, blockTime: new Date(Number(BigInt(snapshot.timestamp)) * 1000).toISOString(),
    gas: BigInt(gas).toString(), gasPriceWei: BigInt(gasPrice).toString(),
    baseFeeWei: BigInt(snapshot.baseFeePerGas).toString(), priorityFeeWei: BigInt(priority).toString(),
    estimatedQie: amount(BigInt(gas) * BigInt(gasPrice), 'QIE', 0),
  }, null, 2));
} catch (error) {
  console.error('QIE read-only estimate failed. Run forge build and check the QIE RPC. ' + error.message);
  process.exitCode = 1;
}
