'use strict';

const crypto = require('crypto');

const CHECK_NAMES = Object.freeze([
  'identity',
  'age',
  'jurisdiction',
  'sanctions',
  'terms',
  'selfExclusion',
  'limits',
  'manualApproval',
]);

const AUTOMATED_CHECK_NAMES = Object.freeze(
  CHECK_NAMES.filter((name) => name !== 'manualApproval'),
);

const CHECK_STATUSES = new Set(['pending', 'pass', 'fail']);
const PAYOUT_STATES = new Set([
  'blocked',
  'approved',
  'processing',
  'paid',
  'rejected',
  'cancelled',
]);

function timingSafeEqualString(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function maskDestination(destination) {
  const value = String(destination || '');
  if (value.length <= 12) return '***';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function nowIso(clock = Date) {
  return new clock().toISOString();
}

function makeCheck(name) {
  return {
    name,
    status: 'pending',
    provider: null,
    evidenceRef: null,
    reasonCode: null,
    checkedAt: null,
    expiresAt: null,
    metadata: {},
  };
}

function isExpired(check, now = Date.now()) {
  if (!check.expiresAt) return false;
  const expiresAt = Date.parse(check.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

function checkPasses(check, now = Date.now()) {
  return check.status === 'pass' && !isExpired(check, now);
}

function blockingReasons(payout, now = Date.now()) {
  return CHECK_NAMES.flatMap((name) => {
    const check = payout.checks[name];
    if (check.status === 'fail') {
      return [{ check: name, reason: check.reasonCode || 'failed' }];
    }
    if (check.status !== 'pass') {
      return [{ check: name, reason: 'pending' }];
    }
    if (isExpired(check, now)) {
      return [{ check: name, reason: 'expired' }];
    }
    return [];
  });
}

function automatedChecksPass(payout, now = Date.now()) {
  return AUTOMATED_CHECK_NAMES.every((name) => checkPasses(payout.checks[name], now));
}

function allChecksPass(payout, now = Date.now()) {
  return CHECK_NAMES.every((name) => checkPasses(payout.checks[name], now));
}

function sanitizeCheck(check, includeEvidence) {
  const result = {
    name: check.name,
    status: check.status,
    reasonCode: check.reasonCode,
    checkedAt: check.checkedAt,
    expiresAt: check.expiresAt,
  };
  if (includeEvidence) {
    result.provider = check.provider;
    result.evidenceRef = check.evidenceRef;
    result.metadata = check.metadata;
  }
  return result;
}

function sanitizePayout(payout, { includeAudit = false, includeEvidence = false } = {}) {
  const result = {
    id: payout.id,
    userId: payout.userId,
    sourceEventId: payout.sourceEventId,
    amountMinor: payout.amountMinor,
    currency: payout.currency,
    asset: payout.asset,
    network: payout.network,
    destination: payout.destinationMasked,
    state: payout.state,
    checks: Object.fromEntries(
      Object.entries(payout.checks).map(([name, check]) => [name, sanitizeCheck(check, includeEvidence)]),
    ),
    blockingReasons: blockingReasons(payout),
    createdAt: payout.createdAt,
    updatedAt: payout.updatedAt,
    approvedAt: payout.approvedAt,
    approvedBy: includeEvidence ? payout.approvedBy : undefined,
    rejectedAt: payout.rejectedAt,
    rejectedBy: includeEvidence ? payout.rejectedBy : undefined,
    rejectionReason: payout.rejectionReason,
    providerReference: payout.providerReference,
  };
  if (includeAudit) result.audit = payout.audit;
  return result;
}

class PayoutStore {
  constructor({
    clock = Date,
    maxPayoutMinor = 100_000,
    allowedAssetNetworks = ['USDC:base', 'USDC:solana'],
  } = {}) {
    this.clock = clock;
    this.maxPayoutMinor = Number.isSafeInteger(maxPayoutMinor) && maxPayoutMinor > 0 ? maxPayoutMinor : 100_000;
    this.allowedAssetNetworks = new Set(allowedAssetNetworks.map((value) => String(value).toLowerCase()));
    this.payouts = new Map();
    this.idempotency = new Map();
  }

  appendAudit(payout, type, actor, details = {}) {
    const event = {
      id: crypto.randomUUID(),
      type,
      actor: actor || 'system',
      at: nowIso(this.clock),
      details,
    };
    payout.audit.push(event);
    payout.updatedAt = event.at;
    return event;
  }

  createPayout(input, actor = 'reward-service') {
    const {
      userId,
      sourceEventId,
      amountMinor,
      asset,
      network,
      destination,
      idempotencyKey,
    } = input || {};

    if (!userId || !sourceEventId || !asset || !network || !destination || !idempotencyKey) {
      throw Object.assign(new Error('userId, sourceEventId, amountMinor, asset, network, destination, and idempotencyKey are required'), { statusCode: 400 });
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw Object.assign(new Error('amountMinor must be a positive integer'), { statusCode: 400 });
    }
    if (amountMinor > this.maxPayoutMinor) {
      throw Object.assign(new Error(`amountMinor exceeds configured maximum of ${this.maxPayoutMinor}`), { statusCode: 400 });
    }

    const assetNetwork = `${String(asset)}:${String(network)}`.toLowerCase();
    if (!this.allowedAssetNetworks.has(assetNetwork)) {
      throw Object.assign(new Error(`Unsupported payout asset/network: ${assetNetwork}`), { statusCode: 400 });
    }
    if (String(network).toLowerCase() === 'base' && !/^0x[a-fA-F0-9]{40}$/.test(String(destination))) {
      throw Object.assign(new Error('Base destination must be a valid 20-byte EVM address'), { statusCode: 400 });
    }
    if (String(network).toLowerCase() === 'solana' && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(destination))) {
      throw Object.assign(new Error('Solana destination must be a valid base58 address'), { statusCode: 400 });
    }

    const dedupeKey = `${userId}:${idempotencyKey}`;
    const existingId = this.idempotency.get(dedupeKey);
    if (existingId) {
      return { payout: this.payouts.get(existingId), claimToken: null, idempotentReplay: true };
    }

    const claimToken = crypto.randomBytes(32).toString('base64url');
    const timestamp = nowIso(this.clock);
    const payout = {
      id: crypto.randomUUID(),
      userId: String(userId),
      sourceEventId: String(sourceEventId),
      amountMinor,
      currency: 'USD',
      asset: String(asset),
      network: String(network),
      destination: String(destination),
      destinationMasked: maskDestination(destination),
      destinationHash: sha256(destination),
      claimTokenHash: sha256(claimToken),
      state: 'blocked',
      checks: Object.fromEntries(CHECK_NAMES.map((name) => [name, makeCheck(name)])),
      createdAt: timestamp,
      updatedAt: timestamp,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      providerReference: null,
      audit: [],
    };

    this.appendAudit(payout, 'payout.created', actor, {
      sourceEventId: payout.sourceEventId,
      amountMinor,
      asset: payout.asset,
      network: payout.network,
      destinationHash: payout.destinationHash,
    });
    this.payouts.set(payout.id, payout);
    this.idempotency.set(dedupeKey, payout.id);
    return { payout, claimToken, idempotentReplay: false };
  }

  get(id) {
    const payout = this.payouts.get(id);
    if (!payout) throw Object.assign(new Error('Payout not found'), { statusCode: 404 });
    return payout;
  }

  list({ state } = {}) {
    if (state && !PAYOUT_STATES.has(state)) {
      throw Object.assign(new Error('Invalid payout state'), { statusCode: 400 });
    }
    return [...this.payouts.values()]
      .filter((payout) => !state || payout.state === state)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  verifyClaimToken(payout, token) {
    return timingSafeEqualString(payout.claimTokenHash, sha256(token || ''));
  }

  setCheck(id, checkName, result, actor = 'compliance-service') {
    if (!AUTOMATED_CHECK_NAMES.includes(checkName)) {
      throw Object.assign(new Error('Only automated checks may be updated by the compliance service'), { statusCode: 400 });
    }
    const payout = this.get(id);
    if (['processing', 'paid', 'cancelled'].includes(payout.state)) {
      throw Object.assign(new Error(`Cannot modify checks for a ${payout.state} payout`), { statusCode: 409 });
    }

    const status = result?.status;
    if (!CHECK_STATUSES.has(status)) {
      throw Object.assign(new Error('status must be pending, pass, or fail'), { statusCode: 400 });
    }
    if (status === 'pass' && !result?.evidenceRef) {
      throw Object.assign(new Error('A passing check requires evidenceRef'), { statusCode: 400 });
    }

    payout.checks[checkName] = {
      name: checkName,
      status,
      provider: result?.provider || null,
      evidenceRef: result?.evidenceRef || null,
      reasonCode: result?.reasonCode || null,
      checkedAt: nowIso(this.clock),
      expiresAt: result?.expiresAt || null,
      metadata: result?.metadata && typeof result.metadata === 'object' ? result.metadata : {},
    };

    if (payout.checks.manualApproval.status === 'pass') {
      payout.checks.manualApproval = makeCheck('manualApproval');
      payout.approvedAt = null;
      payout.approvedBy = null;
    }
    if (!['rejected', 'cancelled', 'paid'].includes(payout.state)) payout.state = 'blocked';

    this.appendAudit(payout, 'check.updated', actor, {
      check: checkName,
      status,
      reasonCode: payout.checks[checkName].reasonCode,
      evidenceRef: payout.checks[checkName].evidenceRef,
      expiresAt: payout.checks[checkName].expiresAt,
    });
    return payout;
  }

  approve(id, reviewer, note = '') {
    const payout = this.get(id);
    if (!reviewer) throw Object.assign(new Error('reviewer is required'), { statusCode: 400 });
    if (payout.state !== 'blocked') {
      throw Object.assign(new Error(`Only blocked payouts can be approved; current state is ${payout.state}`), { statusCode: 409 });
    }
    if (!automatedChecksPass(payout)) {
      throw Object.assign(new Error('All automated checks must pass and remain unexpired before manual approval'), {
        statusCode: 409,
        details: blockingReasons(payout).filter((item) => item.check !== 'manualApproval'),
      });
    }

    const checkedAt = nowIso(this.clock);
    payout.checks.manualApproval = {
      name: 'manualApproval',
      status: 'pass',
      provider: 'human-review',
      evidenceRef: `review:${reviewer}:${checkedAt}`,
      reasonCode: null,
      checkedAt,
      expiresAt: null,
      metadata: { reviewer, note: String(note || '').slice(0, 500) },
    };
    payout.state = 'approved';
    payout.approvedAt = checkedAt;
    payout.approvedBy = reviewer;
    this.appendAudit(payout, 'payout.approved', reviewer, { note: String(note || '').slice(0, 500) });
    return payout;
  }

  reject(id, reviewer, reason) {
    const payout = this.get(id);
    if (!reviewer || !reason) throw Object.assign(new Error('reviewer and reason are required'), { statusCode: 400 });
    if (!['blocked', 'approved'].includes(payout.state)) {
      throw Object.assign(new Error(`Payout in state ${payout.state} cannot be rejected`), { statusCode: 409 });
    }
    const checkedAt = nowIso(this.clock);
    payout.checks.manualApproval = {
      name: 'manualApproval',
      status: 'fail',
      provider: 'human-review',
      evidenceRef: `review:${reviewer}:${checkedAt}`,
      reasonCode: 'manual_rejection',
      checkedAt,
      expiresAt: null,
      metadata: { reviewer, reason: String(reason).slice(0, 500) },
    };
    payout.state = 'rejected';
    payout.rejectedAt = checkedAt;
    payout.rejectedBy = reviewer;
    payout.rejectionReason = String(reason).slice(0, 500);
    this.appendAudit(payout, 'payout.rejected', reviewer, { reason: payout.rejectionReason });
    return payout;
  }

  beginDispatch(id, actor = 'payout-provider') {
    const payout = this.get(id);
    if (!allChecksPass(payout)) {
      payout.state = 'blocked';
      this.appendAudit(payout, 'payout.dispatch_blocked', actor, { reasons: blockingReasons(payout) });
      throw Object.assign(new Error('Payout is blocked because one or more checks are not passing'), {
        statusCode: 409,
        details: blockingReasons(payout),
      });
    }
    if (payout.state !== 'approved') {
      throw Object.assign(new Error(`Payout must be approved before dispatch; current state is ${payout.state}`), { statusCode: 409 });
    }
    payout.state = 'processing';
    this.appendAudit(payout, 'payout.processing', actor);
    return payout;
  }

  markPaid(id, actor, providerReference) {
    const payout = this.get(id);
    if (payout.state !== 'processing') {
      throw Object.assign(new Error('Only processing payouts can be marked paid'), { statusCode: 409 });
    }
    if (!providerReference) throw Object.assign(new Error('providerReference is required'), { statusCode: 400 });
    payout.state = 'paid';
    payout.providerReference = String(providerReference);
    this.appendAudit(payout, 'payout.paid', actor || 'payout-provider', { providerReference: payout.providerReference });
    return payout;
  }
}

function requireSecret(headerName, expectedSecret) {
  return (req, res, next) => {
    const provided = req.get(headerName);
    if (!expectedSecret || !timingSafeEqualString(provided, expectedSecret)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
}

function createPayoutRouter({
  store = new PayoutStore({
    maxPayoutMinor: Number(process.env.MAX_PAYOUT_MINOR || 100_000),
    allowedAssetNetworks: String(process.env.PAYOUT_ASSET_NETWORK_ALLOWLIST || 'USDC:base,USDC:solana')
      .split(',').map((value) => value.trim()).filter(Boolean),
  }),
  complianceKey = process.env.COMPLIANCE_SERVICE_KEY,
  adminKey = process.env.PAYOUT_ADMIN_KEY,
  providerKey = process.env.PAYOUT_PROVIDER_KEY,
  realValuePayoutsEnabled = process.env.REAL_VALUE_PAYOUTS_ENABLED === 'true',
  payoutProviderMode = process.env.PAYOUT_PROVIDER_MODE || 'disabled',
} = {}) {
  const express = require('express');
  const router = express.Router();
  const requireCompliance = requireSecret('X-Compliance-Key', complianceKey);
  const requireAdmin = requireSecret('X-Admin-Key', adminKey);
  const requireProvider = requireSecret('X-Payout-Provider-Key', providerKey);

  router.post('/api/internal/payouts', requireCompliance, (req, res, next) => {
    try {
      const created = store.createPayout(req.body, req.get('X-Service-Name') || 'reward-service');
      res.status(created.idempotentReplay ? 200 : 201).json({
        payout: sanitizePayout(created.payout),
        claimToken: created.claimToken,
        idempotentReplay: created.idempotentReplay,
      });
    } catch (error) { next(error); }
  });

  router.put('/api/internal/payouts/:id/checks/:checkName', requireCompliance, (req, res, next) => {
    try {
      const payout = store.setCheck(req.params.id, req.params.checkName, req.body, req.get('X-Service-Name') || 'compliance-service');
      res.json({ payout: sanitizePayout(payout) });
    } catch (error) { next(error); }
  });

  router.get('/api/payouts/:id', (req, res, next) => {
    try {
      const payout = store.get(req.params.id);
      const token = String(req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!store.verifyClaimToken(payout, token)) return res.status(401).json({ error: 'Unauthorized' });
      res.json({ payout: sanitizePayout(payout) });
    } catch (error) { next(error); }
  });

  router.get('/api/admin/payouts', requireAdmin, (req, res, next) => {
    try {
      const payouts = store.list({ state: req.query.state }).map((payout) => sanitizePayout(payout, { includeAudit: req.query.audit === 'true', includeEvidence: true }));
      res.json({ payouts });
    } catch (error) { next(error); }
  });

  router.get('/api/admin/payouts/:id', requireAdmin, (req, res, next) => {
    try {
      res.json({ payout: sanitizePayout(store.get(req.params.id), { includeAudit: true, includeEvidence: true }) });
    } catch (error) { next(error); }
  });

  router.post('/api/admin/payouts/:id/approve', requireAdmin, (req, res, next) => {
    try {
      const reviewer = req.body?.reviewer || req.get('X-Reviewer');
      const payout = store.approve(req.params.id, reviewer, req.body?.note);
      res.json({ payout: sanitizePayout(payout, { includeAudit: true, includeEvidence: true }) });
    } catch (error) { next(error); }
  });

  router.post('/api/admin/payouts/:id/reject', requireAdmin, (req, res, next) => {
    try {
      const reviewer = req.body?.reviewer || req.get('X-Reviewer');
      const payout = store.reject(req.params.id, reviewer, req.body?.reason);
      res.json({ payout: sanitizePayout(payout, { includeAudit: true, includeEvidence: true }) });
    } catch (error) { next(error); }
  });

  router.post('/api/admin/payouts/:id/dispatch', requireAdmin, (req, res, next) => {
    try {
      if (!realValuePayoutsEnabled || payoutProviderMode !== 'external') {
        return res.status(503).json({
          error: 'Real-value payout dispatch is disabled',
          code: 'PAYOUTS_DISABLED',
          message: 'Set REAL_VALUE_PAYOUTS_ENABLED=true and PAYOUT_PROVIDER_MODE=external only after licensing, provider, custody, and production database controls are complete.',
        });
      }
      const payout = store.beginDispatch(req.params.id, req.body?.actor || 'payout-provider');
      res.status(202).json({
        payout: sanitizePayout(payout, { includeAudit: true, includeEvidence: true }),
        message: 'Approved for provider dispatch; no transfer adapter is configured in this build.',
      });
    } catch (error) { next(error); }
  });

  router.post('/api/internal/payouts/:id/mark-paid', requireProvider, (req, res, next) => {
    try {
      const payout = store.markPaid(req.params.id, req.get('X-Service-Name') || 'payout-provider', req.body?.providerReference);
      res.json({ payout: sanitizePayout(payout, { includeAudit: true, includeEvidence: true }) });
    } catch (error) { next(error); }
  });

  return { router, store };
}

module.exports = {
  CHECK_NAMES,
  AUTOMATED_CHECK_NAMES,
  PayoutStore,
  allChecksPass,
  automatedChecksPass,
  blockingReasons,
  createPayoutRouter,
  sanitizePayout,
};
