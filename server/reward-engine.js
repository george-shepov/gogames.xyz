'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class RewardError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'RewardError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function parseInteger(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim().toUpperCase())
    .filter(Boolean);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqualText(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signRewardIdentity(userId, expiresAtMs, secret) {
  if (!userId || !Number.isFinite(expiresAtMs) || !secret) {
    throw new Error('userId, expiresAtMs, and secret are required');
  }
  const payload = `${userId}.${Math.floor(expiresAtMs)}`;
  return `${payload}.${hmac(secret, payload)}`;
}

function verifyRewardIdentity(token, secret, nowMs = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new RewardError(401, 'invalid_identity', 'Invalid reward identity token');
  const [userId, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!userId || !Number.isFinite(expiresAt)) {
    throw new RewardError(401, 'invalid_identity', 'Invalid reward identity token');
  }
  const payload = `${userId}.${Math.floor(expiresAt)}`;
  if (!safeEqualText(signature, hmac(secret, payload))) {
    throw new RewardError(401, 'invalid_identity', 'Invalid reward identity token');
  }
  if (expiresAt <= nowMs) throw new RewardError(401, 'identity_expired', 'Reward identity token expired');
  return { userId, expiresAt };
}

function loadConfig(env = process.env) {
  const mode = ['off', 'review', 'live'].includes(String(env.REWARDS_MODE || '').toLowerCase())
    ? String(env.REWARDS_MODE).toLowerCase()
    : 'off';

  return {
    mode,
    identitySecret: env.REWARDS_IDENTITY_SECRET || '',
    sessionSecret: env.REWARDS_SESSION_SECRET || '',
    adminToken: env.REWARDS_ADMIN_TOKEN || '',
    dataFile: env.REWARDS_DATA_FILE || '',
    payoutWebhookUrl: env.REWARDS_PAYOUT_WEBHOOK_URL || '',
    payoutWebhookSecret: env.REWARDS_PAYOUT_WEBHOOK_SECRET || '',
    allowedJurisdictions: parseCsv(env.REWARDS_ALLOWED_JURISDICTIONS),
    termsVersion: env.REWARDS_TERMS_VERSION || '2026-01',
    rewardCurrency: String(env.REWARDS_CURRENCY || 'GGX').toUpperCase(),
    mathSprintRewardAmount: parseInteger(env.REWARDS_MATH_SPRINT_REWARD_AMOUNT, 10, { min: 1, max: 1_000_000 }),
    mathSprintMinScore: parseInteger(env.REWARDS_MATH_SPRINT_MIN_SCORE, 1_700, { min: 0, max: 10_000 }),
    mathSprintQuestionCount: parseInteger(env.REWARDS_MATH_SPRINT_QUESTION_COUNT, 20, { min: 5, max: 100 }),
    dailyRewardCap: parseInteger(env.REWARDS_DAILY_CAP, 100, { min: 1, max: 10_000_000 }),
    sessionTtlMs: parseInteger(env.REWARDS_SESSION_TTL_MS, 10 * 60_000, { min: 60_000, max: 60 * 60_000 }),
    minAnswerIntervalMs: parseInteger(env.REWARDS_MIN_ANSWER_INTERVAL_MS, 180, { min: 0, max: 10_000 }),
    maxIdentityTtlMs: parseInteger(env.REWARDS_MAX_IDENTITY_TTL_MS, 60 * 60_000, { min: 60_000, max: 24 * 60 * 60_000 }),
  };
}

function validateConfig(config) {
  const problems = [];
  if (config.mode === 'off') return problems;
  if (config.identitySecret.length < 32) problems.push('REWARDS_IDENTITY_SECRET must be at least 32 characters');
  if (config.sessionSecret.length < 32) problems.push('REWARDS_SESSION_SECRET must be at least 32 characters');
  if (!config.dataFile) problems.push('REWARDS_DATA_FILE is required');
  if (config.allowedJurisdictions.length === 0) problems.push('REWARDS_ALLOWED_JURISDICTIONS must explicitly allow at least one jurisdiction');
  if (config.adminToken.length < 24) problems.push('REWARDS_ADMIN_TOKEN must be at least 24 characters');
  if (config.mode === 'live') {
    if (!/^https:\/\//i.test(config.payoutWebhookUrl)) problems.push('REWARDS_PAYOUT_WEBHOOK_URL must be an HTTPS URL');
    if (config.payoutWebhookSecret.length < 32) problems.push('REWARDS_PAYOUT_WEBHOOK_SECRET must be at least 32 characters');
  }
  return problems;
}

function initialState() {
  return {
    schemaVersion: 1,
    sessions: {},
    claims: {},
    compliance: {},
    audit: [],
  };
}

function createJsonStore(filePath) {
  let state = initialState();

  if (filePath && fs.existsSync(filePath)) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    state = { ...initialState(), ...parsed };
  }

  function persist() {
    if (!filePath) return;
    const directory = path.dirname(filePath);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temp, filePath);
  }

  return {
    get state() { return state; },
    persist,
    reset(nextState = initialState()) {
      state = nextState;
      persist();
    },
  };
}

