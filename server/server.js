'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const { createPayoutRouter } = require('./payouts');
const { createRewardRouter } = require('./reward-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, '..');
const GGX_PACKAGES = new Map([
  [100, 500],
  [500, 2000],
  [2000, 6000],
  [5000, 12000],
]);

/** @type {Map<string, object>} */
const rooms = new Map();
/** @type {Map<string, object>} */
const users = new Map();
/** @type {Map<string, object>} */
const battles = new Map();
/** @type {Map<string, object>} */
const bets = new Map();
const processedStripeEvents = new Set();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      frameSrc: ["'self'", 'https://js.stripe.com'],
      connectSrc: ["'self'", 'https://api.stripe.com', 'wss:', 'ws:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const payLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const staticLimiter = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });

// Stripe must receive the untouched request bytes. Register this route before express.json().
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(503).json({ error: 'stripe_webhook_not_configured' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
  } catch {
    return res.status(400).type('text/plain').send('Webhook signature verification failed');
  }

  if (processedStripeEvents.has(event.id)) return res.sendStatus(200);
  processedStripeEvents.add(event.id);

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const ggx = Number.parseInt(intent.metadata.ggx, 10);
    const email = String(intent.metadata.email || '').trim().toLowerCase();
    const expectedAmount = GGX_PACKAGES.get(ggx);

    if (email && expectedAmount && intent.amount_received >= expectedAmount && intent.currency === 'usd') {
      let user = [...users.values()].find(candidate => candidate.email === email);
      if (!user) {
        user = { id: uuidv4(), email, ggxBalance: 0, balanceType: 'utility', createdAt: Date.now() };
        users.set(user.id, user);
      }
      user.ggxBalance += ggx;
      console.log(`[GGX] Credited ${ggx} utility GGX to ${email} (balance: ${user.ggxBalance})`);
    } else {
      console.warn('[Stripe] Payment metadata did not match the server package catalog', event.id);
    }
  }

  return res.sendStatus(200);
});

app.use(express.json({ limit: '64kb' }));
app.use('/api', apiLimiter);
app.use('/api/create-payment-intent', payLimiter);

const { router: rewardRouter, engine: rewardEngine } = createRewardRouter({ express, env: process.env });
app.use('/api/rewards', rewardRouter);

