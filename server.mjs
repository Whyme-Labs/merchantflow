import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { address } from './public/ledger.mjs';
import { InputError, MAINNET_RPC, qieAnchorStatus, qieNetwork, qieReceipt, rpcClient, SAMPLE } from './public/qie.mjs';

const rpcUrl = new URL(process.env.QIE_RPC_URL || MAINNET_RPC);
const mainnet = /^https:\/\/rpc[1-5]mainnet\.qie\.digital\/?$/.test(rpcUrl.href);
if (!mainnet && !['127.0.0.1', 'localhost', 'host.docker.internal'].includes(rpcUrl.hostname)) {
  throw new Error('Configure an official QIE mainnet RPC or a local simulation RPC.');
}
const rpc = rpcClient(rpcUrl.href);
const anchor = process.env.QIE_ANCHOR_ADDRESS ? address(process.env.QIE_ANCHOR_ADDRESS) : null;
const routes = new Map(Object.entries({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.mjs': ['app.mjs', 'text/javascript; charset=utf-8'],
  '/get.mjs': ['get.mjs', 'text/javascript; charset=utf-8'],
  '/evidence.mjs': ['evidence.mjs', 'text/javascript; charset=utf-8'],
  '/ledger.mjs': ['ledger.mjs', 'text/javascript; charset=utf-8'],
  '/sample.mjs': ['sample.mjs', 'text/javascript; charset=utf-8'],
}));

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return json(response, 405, { error: 'Only GET is supported.' });
  let url;
  try { url = new URL(request.url, 'http://localhost'); }
  catch { return json(response, 400, { error: 'Invalid request path.' }); }
  if (url.pathname === '/favicon.ico') { response.writeHead(204); return response.end(); }
  try {
    if (url.pathname === '/healthz') return json(response, 200, { ok: true });
    if (url.pathname === '/api/config') return json(response, 200, { mainnet, anchor });
    if (url.pathname === '/api/anchor') {
      if (!anchor) return json(response, 404, { error: 'An anchor contract is not configured.' });
      const input = { publisher: url.searchParams.get('publisher') || '', commitment: url.searchParams.get('commitment') || '' };
      return json(response, 200, await qieAnchorStatus(rpc, anchor, input));
    }
    if (url.pathname === '/api/network') return json(response, 200, await qieNetwork(rpc));
    if (url.pathname === '/api/receipt' || url.pathname === '/api/sample-receipt') {
      if (!mainnet && url.pathname === '/api/sample-receipt') return json(response, 404, { error: 'Sample transaction is on QIE mainnet.' });
      const input = url.pathname === '/api/sample-receipt' ? { tx: SAMPLE.hash, recipient: SAMPLE.recipient }
        : { tx: url.searchParams.get('tx') || '', recipient: url.searchParams.get('recipient') || '' };
      return json(response, 200, await qieReceipt(rpc, input, mainnet));
    }
    const route = routes.get(url.pathname);
    if (!route) return json(response, 404, { error: 'Page not found.' });
    const content = await readFile(new URL('./public/' + route[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': route[1] });
    response.end(content);
  } catch (error) {
    if (error instanceof InputError) return json(response, 422, { error: error.message });
    if (url.pathname.startsWith('/api/')) return json(response, 502, { error: 'The QIE node could not verify this request. Try again shortly.' });
    return json(response, 500, { error: 'Page could not be loaded.' });
  }
});

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4310);
server.listen(port, host, () => console.log('MerchantFlow listening at http://' + host + ':' + port));
