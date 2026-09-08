import { createHash } from 'node:crypto';
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ZERO = '0'.repeat(64);
function integer(x) {
  if (!Number.isSafeInteger(x) || x <= 0) throw new TypeError('amount/limit must be a positive safe integer');
  return x;
}
function id(x) {
  if (typeof x !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x.trim())) throw new TypeError('invalid ASCII identifier');
  return x.trim().toUpperCase();
}
function day(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x) || !Number.isFinite(Date.parse(x)) || new Date(x).toISOString().slice(0,10) !== x) throw new TypeError('invalid ISO day');
  return x;
}
function currency(x) {
  if (typeof x !== 'string' || !/^[A-Z]{3}$/.test(x)) throw new TypeError('invalid currency');
  return x;
}
function invoice(x) {
  const keys = ['supplierId','invoiceId','currency','amountMinor'];
  if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).length !== 4 || keys.some(k => !Object.hasOwn(x,k))) throw new TypeError('exactly four invoice fields required');
  return { supplierId:id(x.supplierId), invoiceId:id(x.invoiceId), currency:currency(x.currency), amountMinor:integer(x.amountMinor) };
}
/** Single-owner review session. Recommendations only; never executes payments. */
export class ReviewAgent {
  #policy; #policyHash; #seen = new Map(); #totals = new Map(); #audit = [];
  constructor(p) {
    if (!p || !Array.isArray(p.suppliers) || !p.suppliers.length) throw new TypeError('suppliers required');
    this.#policy = Object.freeze({currency:currency(p.currency), invoiceLimitMinor:integer(p.invoiceLimitMinor), supplierDayLimitMinor:integer(p.supplierDayLimitMinor), suppliers:Object.freeze([...new Set(p.suppliers.map(id))].sort())});
    this.#policyHash = digest(this.#policy);
  }
  get policyHash() { return this.#policyHash; }
  get audit() { return this.#audit.slice(); }
  review(input, reviewDay) {
    const item = invoice(input), date = day(reviewDay), invoiceHash = digest(item);
    const key = JSON.stringify([item.supplierId,item.invoiceId]);
    const budgetKey = JSON.stringify([item.supplierId,date]);
    const prior = this.#seen.get(key), used = this.#totals.get(budgetKey) ?? 0;
    let status, reason;
    if (prior) { status = prior === invoiceHash ? 'duplicate' : 'conflict'; reason = prior === invoiceHash ? 'already_reviewed' : 'invoice_identity_reused'; }
    else if (!this.#policy.suppliers.includes(item.supplierId)) { status = 'reject'; reason = 'unknown_supplier'; }
    else if (item.currency !== this.#policy.currency) { status = 'reject'; reason = 'unsupported_currency'; }
    else if (item.amountMinor > this.#policy.invoiceLimitMinor) { status = 'manual_review'; reason = 'invoice_limit'; }
    else if (item.amountMinor > this.#policy.supplierDayLimitMinor - used) { status = 'manual_review'; reason = 'supplier_day_limit'; }
    else { status = 'eligible'; reason = 'within_policy'; }
    // All validation precedes mutation. Atomic only within this synchronous process.
    if (!prior) this.#seen.set(key,invoiceHash);
    if (status === 'eligible') this.#totals.set(budgetKey,used + item.amountMinor);
    const body = {schema:1, sequence:this.#audit.length+1, reviewDay:date, policyHash:this.#policyHash, invoiceHash, status, reason, previousHash:this.#audit.at(-1)?.hash ?? ZERO};
    const entry = Object.freeze({...body,hash:digest(body)});
    this.#audit.push(entry);
    return entry;
  }
}
/** A trusted final hash is required to detect truncation. Not a signature or TEE proof. */
export function verifyAudit(entries, expectedHead) {
  if (!Array.isArray(entries) || typeof expectedHead !== 'string') return false;
  let previous = ZERO;
  for (const [index,entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') return false;
    const {hash,...body} = entry;
    if (body.sequence !== index+1 || body.previousHash !== previous || digest(body) !== hash) return false;
    previous = hash;
  }
  return previous === expectedHead;
}