function sanitizeQuestion(question, index, total) {
  return {
    index,
    total,
    prompt: `${question.left} ${question.operator} ${question.right}`,
  };
}

function sanitizeSession(session) {
  return {
    id: session.id,
    gameId: session.gameId,
    status: session.status,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    answered: session.answers.length,
    total: session.questions.length,
    correct: session.answers.filter(answer => answer.correct).length,
  };
}

function sanitizeClaim(claim) {
  return {
    id: claim.id,
    sessionId: claim.sessionId,
    gameId: claim.gameId,
    userId: claim.userId,
    status: claim.status,
    score: claim.score,
    correct: claim.correct,
    total: claim.total,
    reward: claim.reward,
    reasons: claim.reasons,
    createdAt: claim.createdAt,
    reviewedAt: claim.reviewedAt || null,
    paidAt: claim.paidAt || null,
    payoutReference: claim.payoutReference || null,
  };
}

function createMathQuestion() {
  const operation = crypto.randomInt(0, 3);
  if (operation === 0) {
    const left = crypto.randomInt(8, 80);
    const right = crypto.randomInt(2, 30);
    return { left, right, operator: '+', answer: left + right };
  }
  if (operation === 1) {
    const right = crypto.randomInt(2, 30);
    const answer = crypto.randomInt(2, 60);
    return { left: answer + right, right, operator: '-', answer };
  }
  const left = crypto.randomInt(2, 13);
  const right = crypto.randomInt(2, 13);
  return { left, right, operator: '×', answer: left * right };
}

function computeIntegrityHash(session, secret) {
  const canonical = JSON.stringify({
    id: session.id,
    userId: session.userId,
    gameId: session.gameId,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    integritySeed: session.integritySeed,
    questions: session.questions.map(question => [question.left, question.operator, question.right, question.answer]),
    answers: session.answers.map(answer => [answer.index, answer.receivedAt, answer.correct]),
  });
  return hmac(secret, canonical);
}

function getAuthorizationToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function createRewardEngine({ env = process.env, now = () => Date.now(), fetchImpl = global.fetch, store: suppliedStore } = {}) {
  const config = loadConfig(env);
  const configProblems = validateConfig(config);
  const store = suppliedStore || createJsonStore(config.dataFile);
  const state = store.state;

  function assertConfigured() {
    if (config.mode === 'off') throw new RewardError(503, 'rewards_disabled', 'Reward-bearing play is disabled');
    if (configProblems.length > 0) {
      throw new RewardError(503, 'rewards_misconfigured', 'Reward service is not safely configured', configProblems);
    }
  }

  function audit(type, payload) {
    const previousHash = state.audit.length ? state.audit[state.audit.length - 1].hash : 'GENESIS';
    const entry = {
      id: crypto.randomUUID(),
      type,
      at: now(),
      payload,
      previousHash,
    };
    entry.hash = hmac(config.sessionSecret || 'disabled-audit-secret', JSON.stringify(entry));
    state.audit.push(entry);
    if (state.audit.length > 10_000) state.audit.splice(0, state.audit.length - 10_000);
    store.persist();
    return entry;
  }

  function eligibilityFor(userId) {
    const profile = state.compliance[userId];
    const reasons = [];
    if (!profile) return { eligible: false, reasons: ['compliance_profile_missing'] };
    if (profile.ageVerified !== true) reasons.push('age_not_verified');
    if (profile.identityVerified !== true) reasons.push('identity_not_verified');
    if (profile.sanctionsClear !== true) reasons.push('sanctions_not_cleared');
    if (profile.selfExcluded === true) reasons.push('self_excluded');
    if (profile.accountRestricted === true) reasons.push('account_restricted');
    if (profile.deviceRisk && !['low', 'normal'].includes(String(profile.deviceRisk).toLowerCase())) reasons.push('device_risk');
    if (profile.termsVersion !== config.termsVersion || !profile.termsAcceptedAt) reasons.push('terms_not_accepted');
    const jurisdiction = `${String(profile.country || '').toUpperCase()}-${String(profile.region || '').toUpperCase()}`;
    if (!config.allowedJurisdictions.includes(jurisdiction)) reasons.push('jurisdiction_not_allowed');
    return { eligible: reasons.length === 0, reasons, profile, jurisdiction };
  }

  function authenticateIdentity(req) {
    assertConfigured();
    const identity = verifyRewardIdentity(getAuthorizationToken(req), config.identitySecret, now());
    if (identity.expiresAt - now() > config.maxIdentityTtlMs) {
      throw new RewardError(401, 'identity_ttl_too_long', 'Reward identity token exceeds the allowed lifetime');
    }
    return identity;
  }

  function authenticateAdmin(req) {
    assertConfigured();
    const token = getAuthorizationToken(req);
    if (!token || !safeEqualText(token, config.adminToken)) {
      throw new RewardError(401, 'admin_auth_required', 'Admin authorization required');
    }
  }

  function setCompliance(userId, profile) {
    if (!userId) throw new RewardError(400, 'user_required', 'userId is required');
    const normalized = {
      userId,
      ageVerified: profile.ageVerified === true,
      identityVerified: profile.identityVerified === true,
      sanctionsClear: profile.sanctionsClear === true,
      selfExcluded: profile.selfExcluded === true,
      accountRestricted: profile.accountRestricted === true,
      deviceRisk: String(profile.deviceRisk || 'unknown').toLowerCase(),
      country: String(profile.country || '').toUpperCase(),
      region: String(profile.region || '').toUpperCase(),
      termsVersion: String(profile.termsVersion || ''),
      termsAcceptedAt: profile.termsAcceptedAt || null,
      providerReference: profile.providerReference || null,
      updatedAt: now(),
    };
    state.compliance[userId] = normalized;
    audit('compliance.updated', { userId, providerReference: normalized.providerReference });
    return { ...normalized, eligibility: eligibilityFor(userId) };
  }

  function startSession(userId, gameId) {
    assertConfigured();
    if (gameId !== 'math-sprint-v1') {
      throw new RewardError(400, 'unsupported_game', 'Only server-verifiable games may enter a reward program');
    }
    const eligibility = eligibilityFor(userId);
    if (!eligibility.eligible) {
      throw new RewardError(403, 'not_eligible', 'Reward eligibility requirements are not satisfied', eligibility.reasons);
    }

    const startedAt = now();
    const questions = Array.from({ length: config.mathSprintQuestionCount }, createMathQuestion);
    const session = {
      id: crypto.randomUUID(),
      userId,
      gameId,
      status: 'active',
      startedAt,
      expiresAt: startedAt + config.sessionTtlMs,
      lastAnswerAt: null,
      questions,
      answers: [],
      claimId: null,
    };
    session.integritySeed = base64url(crypto.randomBytes(24));
    state.sessions[session.id] = session;
    audit('session.started', { sessionId: session.id, userId, gameId });
    return {
      session: sanitizeSession(session),
      question: sanitizeQuestion(questions[0], 0, questions.length),
      browserScoresAccepted: false,
    };
  }

  function getOwnedSession(userId, sessionId) {
    const session = state.sessions[sessionId];
    if (!session) throw new RewardError(404, 'session_not_found', 'Reward session not found');
    if (session.userId !== userId) throw new RewardError(403, 'session_forbidden', 'Reward session belongs to another identity');
    return session;
  }

  function answerSession(userId, sessionId, submittedAnswer) {
    const session = getOwnedSession(userId, sessionId);
    if (session.status !== 'active') throw new RewardError(409, 'session_not_active', 'Reward session is not active');
    const receivedAt = now();
    if (receivedAt > session.expiresAt) {
      session.status = 'expired';
      audit('session.expired', { sessionId, userId });
      throw new RewardError(410, 'session_expired', 'Reward session expired');
    }
    const answer = Number(submittedAnswer);
    if (!Number.isInteger(answer)) throw new RewardError(400, 'invalid_answer', 'answer must be an integer');
    const previousAt = session.lastAnswerAt || session.startedAt;
    if (receivedAt - previousAt < config.minAnswerIntervalMs) {
      audit('session.rate_violation', { sessionId, userId, intervalMs: receivedAt - previousAt });
      throw new RewardError(429, 'answer_too_fast', 'Answer arrived faster than the server integrity threshold');
    }

    const index = session.answers.length;
    const question = session.questions[index];
    if (!question) throw new RewardError(409, 'session_complete', 'All questions are already answered');
    const correct = answer === question.answer;
    session.answers.push({ index, receivedAt, correct });
    session.lastAnswerAt = receivedAt;
    if (session.answers.length === session.questions.length) session.status = 'complete';
    store.persist();

    const nextIndex = session.answers.length;
    return {
      session: sanitizeSession(session),
      result: { index, correct },
      question: nextIndex < session.questions.length
        ? sanitizeQuestion(session.questions[nextIndex], nextIndex, session.questions.length)
        : null,
    };
  }

  function dailyPaidAmount(userId, atMs = now()) {
    const date = new Date(atMs).toISOString().slice(0, 10);
    return Object.values(state.claims)
      .filter(claim => claim.userId === userId && claim.status === 'paid' && new Date(claim.paidAt).toISOString().slice(0, 10) === date)
      .reduce((sum, claim) => sum + Number(claim.reward.amount || 0), 0);
  }

  function finishSession(userId, sessionId) {
    const session = getOwnedSession(userId, sessionId);
    if (session.claimId) return sanitizeClaim(state.claims[session.claimId]);
    if (session.status === 'active') throw new RewardError(409, 'session_incomplete', 'All server-issued questions must be answered');
    if (session.status !== 'complete') throw new RewardError(409, 'session_not_claimable', 'Reward session cannot be claimed');

    const completedAt = session.lastAnswerAt || now();
    const correct = session.answers.filter(answer => answer.correct).length;
    const elapsedSeconds = Math.max(1, Math.ceil((completedAt - session.startedAt) / 1000));
    const speedBonus = correct === session.questions.length ? Math.max(0, 500 - elapsedSeconds * 10) : 0;
    const score = correct * 100 + speedBonus;
    const eligibility = eligibilityFor(userId);
    const reasons = [...eligibility.reasons];
    if (score < config.mathSprintMinScore) reasons.push('score_below_threshold');
    if (dailyPaidAmount(userId) + config.mathSprintRewardAmount > config.dailyRewardCap) reasons.push('daily_cap_exceeded');

    let status = 'pending_review';
    if (reasons.includes('score_below_threshold')) status = 'not_qualified';
    else if (reasons.length > 0) status = 'blocked';

    const claim = {
      id: crypto.randomUUID(),
      sessionId,
      gameId: session.gameId,
      userId,
      status,
      score,
      correct,
      total: session.questions.length,
      elapsedMs: completedAt - session.startedAt,
      integrityHash: computeIntegrityHash(session, config.sessionSecret),
      reward: {
        amount: status === 'not_qualified' ? 0 : config.mathSprintRewardAmount,
        currency: config.rewardCurrency,
      },
      reasons,
      createdAt: now(),
      reviewedAt: null,
      paidAt: null,
      payoutReference: null,
    };
    session.claimId = claim.id;
    state.claims[claim.id] = claim;
    audit('claim.created', { claimId: claim.id, sessionId, userId, status, score });
    return sanitizeClaim(claim);
  }

  function listClaims(userId) {
    return Object.values(state.claims)
      .filter(claim => claim.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(sanitizeClaim);
  }

  function getClaimForUser(userId, claimId) {
    const claim = state.claims[claimId];
    if (!claim) throw new RewardError(404, 'claim_not_found', 'Reward claim not found');
    if (claim.userId !== userId) throw new RewardError(403, 'claim_forbidden', 'Reward claim belongs to another identity');
    return sanitizeClaim(claim);
  }

  function listAdminClaims(status) {
    return Object.values(state.claims)
      .filter(claim => !status || claim.status === status)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(sanitizeClaim);
  }

  async function dispatchPayout(claim) {
    if (typeof fetchImpl !== 'function') throw new RewardError(503, 'payout_transport_missing', 'Payout transport is unavailable');
    const body = JSON.stringify({
      idempotencyKey: claim.id,
      claim: sanitizeClaim(claim),
      integrityHash: claim.integrityHash,
    });
    const signature = crypto.createHmac('sha256', config.payoutWebhookSecret).update(body).digest('hex');
    const response = await fetchImpl(config.payoutWebhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': claim.id,
        'x-gogames-signature': `sha256=${signature}`,
      },
      body,
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new RewardError(502, 'payout_rejected', 'Payout provider rejected the claim', { status: response.status });
    }
    let payload = {};
    try { payload = responseText ? JSON.parse(responseText) : {}; } catch { payload = {}; }
    return payload.reference || payload.id || claim.id;
  }

  async function approveClaim(claimId, reviewer) {
    assertConfigured();
    if (config.mode !== 'live') throw new RewardError(409, 'live_payouts_disabled', 'Claims can only be paid in live mode');
    const claim = state.claims[claimId];
    if (!claim) throw new RewardError(404, 'claim_not_found', 'Reward claim not found');
    if (claim.status === 'paid') return sanitizeClaim(claim);
    if (!['pending_review', 'payout_failed'].includes(claim.status)) {
      throw new RewardError(409, 'claim_not_approvable', `Claim is ${claim.status}`);
    }
    const eligibility = eligibilityFor(claim.userId);
    if (!eligibility.eligible) {
      claim.status = 'blocked';
      claim.reasons = eligibility.reasons;
      claim.reviewedAt = now();
      claim.reviewedBy = reviewer;
      audit('claim.blocked', { claimId, reviewer, reasons: claim.reasons });
      return sanitizeClaim(claim);
    }
    if (dailyPaidAmount(claim.userId) + claim.reward.amount > config.dailyRewardCap) {
      throw new RewardError(409, 'daily_cap_exceeded', 'Daily reward cap would be exceeded');
    }

    claim.status = 'payout_pending';
    claim.reviewedAt = now();
    claim.reviewedBy = reviewer;
    store.persist();
    audit('claim.approved', { claimId, reviewer });

    try {
      const payoutReference = await dispatchPayout(claim);
      claim.status = 'paid';
      claim.paidAt = now();
      claim.payoutReference = payoutReference;
      audit('claim.paid', { claimId, payoutReference });
      return sanitizeClaim(claim);
    } catch (error) {
      claim.status = 'payout_failed';
      claim.payoutError = error.code || 'payout_failed';
      audit('claim.payout_failed', { claimId, error: claim.payoutError });
      throw error;
    }
  }

  function rejectClaim(claimId, reviewer, reason) {
    const claim = state.claims[claimId];
    if (!claim) throw new RewardError(404, 'claim_not_found', 'Reward claim not found');
    if (claim.status === 'paid') throw new RewardError(409, 'claim_already_paid', 'Paid claims cannot be rejected');
    claim.status = 'rejected';
    claim.reviewedAt = now();
    claim.reviewedBy = reviewer;
    claim.reasons = [...new Set([...(claim.reasons || []), reason || 'manual_rejection'])];
    audit('claim.rejected', { claimId, reviewer, reason: reason || 'manual_rejection' });
    return sanitizeClaim(claim);
  }

  function getStatus() {
    return {
      mode: config.mode,
      configured: configProblems.length === 0,
      configurationProblems: config.mode === 'off' ? [] : configProblems,
      acceptingRewardSessions: config.mode !== 'off' && configProblems.length === 0,
      livePayoutsEnabled: config.mode === 'live' && configProblems.length === 0,
      browserScoresAccepted: false,
      manualReviewRequired: true,
      supportedGames: ['math-sprint-v1'],
      termsVersion: config.termsVersion,
      allowedJurisdictions: config.allowedJurisdictions,
    };
  }

  return {
    config,
    state,
    getStatus,
    authenticateIdentity,
    authenticateAdmin,
    setCompliance,
    eligibilityFor,
    startSession,
    answerSession,
    finishSession,
    listClaims,
    getClaimForUser,
    listAdminClaims,
    approveClaim,
    rejectClaim,
  };
}