function send(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcastToRoom(roomId, payload) {
  const room = rooms.get(roomId);
  if (!room) return;
  [room.hostWs, room.guestWs].forEach(socket => send(socket, payload));
}

function sanitizeBattle(battle) {
  return {
    id: battle.id,
    game: battle.game,
    modelAName: battle.modelAName,
    modelBName: battle.modelBName,
    status: battle.status,
    moveCount: battle.moveCount,
    winner: battle.winner,
    spectatorCount: battle.spectators.length,
    bettingOpen: false,
    rewardEligible: false,
    verificationStatus: battle.verificationStatus,
    poolA: battle.poolA,
    poolB: battle.poolB,
    poolDraw: battle.poolDraw,
  };
}

function refundPendingBets(battleId) {
  for (const bet of bets.values()) {
    if (bet.battleId !== battleId || bet.status !== 'pending') continue;
    const user = users.get(bet.userId);
    if (user) user.ggxBalance += bet.amount;
    bet.status = 'refunded';
  }
}

wss.on('connection', ws => {
  ws.id = uuidv4();
  ws.roomId = null;
  ws.battleId = null;

  ws.on('message', raw => {
    let message;
    try { message = JSON.parse(raw); } catch { return; }

    if (message.type === 'join') {
      const roomId = String(message.room || '').toUpperCase();
      const role = message.role;
      if (!roomId || !['host', 'guest'].includes(role)) return;

      let room = rooms.get(roomId);
      if (!room) {
        room = {
          id: roomId,
          game: message.game || 'chess',
          status: 'waiting',
          hostId: null,
          guestId: null,
          hostWs: null,
          guestWs: null,
          createdAt: Date.now(),
          wager: null,
        };
        rooms.set(roomId, room);
      }

      ws.roomId = roomId;
      if (role === 'host' && !room.hostId) {
        room.hostId = ws.id;
        room.hostWs = ws;
        send(ws, { type: 'joined', role: 'host', room: roomId, game: room.game, rewardEligible: false });
      } else if (role === 'guest' && !room.guestId && room.hostId) {
        room.guestId = ws.id;
        room.guestWs = ws;
        room.status = 'playing';
        send(ws, { type: 'joined', role: 'guest', room: roomId, game: room.game, rewardEligible: false });
        send(room.hostWs, { type: 'opponent_joined', room: roomId });
        broadcastToRoom(roomId, { type: 'game_start', room: roomId, game: room.game, rewardEligible: false });
      } else {
        send(ws, { type: 'error', message: 'Room full or invalid join' });
      }
      return;
    }

    if (message.type === 'move') {
      const room = ws.roomId ? rooms.get(ws.roomId) : null;
      if (!room || room.status !== 'playing') return;
      const isHost = ws.id === room.hostId;
      send(isHost ? room.guestWs : room.hostWs, {
        type: 'move',
        move: message.move,
        from: isHost ? 'host' : 'guest',
      });
      return;
    }

    if (message.type === 'spectate') {
      const battle = battles.get(message.battleId);
      if (!battle) return send(ws, { type: 'error', message: 'Battle not found' });
      ws.battleId = battle.id;
      battle.spectators.push(ws);
      send(ws, { type: 'spectating', battleId: battle.id, battle: sanitizeBattle(battle) });
      return;
    }

    if (message.type === 'battle_move') {
      const battle = ws.battleId ? battles.get(ws.battleId) : null;
      if (!battle || battle.status !== 'live') return;
      battle.moveCount += 1;
      battle.spectators.forEach(spectator => {
        if (spectator !== ws) send(spectator, { type: 'battle_move', move: message.move, moveCount: battle.moveCount });
      });
      return;
    }

    if (message.type === 'chat') {
      const room = ws.roomId ? rooms.get(ws.roomId) : null;
      if (!room) return;
      broadcastToRoom(room.id, { type: 'chat', text: String(message.text || '').slice(0, 200), from: ws.id });
    }
  });

  ws.on('close', () => {
    if (ws.roomId) {
      const room = rooms.get(ws.roomId);
      if (room) {
        const isHost = ws.id === room.hostId;
        send(isHost ? room.guestWs : room.hostWs, { type: 'opponent_left' });
        room.status = 'finished';
      }
    }
    if (ws.battleId) {
      const battle = battles.get(ws.battleId);
      if (battle) battle.spectators = battle.spectators.filter(spectator => spectator !== ws);
    }
  });

  ws.on('error', error => console.error('[WS]', ws.id, error.message));
});

app.post('/api/rooms', (req, res) => {
  const id = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  const room = {
    id,
    game: req.body.game || 'chess',
    status: 'waiting',
    hostId: null,
    guestId: null,
    hostWs: null,
    guestWs: null,
    createdAt: Date.now(),
    wager: null,
  };
  rooms.set(id, room);
  res.json({
    roomId: id,
    url: `/games/arena.html?room=${id}`,
    rewardEligible: false,
    notice: 'Browser-hosted rooms are practice play and cannot trigger a payout.',
  });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  return res.json({
    id: room.id,
    game: room.game,
    status: room.status,
    players: Number(Boolean(room.hostId)) + Number(Boolean(room.guestId)),
    rewardEligible: false,
  });
});

app.post('/api/battles', (req, res) => {
  const { game, modelAName, modelBName } = req.body;
  if (!game || !modelAName || !modelBName) {
    return res.status(400).json({ error: 'game, modelAName, modelBName required' });
  }
  const battle = {
    id: uuidv4(),
    game,
    modelAName: String(modelAName).slice(0, 100),
    modelBName: String(modelBName).slice(0, 100),
    status: 'live',
    moveCount: 0,
    winner: null,
    spectators: [],
    createdAt: Date.now(),
    bettingOpen: false,
    rewardEligible: false,
    verificationStatus: 'browser-hosted-practice',
    poolA: 0,
    poolB: 0,
    poolDraw: 0,
  };
  battles.set(battle.id, battle);
  return res.status(201).json({
    ...sanitizeBattle(battle),
    notice: 'This browser-hosted battle is not eligible for betting or rewards.',
  });
});

app.get('/api/battles', (_req, res) => {
  res.json([...battles.values()].filter(battle => battle.status === 'live').map(sanitizeBattle));
});

app.get('/api/battles/:id', (req, res) => {
  const battle = battles.get(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle not found' });
  return res.json(sanitizeBattle(battle));
});

function resolveBets(battleId, winner) {
  const battle = battles.get(battleId);
  if (!battle) return;
  const pendingBets = [...bets.values()].filter((bet) => bet.battleId === battleId && bet.status === 'pending');
  const totalPool = battle.poolA + battle.poolB + battle.poolDraw;
  const winnerPool = winner === 'a' ? battle.poolA : winner === 'b' ? battle.poolB : battle.poolDraw;

  pendingBets.forEach((bet) => {
    const user = users.get(bet.userId);
    if (!user) return;
    if (winner === null) {
      bet.status = 'refunded';
      user.ggxBalance += bet.amount;
    } else if (bet.choice === winner) {
      bet.status = 'won';
      const share = winnerPool > 0 ? bet.amount / winnerPool : 1;
      user.ggxBalance += Math.floor(totalPool * 0.95 * share);
    } else {
      bet.status = 'lost';
    }
  });
}

// This endpoint settles play credits only. It never creates a real-value payout.
// A production result service must authenticate and server-verify the outcome before
// it creates a payout claim through /api/internal/payouts.
app.patch('/api/battles/:id/finish', (req, res) => {
  const battle = battles.get(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle not found' });
  const winner = req.body.winner;
  if (![null, 'a', 'b', 'draw'].includes(winner ?? null)) {
    return res.status(400).json({ error: 'winner must be "a", "b", "draw", or null' });
  }

  // This result is display-only. A browser report never settles a wager or reward.
  battle.status = 'finished';
  battle.winner = winner ?? null;
  battle.bettingOpen = false;
  refundPendingBets(battle.id);
  battle.spectators.forEach(socket => send(socket, {
    type: 'battle_over',
    battleId: battle.id,
    winner: battle.winner,
    settlement: 'none-browser-result-unverified',
  }));
  return res.json({
    ...sanitizeBattle(battle),
    settlement: 'none-browser-result-unverified',
  });
});

app.post('/api/bets', (_req, res) => {
  return res.status(409).json({
    error: 'unverified_wagering_disabled',
    message: 'Browser-hosted game results are not safe for real-value settlement. Use a server-verified reward program instead.',
  });
});

app.get('/api/bets/:userId', (req, res) => {
  const userBets = [...bets.values()].filter(bet => bet.userId === req.params.userId);
  res.json(userBets);
});

app.post('/api/users', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'valid email required' });
  const existing = [...users.values()].find(user => user.email === email);
  if (existing) {
    return res.json({ userId: existing.id, balance: existing.ggxBalance, balanceType: existing.balanceType });
  }
  const user = { id: uuidv4(), email, ggxBalance: 100, balanceType: 'practice', createdAt: Date.now() };
  users.set(user.id, user);
  return res.status(201).json({ userId: user.id, balance: user.ggxBalance, balanceType: user.balanceType });
});

