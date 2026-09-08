# Invoice Review Agent

A deterministic accounts-payable review core that catches duplicate invoices, conflicting re-submissions and invoices split across a supplier's daily review allowance. It returns a reasoned recommendation and a chained audit digest. It never sends a payment.

**Status: work in progress for the Terminal 3 agent bounty.** The policy core and regression suite are implemented. T3N authentication, protected contract execution, durable state and agent delegation are not implemented or verified. This repository is not a completed bounty entry.

## Run the core

Node.js 20+; no npm dependencies. Tests run on GitHub-hosted Ubuntu through Actions.

~~~sh
node --test review.test.mjs
~~~

~~~js
import { ReviewAgent, verifyAudit } from './review.mjs';
const agent = new ReviewAgent({
  currency: 'USD', suppliers: ['ACME'],
  invoiceLimitMinor: 10000, supplierDayLimitMinor: 15000
});
const invoice = {supplierId:'ACME', invoiceId:'INV-1', currency:'USD', amountMinor:10000};
const first = agent.review(invoice, '2026-09-09'); // eligible: within_policy
const replay = agent.review(invoice, '2026-09-09'); // duplicate: already_reviewed
const second = agent.review({...invoice, invoiceId:'INV-2', amountMinor:6000}, '2026-09-09');
// manual_review: supplier_day_limit
console.log(agent.audit);
console.log(verifyAudit(agent.audit, second.hash)); // true
~~~

Amounts and limits use integer minor units; for USD, 10000 means $100. Currency matching is exact and no exchange-rate conversion is attempted. Vendor and invoice identifiers are ASCII, case-insensitive and trimmed. Only the four documented input fields are accepted; arbitrary invoice text or instructions cannot change policy.

## Decision contract

| Status | Meaning | Consumes review allowance? |
| --- | --- | --- |
| eligible | Known supplier, supported currency, within both limits | Yes |
| manual_review | Invoice or supplier-day threshold exceeded | No |
| reject | Unknown supplier or unsupported currency | No |
| duplicate | The same normalized supplier/invoice and payload was already reviewed | No |
| conflict | A known invoice identity was reused with different amount/currency | No |

Every syntactically valid first invoice reserves its identity, including rejected/manual cases. Correcting that invoice requires an explicit future revision/override workflow; it cannot silently replace the first review. Duplicate detection spans the entire session, even across dates. Limits apply to eligible review recommendations, not actual accounting balances.

## Evidence and limitations

The regression suite covers threshold boundaries, splitting, replay, changed amounts, supplier isolation, date rollover, float/NaN/overflow rejection, invalid calendar dates, unknown fields, policy mutation and audit tampering. See [Actions](../../actions) for actual execution status; source presence alone is not proof of a passing run.

The session is in-memory and single-process. Restarting loses identities and allowance state. Do not run multiple independent instances against the same supplier ledger. A production host must obtain the review date from a trusted clock, own the policy configuration, authorize callers and transactionally persist identity reservations, allowance usage and audit rows. Invoice suppliers must be reconciled to the trusted vendor master before review. These requirements are not supplied by this library.

Audit rows contain invoice/policy digests, status and reason rather than raw supplier/invoice IDs. Digests are not encryption and may permit guessing predictable inputs. The chain detects changes/reordering; detecting truncation requires the caller's independently retained final hash. An attacker who can rewrite both the entire log and its trusted head defeats this check. It is not a signature, TEE attestation or proof that a payment occurred.

## T3N integration and handover

Intended integration: authenticate an operator with the official T3N SDK, register a delegated agent, move review state into a protected contract, and write the decision digest through that contract. Contract authorization must enforce the operator/agent scope and retain replay and allowance state atomically. Complete Quickstart and Walkthrough before claiming this path works.

On 8 September 2026, the official signup redirected to https://terminal3.io/products/agent-developer-kit. In the Codex in-app browser, Google sign-in stayed disabled at “Signing in…” without an account chooser or visible error, including after reload and completion of required form fields. No DID or key was obtained. A reproducible access report was posted to the sponsor's [bounty discussion](https://superteam.fun/earn/listing/t3n-agent-build-challenge). The sponsor's latest public guidance to another participant says to use SDK 5.2; verify the exact compatible package release before integration.

Preferred handover: Terminal 3 hosts and maintains a completed integration. The recipient should create and own all sandbox/production credentials, rotate them on handover, run the regression suite plus real contract acceptance tests, and document deployment/rollback. No credentials, customer invoices or financial accounts are included here.

Built with OpenAI Codex under the repository owner's authorization. All sample inputs are synthetic. MIT license.
