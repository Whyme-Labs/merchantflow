# MerchantFlow deployment

MerchantFlow serves the browser app and JSON API from one Node process. Deploy the Docker image at the root of a dedicated HTTPS origin. HTTPS gives the browser’s SHA-256 API a secure context. Keep `/api/*` and static resources on that origin so a site visitor can verify receipts without credentials or cross-origin access.

```sh
docker build -t merchantflow:release .
docker run --rm -p 127.0.0.1:4310:8080 merchantflow:release
```

For a hosted deployment set `QIE_ANCHOR_ADDRESS` to the verified on-chain address. The default RPC is `https://rpc1mainnet.qie.digital`. `QIE_RPC_URL` accepts the other official QIE mainnet RPCs or a loopback simulator, labeled in the UI. The app refuses anchor reads if the deployed runtime differs from this release’s SHA-256. It reads code and the anchor at the same observed block. Only the public publisher address and salted commitment reach the anchor endpoint. Uploaded invoices, evidence and approvals remain in the browser tab. Ledger state ends when the tab closes. Use the JSON export before closing.

| Path | Expected live response |
| --- | --- |
| `/` | Public MerchantFlow app with an operational receipt lookup |
| `/healthz` | `200` and `{"ok":true}` for the process probe |
| `/api/config` | `mainnet: true` and the verified configured contract address |
| `/api/network` | Chain `1990` and latest observed block |
| `/api/sample-receipt` | Historic 2.1 QUSDC example with block `8809898`, log `1` |
| `/api/anchor` | Anchor block for a supplied publisher and digest, or `null` when absent |

## QIE contract release

**Network.** QIE Mainnet is chain `1990` (`0x7c6`). The native gas denomination is QIE with 18 decimals. The default RPC and explorer are the official public endpoints. Testnet is `1983` and does not meet the hackathon deployment rule. [QIE developer settings](https://www.qie.digital/developers) · [QIE mainnet explorer](https://mainnet.qie.digital/)

**Build.** `contracts/ReceiptAnchor.sol:ReceiptAnchor` is the original MIT-licensed contract. It has no constructor arguments, owner, proxy, or privileged admin. Every publisher can post their own digest. The contract’s expected runtime SHA-256 from Foundry with Solc `0.8.30`, Berlin EVM and optimizer disabled is `fb1089d4e9c7ef711675585895b695cfbb2d546315262f9179ad6a3b8613ae25`.

**Custody.** The competition account needs valid wallet information owned or controlled by the entrant. The public terms do not say that the application wallet, deployment signer, and demo publisher must be the same. Record the actual authorizations. The deployment and first anchor need a self-custody EVM signer with native QIE. Read-only receipt checks, evidence export, and anchor verification use no wallet or gas. A hardware or browser wallet should keep the signing key with the user.

**Measured fees.** The QIE RPC read at block `12157341`, 25 November 2026 at 15:37 MYT, reported 1 gwei base fee, 0.125 gwei priority fee and a 1.125 gwei gas-price quote. The network estimated contract creation at **243,892 gas** with empty value, roughly **0.0002743785 QIE**. Local Anvil used **243,950 gas** for creation and **46,206 gas** for the first evidence anchor. At the same gas quote, the local first anchor corresponds to **0.00005198175 QIE**. The combined network-estimate-plus-local-anchor planning figure is **0.00032636025 QIE**. As an illustrative upper fee budget, 20% gas headroom from the larger deployment measurement and the local anchor measurement, with a 2.125 gwei fee cap, totals **0.0007398995 QIE**. Fee quotes and signer balances need a fresh check at execution. These figures cover gas only.

```sh
forge build
node scripts/quote-qie-deploy.mjs
```

The quote uses `eth_estimateGas` and fee reads. It sends no transaction. An optional public signer address as the first script argument quotes its actual sender context.

## Owner-authorized production sequence

1. Build the verified revision and review the contract source. Before signing, independently check chain `1990`, signer balance, creation hex, transaction value zero, current nonce and fee limits. `forge inspect ReceiptAnchor bytecode` gives the exact initialization bytes. `cast compute-address` gives the expected address for the approved sender and nonce. A wallet confirms the creation transaction, and the normal CREATE address depends on the signer and nonce.
2. Deploy from an approved wallet. For a supported hardware signer, the Foundry form is `forge create contracts/ReceiptAnchor.sol:ReceiptAnchor --rpc-url https://rpc1mainnet.qie.digital --ledger --sender "$QIE_DEPLOYER" --broadcast`. `QIE_DEPLOYER` is the actual approved address. The command signs and broadcasts. It requires separate owner authorization. Capture successful receipt, deployed address, transaction hash and block. Check the RPC runtime against the pinned SHA-256.
3. Publish approved source and deployment artifacts to GitHub. Publish contract source verification through the QIE explorer using the same Solidity version, EVM target and optimizer settings. Keep the addresses and source revision in the README or public release notes.
4. Deploy the image behind HTTPS with the verified `QIE_ANCHOR_ADDRESS`. Use a read-only browser session to check the routes above, the invoice import, the mainnet QUSDC sample, and the runtime-pinned `/api/anchor` query. Test a different publisher and modified evidence as negative controls.
5. With the owner’s separate approval, publish a single example digest under the intended demo publisher’s wallet. Use a synthetic invoice and verify that only the digest is signed. The expected method is `anchor(bytes32)` and the transaction value is zero. Record its mainnet transaction and demonstrate the browser check with the matching JSON export. This is a demonstration transaction, with no traction attributed to it.
6. Replace the rehearsal’s local deployment footage with the public app and anchor check, record the actual contract address, and upload the approved video. Complete the contribution review, organizer presentation arrangements and submission using [SUBMISSION.md](SUBMISSION.md).

The local rehearsal used a fixed test-wallet sender and nonce on a disposable Anvil chain. Repeating creation from the same state produced `0x5fbdb2315678afecb367f032d93f642f64180aa3` and the expected runtime. That address is specific to the local test and must never be entered in the organizer form.
