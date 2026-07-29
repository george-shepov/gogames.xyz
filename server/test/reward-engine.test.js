'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RewardError,
  createJsonStore,
  createRewardEngine,
  signRewardIdentity,
  verifyRewardIdentity,
} = require('../reward-engine');

function makeEnv(overrides = {}) {
  return {
    REWARDS_MODE: 'review',
    REWARDS_IDENTITY_SECRET: 'identity-secret-that-is-definitely-at-least-32-characters',
    REWARDS_SESSION_SECRET: 'session-secret-that-is-definitely-at-least-32-characters',
    REWARDS_ADMIN_TOKEN: 'admin-token-that-is-long-enough',
    REWARDS_ALLOWED_JURISDICTIONS: 'US-OH',
    REWARDS_TERMS_VERSION: '2026-01',
    REWARDS_MATH_SPRINT_QUESTION_COUNT: '5',
    REWARDS_MATH_SPRINT_MIN_SCORE: '500',
    REWARDS_MATH_SPRINT_REWARD_AMOUNT: '10',
    REWARDS_DAILY_CAP: '20',
    REWARDS_MIN_ANSWER_INTERVAL_MS: '100',
    REWARDS_SESSION_TTL_MS: '60000',
    REWARDS_DATA_FILE: '/tmp/gogames-reward-test-never-written.json',
    ...overrides,
  };
}

function eligibleProfile() {
  return {
    ageVerified: true,
    identityVerified: true,
    sanctionsClear: true,
    selfExcluded: false,
    accountRestricted: false,
    deviceRisk: 'low',
    country: 'US',
    region: 'OH',
    termsVersion: '2026-01',
    termsAcceptedAt: '2026-07-28T12:00:00.000Z',
    providerReference: 'kyc_test_1',
  };
}

function makeEngine(envOverrides = {}) {
  let clock = Date.parse('2026-07-28T12:00:00.000Z');
  const store = createJsonStore('');
  const engine = createRewardEngine({
    env: makeEnv(envOverrides),
    now: () => clock,
    store,
    fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ reference: 'payout_1' }) }),
  });
  return {
    engine,
    tick(ms = 150) { clock += ms; },
    now() { return clock; },
  };
}

test('reward identity tokens are signed, scoped, and expire', () => {
  const secret = 'identity-secret-that-is-definitely-at-least-32-characters';
  const now = Date.now();
  const token = signRewardIdentity('user-1', now + 60_000, secret);
  assert.equal(verifyRewardIdentity(token, secret, now).userId, 'user-1');
  assert.throws(
    () => verifyRewardIdentity(`${token}tampered`, secret, now),
    error => error instanceof RewardError && error.code === 'invalid_identity',
  );
  assert.throws(
    () => verifyRewardIdentity(signRewardIdentity('user-1', now - 1, secret), secret, now),
    error => error instanceof RewardError && error.code === 'identity_expired',
  );
});

test('reward sessions require a server-managed compliance profile', () => {
  const { engine } = makeEngine();
  assert.throws(
    () => engine.startSession('user-1', 'math-sprint-v1'),
    error => error instanceof RewardError && error.code === 'not_eligible' && error.details.includes('compliance_profile_missing'),
  );

  engine.setCompliance('user-1', { ...eligibleProfile(), selfExcluded: true });
  assert.throws(
    () => engine.startSession('user-1', 'math-sprint-v1'),
    error => error instanceof RewardError && error.details.includes('self_excluded'),
  );
});

