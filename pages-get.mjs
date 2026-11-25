import { qieAnchorStatus, qieNetwork, qieReceipt, rpcClient, SAMPLE } from './qie.mjs';

export function createPagesGet(anchor, rpc = rpcClient()) {
  return async function get(path) {
    const { pathname, searchParams } = new URL(path, 'https://merchantflow.invalid');
    const value = (key) => searchParams.get(key) || '';
    switch (pathname) {
      case '/api/config':
        return { mainnet: true, anchor };
      case '/api/network':
        return qieNetwork(rpc);
      case '/api/sample-receipt':
        return qieReceipt(rpc, { tx: SAMPLE.hash, recipient: SAMPLE.recipient });
      case '/api/receipt':
        return qieReceipt(rpc, { tx: value('tx'), recipient: value('recipient') });
      case '/api/anchor':
        if (!anchor) throw new Error('An anchor contract is not configured.');
        return qieAnchorStatus(rpc, anchor, { publisher: value('publisher'), commitment: value('commitment') });
      default:
        throw new Error('Unknown MerchantFlow request.');
    }
  };
}