function createRewardRouter({ express, env = process.env, now, fetchImpl, store } = {}) {
  if (!express) throw new Error('express is required');
  const engine = createRewardEngine({ env, now, fetchImpl, store });
  const router = express.Router();

  const identity = (req, _res, next) => {
    try {
      req.rewardIdentity = engine.authenticateIdentity(req);
      next();
    } catch (error) { next(error); }
  };
  const admin = (req, _res, next) => {
    try {
      engine.authenticateAdmin(req);
      next();
    } catch (error) { next(error); }
  };

  router.get('/status', (_req, res) => res.json(engine.getStatus()));

  router.post('/sessions', identity, (req, res, next) => {
    try {
      res.status(201).json(engine.startSession(req.rewardIdentity.userId, req.body.gameId));
    } catch (error) { next(error); }
  });

  router.post('/sessions/:sessionId/answers', identity, (req, res, next) => {
    try {
      res.json(engine.answerSession(req.rewardIdentity.userId, req.params.sessionId, req.body.answer));
    } catch (error) { next(error); }
  });

  router.post('/sessions/:sessionId/finish', identity, (req, res, next) => {
    try {
      res.json(engine.finishSession(req.rewardIdentity.userId, req.params.sessionId));
    } catch (error) { next(error); }
  });

  router.get('/claims', identity, (req, res) => {
    res.json({ claims: engine.listClaims(req.rewardIdentity.userId) });
  });

  router.get('/claims/:claimId', identity, (req, res, next) => {
    try {
      res.json(engine.getClaimForUser(req.rewardIdentity.userId, req.params.claimId));
    } catch (error) { next(error); }
  });

  router.put('/admin/users/:userId/compliance', admin, (req, res, next) => {
    try {
      res.json(engine.setCompliance(req.params.userId, req.body));
    } catch (error) { next(error); }
  });

  router.get('/admin/claims', admin, (req, res) => {
    res.json({ claims: engine.listAdminClaims(req.query.status) });
  });

  router.post('/admin/claims/:claimId/approve', admin, async (req, res, next) => {
    try {
      res.json(await engine.approveClaim(req.params.claimId, req.body.reviewer || 'admin'));
    } catch (error) { next(error); }
  });

  router.post('/admin/claims/:claimId/reject', admin, (req, res, next) => {
    try {
      res.json(engine.rejectClaim(req.params.claimId, req.body.reviewer || 'admin', req.body.reason));
    } catch (error) { next(error); }
  });

  router.use((error, _req, res, _next) => {
    if (error instanceof RewardError) {
      return res.status(error.status).json({ error: error.code, message: error.message, details: error.details });
    }
    console.error('[Rewards]', error);
    return res.status(500).json({ error: 'reward_service_error', message: 'Reward service failed safely' });
  });

  return { router, engine };
}

module.exports = {
  RewardError,
  createJsonStore,
  createRewardEngine,
  createRewardRouter,
  loadConfig,
  signRewardIdentity,
  verifyRewardIdentity,
};