app.get('/api/users/:id/balance', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ userId: user.id, balance: user.ggxBalance, balanceType: user.balanceType });
});

app.post('/api/create-payment-intent', async (req, res) => {
  const ggx = Number.parseInt(req.body.ggx, 10);
  const email = String(req.body.email || '').trim().toLowerCase();
  const amount = GGX_PACKAGES.get(ggx);
  if (!amount || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'Choose a valid GGX package and provide a valid email' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY in .env' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(usd * 100),
      currency: 'usd',
      metadata: { ggx: String(ggx), email, balanceType: 'utility' },
      receipt_email: email,
      description: `GoGames.XYZ — ${ggx} non-withdrawable utility GGX`,
      automatic_payment_methods: { enabled: true },
    });
    return res.json({ clientSecret: paymentIntent.client_secret, ggx, amount });
  } catch (error) {
    console.error('[Stripe]', error.message);
    return res.status(500).json({ error: 'Unable to create payment intent' });
  }
});

app.get('/api/leaderboard', (req, res) => {
  const game = req.query.game || 'all';
  const rankings = [
    { model: 'GPT-4o', wins: 47, losses: 12, draws: 5 },
    { model: 'Claude-3.5-Sonnet', wins: 43, losses: 15, draws: 8 },
    { model: 'Gemini-1.5-Pro', wins: 38, losses: 20, draws: 7 },
    { model: 'GPT-4o-mini', wins: 31, losses: 28, draws: 6 },
    { model: 'Llama-3.1-70B', wins: 29, losses: 32, draws: 4 },
    { model: 'Mistral-7B', wins: 18, losses: 44, draws: 3 },
    { model: 'GPT-3.5-Turbo', wins: 15, losses: 50, draws: 7 },
  ];
  res.json({ game, rankings, rewardEligible: false });
});

// Never expose backend source, persisted reward state, or deployment files.
app.use('/server', (_req, res) => res.sendStatus(404));
app.use('/.git', (_req, res) => res.sendStatus(404));
app.use(express.static(STATIC_DIR, { dotfiles: 'deny' }));
app.get('*', staticLimiter, (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

app.use((error, _req, res, _next) => {
  console.error('[HTTP]', error.message);
  res.status(500).json({ error: 'internal_server_error' });
});

server.listen(PORT, () => {
  const rewardStatus = rewardEngine.getStatus();
  console.log(`
┌──────────────────────────────────────────────────────────┐
│  GoGames.XYZ Server                                      │
│  http://localhost:${String(PORT).padEnd(39)}│
│  WebSocket: /ws                                          │
│  Browser wagering: disabled                              │
│  Rewards: ${`${rewardStatus.mode} (${rewardStatus.configured ? 'configured' : 'not configured'})`.padEnd(45)}│
│  Stripe: ${`${process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured'}`.padEnd(46)}│
└──────────────────────────────────────────────────────────┘
`);
});