test('the server computes score from authoritative questions and timestamps', () => {
  const { engine, tick } = makeEngine();
  engine.setCompliance('user-1', eligibleProfile());
  const started = engine.startSession('user-1', 'math-sprint-v1');
  const session = engine.state.sessions[started.session.id];

  for (const question of session.questions) {
    tick(250);
    engine.answerSession('user-1', session.id, question.answer);
  }

  const claim = engine.finishSession('user-1', session.id);
  assert.equal(claim.correct, 5);
  assert.equal(claim.total, 5);
  assert.ok(claim.score >= 500);
  assert.equal(claim.status, 'pending_review');
  assert.deepEqual(claim.reward, { amount: 10, currency: 'GGX' });
  assert.equal(engine.state.sessions[session.id].integritySeed.length > 10, true);
  assert.equal(typeof engine.state.claims[claim.id].integrityHash, 'string');
});

test('finish is idempotent and cannot mint duplicate claims', () => {
  const { engine, tick } = makeEngine();
  engine.setCompliance('user-1', eligibleProfile());
  const { session: publicSession } = engine.startSession('user-1', 'math-sprint-v1');
  const session = engine.state.sessions[publicSession.id];
  for (const question of session.questions) {
    tick(250);
    engine.answerSession('user-1', session.id, question.answer);
  }

  const first = engine.finishSession('user-1', session.id);
  const second = engine.finishSession('user-1', session.id);
  assert.equal(second.id, first.id);
  assert.equal(Object.keys(engine.state.claims).length, 1);
});

test('answers arriving faster than the integrity floor are rejected', () => {
  const { engine, tick } = makeEngine();
  engine.setCompliance('user-1', eligibleProfile());
  const started = engine.startSession('user-1', 'math-sprint-v1');
  const question = engine.state.sessions[started.session.id].questions[0];
  tick(10);
  assert.throws(
    () => engine.answerSession('user-1', started.session.id, question.answer),
    error => error instanceof RewardError && error.code === 'answer_too_fast',
  );
});

test('browser-submitted score fields are irrelevant because finish accepts no score', () => {
  const { engine, tick } = makeEngine();
  engine.setCompliance('user-1', eligibleProfile());
  const started = engine.startSession('user-1', 'math-sprint-v1');
  const session = engine.state.sessions[started.session.id];

  for (const question of session.questions) {
    tick(250);
    engine.answerSession('user-1', session.id, question.answer + 1);
  }

  const claim = engine.finishSession('user-1', session.id, { score: 999999999 });
  assert.equal(claim.score, 0);
  assert.equal(claim.status, 'not_qualified');
  assert.equal(claim.reward.amount, 0);
});

test('live payout requires manual approval and is dispatched idempotently', async () => {
  let payoutCalls = 0;
  let clock = Date.parse('2026-07-28T12:00:00.000Z');
  const engine = createRewardEngine({
    env: makeEnv({
      REWARDS_MODE: 'live',
      REWARDS_PAYOUT_WEBHOOK_URL: 'https://payout.example.test/claims',
      REWARDS_PAYOUT_WEBHOOK_SECRET: 'payout-secret-that-is-definitely-at-least-32-characters',
    }),
    now: () => clock,
    store: createJsonStore(''),
    fetchImpl: async (_url, request) => {
      payoutCalls += 1;
      assert.equal(request.headers['idempotency-key'].length > 10, true);
      assert.match(request.headers['x-gogames-signature'], /^sha256=/);
      return { ok: true, text: async () => JSON.stringify({ reference: 'cashout_123' }) };
    },
  });

  engine.setCompliance('user-1', eligibleProfile());
  const started = engine.startSession('user-1', 'math-sprint-v1');
  const session = engine.state.sessions[started.session.id];
  for (const question of session.questions) {
    clock += 250;
    engine.answerSession('user-1', session.id, question.answer);
  }
  const claim = engine.finishSession('user-1', session.id);
  assert.equal(claim.status, 'pending_review');

  const paid = await engine.approveClaim(claim.id, 'compliance@example.test');
  assert.equal(paid.status, 'paid');
  assert.equal(paid.payoutReference, 'cashout_123');
  const repeated = await engine.approveClaim(claim.id, 'compliance@example.test');
  assert.equal(repeated.status, 'paid');
  assert.equal(payoutCalls, 1);
});
