'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AUTOMATED_CHECK_NAMES,
  PayoutStore,
  allChecksPass,
  blockingReasons,
} = require('../payouts');

function makeStore() {
  return new PayoutStore({ maxPayoutMinor: 50_000 });
}

function makePayout(store, overrides = {}) {
  return store.createPayout({
    userId: 'user-1',
    sourceEventId: 'verified-match-1',
    amountMinor: 500,
    asset: 'USDC',
    network: 'base',
    destination: '0x1111111111111111111111111111111111111111',
    idempotencyKey: 'reward-1',
    ...overrides,
  });
}

function passAutomatedChecks(store, payoutId) {
  for (const checkName of AUTOMATED_CHECK_NAMES) {
    store.setCheck(payoutId, checkName, {
      status: 'pass',
      provider: 'test-provider',
      evidenceRef: `${checkName}-evidence`,
      metadata: checkName === 'terms' ? { termsVersion: '2026-07-28' } : {},
    });
  }
}

test('new payouts are blocked with all eight checks pending', () => {
  const store = makeStore();
  const { payout, claimToken } = makePayout(store);
  assert.equal(payout.state, 'blocked');
  assert.ok(claimToken);
  assert.equal(blockingReasons(payout).length, 8);
});

test('manual approval is impossible until all automated checks pass', () => {
  const store = makeStore();
  const { payout } = makePayout(store);
  assert.throws(() => store.approve(payout.id, 'reviewer@example.com'), /All automated checks/);
  assert.equal(payout.state, 'blocked');
});

test('all automated checks plus manual approval produce an approved payout', () => {
  const store = makeStore();
  const { payout } = makePayout(store);
  passAutomatedChecks(store, payout.id);
  store.approve(payout.id, 'reviewer@example.com', 'Evidence reviewed');
  assert.equal(payout.state, 'approved');
  assert.equal(allChecksPass(payout), true);
});

test('a self-exclusion failure blocks approval', () => {
  const store = makeStore();
  const { payout } = makePayout(store);
  passAutomatedChecks(store, payout.id);
  store.setCheck(payout.id, 'selfExclusion', {
    status: 'fail',
    provider: 'responsible-gaming-service',
    evidenceRef: 'self-exclusion-match',
    reasonCode: 'active_self_exclusion',
  });
  assert.throws(() => store.approve(payout.id, 'reviewer@example.com'), /All automated checks/);
  assert.deepEqual(blockingReasons(payout).find((item) => item.check === 'selfExclusion'), {
    check: 'selfExclusion',
    reason: 'active_self_exclusion',
  });
});

test('changing any automated check invalidates prior manual approval', () => {
  const store = makeStore();
  const { payout } = makePayout(store);
  passAutomatedChecks(store, payout.id);
  store.approve(payout.id, 'reviewer@example.com');
  store.setCheck(payout.id, 'sanctions', {
    status: 'pending',
    provider: 'sanctions-provider',
    evidenceRef: null,
  });
  assert.equal(payout.state, 'blocked');
  assert.equal(payout.checks.manualApproval.status, 'pending');
});

test('an expired check blocks dispatch even after approval', () => {
  const store = makeStore();
  const { payout } = makePayout(store);
  passAutomatedChecks(store, payout.id);
  store.approve(payout.id, 'reviewer@example.com');
  store.setCheck(payout.id, 'sanctions', {
    status: 'pass',
    provider: 'sanctions-provider',
    evidenceRef: 'screening-2',
    expiresAt: '2000-01-01T00:00:00.000Z',
  });
  assert.throws(() => store.beginDispatch(payout.id), /blocked/);
  assert.equal(payout.state, 'blocked');
});

test('a rejected payout cannot be moved back to blocked by a dispatch attempt', () => {
  const store = makeStore();
  const { payout } = makePayout(store);
  passAutomatedChecks(store, payout.id);
  store.reject(payout.id, 'reviewer@example.com', 'Fraud risk');
  assert.throws(() => store.beginDispatch(payout.id), /must be approved/);
  assert.equal(payout.state, 'rejected');
});

test('idempotency prevents duplicate payouts', () => {
  const store = makeStore();
  const first = makePayout(store);
  const second = makePayout(store);
  assert.equal(second.idempotentReplay, true);
  assert.equal(second.payout.id, first.payout.id);
  assert.equal(second.claimToken, null);
});

test('compliance service cannot write manual approval', () => {
  const store = makeStore();
  const { payout } = makePayout(store);
  assert.throws(() => store.setCheck(payout.id, 'manualApproval', {
    status: 'pass',
    evidenceRef: 'forged',
  }), /Only automated checks/);
});

test('amounts must use positive integer minor units', () => {
  const store = makeStore();
  assert.throws(() => makePayout(store, { amountMinor: 4.99 }), /positive integer/);
  assert.throws(() => makePayout(store, { amountMinor: -1 }), /positive integer/);
});
