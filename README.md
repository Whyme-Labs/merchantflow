# MerchantFlow

Reconcile spreadsheet invoices against confirmed QIE transfers. The merchant imports existing invoices, verifies payment receipts, and approves exact matches after seeing which records would be allocated. MerchantFlow can explain a bundled payment, a split payment, or competing exact matches for the same payment.

## Run the demo

Requires Node.js 22 or later. Use `npm start` and open [the local app](http://127.0.0.1:4310). The Chrome demo needs no dependencies, wallet, funds, API key, or sign-in. The app works offline for the sample queue. It reads the QIE node for live receipts.

1. Open **Horizon Supply** to inspect a single 450 QUSDC sample payment covering two invoices. Open **Juniper Works** to inspect how two exact six-decimal amounts reconcile a 300 QUSDC invoice.
2. Open either **Nord Paper** match. Both invoices total 125 QUSDC and compete for the same payment. Approve one with the evidence panel. The competing option disappears and the remaining invoice moves to the exceptions list. Undo to restore both options.
3. Export an approved match as JSON to get the reconciliation evidence and its salted SHA-256 commitment. A repeat export of the same approval keeps the commitment.
4. Import [`fixtures/public-receipt-invoice.csv`](fixtures/public-receipt-invoice.csv) to create a clean ledger with a fictional invoice. Open **Verify QIE receipt → Inspect a public example → Add to ledger**. The 2.1 QUSDC receipt comes from [block 8,809,898, log 1](https://mainnet.qie.digital/tx/0xa3a700ce3f99a455ad95146041cb338095cbfe8a26264dffa082401f554239af). Review and approve the proposed pairing. The transaction is historical and public. The matching invoice is illustrative and has no affiliation with the wallet owners.

For a merchant ledger, use the CSV template in the app. A row needs a unique invoice ID, customer name, source wallet, recipient wallet, asset, decimal amount and UTC issue date. Export Google Sheets or Excel as comma-delimited UTF-8 CSV. The importer accepts `QIE` and `QUSDC` at their native precision.

## Matching and evidence

- The app reads receipts and their canonical blocks from QIE Mainnet, chain `1990`. It accepts successful native direct transfers and `Transfer` log entries from the official six-decimal QUSDC token contract. Each payment is keyed by chain, transaction hash and transfer position. Duplicate imports are idempotent, and a conflicting record ID stops the import. [QIE network documentation](https://www.qie.digital/developers) · [QUSDC contract reference](https://www.qie.digital/qusdc)
- Matching uses integer token units and requires the same payer, recipient, asset and an eligible issue date. A candidate can pair one invoice with up to three receipts, or one receipt with up to three invoices. Overlapping candidates are grouped and left for reviewer judgment. Approval allocates both sides in full, and later approvals cannot reuse those records. Underpayments and overpayments remain exceptions unless an exact split or bundle accounts for them.
- A ledger supports 500 invoices and 500 payments. An account with more than 24 records on either side, or more than 100 candidates, is held out of the proposals. Matching runs in the browser. Invoice files, approval records and customer names stay in the active tab. Download the approved evidence before closing it.
- The included `ReceiptAnchor` contract lets a merchant timestamp a salted commitment under its publisher address. An anchor proves which publisher posted the digest by the recorded block. The approval and its underlying documents remain private. Contract deployment and publisher transactions would occur outside the current demo.

Run `npm test` for the ledger and receipt checks. Run `forge test` with Foundry for the original Solidity contract. To recompute the evidence commitment without publishing it, use the exported JSON file with `node scripts/verify-evidence.mjs <file>`.

## QIE Hackathon 3.0

Proposed track is **Commerce & Real World**. The project is a local MVP with genuine read-only QIE mainnet integration and a locally tested contract. The public example is demonstration data. The contract has yet to be deployed to mainnet and there are no merchant adoption figures from this build.

The organizer lists **30 November 2026, 23:59 CET** as the submission deadline, which is **1 December 2026, 06:59 MYT**. The submission calls for a GitHub repository, a live demo URL and a deployed contract address. The event terms also require a valid QIE wallet. The public launch, deployment, judge-accessible source and genuine merchant evidence are outstanding. The organizer disqualifies AI-generated projects with minimal developer contribution, so eligibility needs to account for the agent-authored MVP and whatever developer work is actually completed before submission. [Event requirements](https://hackathon.qie.digital/) · [Participation terms](https://hackathon.qie.digital/terms)
