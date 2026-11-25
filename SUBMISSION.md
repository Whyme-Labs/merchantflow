# MerchantFlow QIE Hackathon 3.0 entry packet

## Official requirements

**Deadline.** Submissions close on **1 December 2026 at 06:59 MYT** (30 November, 23:59 CET). QIE’s expanded FAQ requires a mainnet deployment, open-source contracts, a public source repository, a working public app, a demo video, documentation and a team presentation. The quickstart identifies the GitHub URL, live app URL, deployment address and track as authenticated submission fields. The public registration form starts with email verification. The detailed submission form is behind sign-in, so the copy below follows the organizer’s public field descriptions. [Organizer FAQ and quickstart](https://hackathon.qie.digital/#faq) · [Email verification](https://hackathon.qie.digital/register)

**Launch and traction.** A working online launch and actual QIE mainnet integration are required. The organizer checks the deployed contract, on-chain transactions and frontend connectivity. QIE emphasizes launch to real users. The mandatory checklist gives no numeric user or volume floor. Business potential and adoption are judging factors. Winners receive the second 50% after reaching any three traction milestones within 90 days. The FAQ lists five judging weights and the portal terms list four different weights. The staged application should therefore demonstrate the working flow, mainnet evidence, and a credible user plan. [Organizer FAQ, timeline and payouts](https://hackathon.qie.digital/#faq) · [Official terms](https://hackathon.qie.digital/terms)

**Participant and team.** Terms require age 18+, a valid QIE wallet address, compliance with local rules, and one submission per team. QIE employees and affiliates are excluded. The event accepts AI-assisted development and expects teams to understand, maintain and explain their code. Its anti-abuse rules disqualify minimal developer contribution. The current MVP was agent-authored. A contributor should document genuine engineering work and be able to explain the source before the entry is represented as eligible. The site lists live demos and judging from 1–5 December. Registration and submission are online. The public rules give no venue or explicit remote presentation procedure, so remote Demo Week participation remains unconfirmed. [Official terms](https://hackathon.qie.digital/terms) · [Event timeline and anti-abuse rules](https://hackathon.qie.digital/)

## Form copy

| Published field or referenced deliverable | Proposed content |
| --- | --- |
| Project name | MerchantFlow |
| Track | Commerce & Real World |
| GitHub repository | `https://github.com/Whyme-Labs/merchantflow`. Currently private. Publish only after owner approval |
| Live demo URL | Public HTTPS root of the tested Node container deployment. No URL assigned |
| Deployed contract | `ReceiptAnchor` on QIE EVM chain `1990`. Use its actual address after deployment and RPC runtime verification |
| Demo video | Final video showing the public app, real receipt lookup and mainnet anchor verification. A rehearsal is available locally. The final video URL is pending |
| Documentation | `README.md` and `DEPLOYMENT.md` in the verified source revision |
| Team presentation | Use the short walkthrough below and name only actual contributors |

**Project description**

MerchantFlow helps merchants reconcile spreadsheet invoices against confirmed QIE and QUSDC payments. It compares exact token amounts, supports split and bundled settlements, and surfaces competing matches for human review. Approving a match reserves its source records so one payment cannot be allocated twice in the same ledger.

Merchants can export a salted evidence commitment and independently verify an anchor under the publisher’s address. Invoice data and the full evidence file stay in the browser. The live receipt walkthrough uses a historic public QUSDC transaction and an illustrative invoice. It demonstrates chain integration without implying merchant adoption or transaction volume from this project.

**Business potential**

Start with small merchants that already keep a spreadsheet or ERP export and receive QIE-based transfers. Validate how often transfers cover several invoices, how long manual matching takes, and whether reviewers resolve exceptions faster. Measure the number of completed reconciliations and returning consenting pilot merchants after a genuine launch. This entry currently has no confirmed merchant or usage figures.

**Team presentation**

1. Show one bundled and one split allocation. The displayed records add up at native token precision.
2. Show how two invoices can compete for one payment. Approve one and confirm the competing proposal becomes unavailable.
3. Open the QUSDC explorer receipt and verify the exact recipient and amount against a sample invoice. Identify the invoice as illustrative.
4. Export an approved evidence record and verify its published commitment in the app. Show the actual deployed contract, publisher, block and anchor transaction. Explain that the recorded digest is evidence of publication by that wallet, with no inference about who legally owns the wallet or whether the invoice was commercially valid.

## Entry gates still open

The prepared deployment image and local EVM have passed a TLS browser rehearsal. To submit, the owner needs to approve public source and public hosting, confirm the eligible participant wallet, authorize the hardware or browser wallet signatures for actual mainnet deployment and an example anchor, provide truthful contribution and adoption records, and approve the final video and presentation. The operational plan and measured gas are in [DEPLOYMENT.md](DEPLOYMENT.md).
