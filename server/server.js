'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const { createPayoutRouter } = require('./payouts');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, '..');

// In-memory stores are demo-only. Real-value rollout requires a transactional database.
const rooms = new Map();
const users = new Map();
const battles = new Map();
const bets = new Map();

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
  ? process.env.ALLOWED_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Admin-Key',
    'X-Compliance-Key',
    'X-Reviewer',
    'X-Service-Name',
    'X-Payout-Provider-Key',
  ],
}));

// Stripe requires the exact raw request body. This route must precede express.json().
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.sendStatus(200);

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch {
    return res.status(400).type('text/plain').send('Webhook signature verification failed');
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const ggx = Number.parseInt(intent.metadata.ggx, 10);
    const email = intent.metadata.email;
    if (email && Number.isSafeInteger(ggx) && ggx > 0) {
      let user = [...users.values()].find((candidate) => candidate.email === email);
      if (!user) {
        user = { id: uuidv4(), email, ggxBalance: 0, createdAt: Date.now() };
        users.set(user.id, user);
      }
      user.ggxBalance += ggx;
      console.log(`[GGX] Credited ${ggx} play credits to ${email} (balance: ${user.ggxBalance})`);
    }
  }

  return res.sendStatus(200);
});

app.use(express.json({ limit: '100kb' }));

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const paymentLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
const payoutLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const staticLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/create-payment-intent', paymentLimiter);
app.use('/api/internal/payouts', payoutLimiter);
app.use('/api/admin/payouts', payoutLimiter);
app.use(express.static(STATIC_DIR));

function send(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
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
    bettingOpen: battle.bettingOpen,
    poolA: battle.poolA,
    poolB: battle.poolB,
    poolDraw: battle.poolDraw,
  };
}

function broadcastToRoom(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return;
  [room.hostWs, room.guestWs].forEach((ws) => send(ws, message));
}

function handleJoin(ws, message) {
  const { room: roomId, role, game } = message;
  if (!roomId || !role) return;

  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      game: game || 'chess',
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
    send(ws, { type: 'joined', role: 'host', room: roomId, game: room.game });
    return;
  }
  if (role === 'guest' && !room.guestId && room.hostId) {
    room.guestId = ws.id;
    room.guestWs = ws;
    room.status = 'playing';
    send(ws, { type: 'joined', role: 'guest', room: roomId, game: room.game });
    send(room.hostWs, { type: 'opponent_joined', room: roomId });
    broadcastToRoom(roomId, { type: 'game_start', room: roomId, game: room.game });
    return;
  }
  send(ws, { type: 'error', message: 'Room full or invalid join' });
}

function handleMove(ws, message) {
  const room = ws.roomId ? rooms.get(ws.roomId) : null;
  if (!room || room.status !== 'playing') return;
  const isHost = ws.id === room.hostId;
  send(isHost ? room.guestWs : room.hostWs, {
    type: 'move',
    move: message.move,
    from: isHost ? 'host' : 'guest',
  });
}

function handleSpectate(ws, message) {
  const battle = message.battleId ? battles.get(message.battleId) : null;
  if (!battle) {
    send(ws, { type: 'error', message: 'Battle not found' });
    return;
  }
  ws.battleId = battle.id;
  battle.spectators.push(ws);
  send(ws, { type: 'spectating', battleId: battle.id, battle: sanitizeBattle(battle) });
}

function handleBattleMove(ws, message) {
  const battle = ws.battleId ? battles.get(ws.battleId) : null;
  if (!battle) return;
  battle.moveCount += 1;
  battle.spectators.forEach((spectator) => {
    if (spectator !== ws) send(spectator, { type: 'battle_move', move: message.move, moveCount: battle.moveCount });
  });
}

function handleChat(ws, message) {
  if (!ws.roomId || !rooms.has(ws.roomId)) return;
  broadcastToRoom(ws.roomId, {
    type: 'chat',
    text: String(message.text || '').slice(0, 200),
    from: ws.id,
  });
}

function cleanupConnection(ws) {
  if (ws.roomId) {
    const room = rooms.get(ws.roomId);
    if (room) {
      const opponent = ws.id === room.hostId ? room.guestWs : room.hostWs;
      send(opponent, { type: 'opponent_left' });
      room.status = 'finished';
    }
  }
  if (ws.battleId) {
    const battle = battles.get(ws.battleId);
    if (battle) battle.spectators = battle.spectators.filter((spectator) => spectator !== ws);
  }
}

wss.on('connection', (ws) => {
  ws.id = uuidv4();
  ws.roomId = null;
  ws.battleId = null;
  ws.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    switch (message.type) {
      case 'join': handleJoin(ws, message); break;
      case 'move': handleMove(ws, message); break;
      case 'spectate': handleSpectate(ws, message); break;
      case 'battle_move': handleBattleMove(ws, message); break;
      case 'chat': handleChat(ws, message); break;
      default: break;
    }
  });
  ws.on('close', () => cleanupConnection(ws));
  ws.on('error', (error) => console.error('[WS]', ws.id, error.message));
});

app.post('/api/rooms', (req, res) => {
  const { game, wager } = req.body;
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  rooms.set(id, {
    id,
    game: game || 'chess',
    status: 'waiting',
    hostId: null,
    guestId: null,
    hostWs: null,
    guestWs: null,
    createdAt: Date.now(),
    wager: wager || null,
  });
  res.json({ roomId: id, url: `/games/arena.html?room=${id}` });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  return res.json({
    id: room.id,
    game: room.game,
    status: room.status,
    players: Number(Boolean(room.hostId)) + Number(Boolean(room.guestId)),
  });
});

app.post('/api/battles', (req, res) => {
  const { game, modelAName, modelBName, bettingOpen } = req.body;
  if (!game || !modelAName || !modelBName) {
    return res.status(400).json({ error: 'game, modelAName, modelBName required' });
  }
  const battle = {
    id: uuidv4(),
    game,
    modelAName,
    modelBName,
    status: 'live',
    moveCount: 0,
    winner: null,
    spectators: [],
    createdAt: Date.now(),
    bettingOpen: Boolean(bettingOpen),
    poolA: 0,
    poolB: 0,
    poolDraw: 0,
  };
  battles.set(battle.id, battle);
  return res.status(201).json(sanitizeBattle(battle));
});

app.get('/api/battles', (_req, res) => {
  res.json([...battles.values()].filter((battle) => battle.status === 'live').map(sanitizeBattle));
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
  const { winner } = req.body;
  if (![null, 'a', 'b', 'draw'].includes(winner ?? null)) {
    return res.status(400).json({ error: 'winner must be a, b, draw, or null' });
  }
  battle.status = 'finished';
  battle.winner = winner ?? null;
  battle.bettingOpen = false;
  resolveBets(battle.id, battle.winner);
  battle.spectators.forEach((ws) => send(ws, { type: 'battle_over', battleId: battle.id, winner: battle.winner }));
  return res.json(sanitizeBattle(battle));
});

app.post('/api/bets', (req, res) => {
  const { battleId, userId, choice, amount } = req.body;
  if (!battleId || !userId || !choice || !Number.isSafeInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'battleId, userId, choice, and positive integer amount required' });
  }
  if (!['a', 'b', 'draw'].includes(choice)) {
    return res.status(400).json({ error: 'choice must be a, b, or draw' });
  }
  const battle = battles.get(battleId);
  if (!battle || !battle.bettingOpen || battle.status !== 'live') {
    return res.status(400).json({ error: 'Battle not found or betting closed' });
  }
  const user = users.get(userId);
  if (!user || user.ggxBalance < amount) {
    return res.status(400).json({ error: 'Insufficient GGX play-credit balance' });
  }

  user.ggxBalance -= amount;
  if (choice === 'a') battle.poolA += amount;
  else if (choice === 'b') battle.poolB += amount;
  else battle.poolDraw += amount;

  const bet = { id: uuidv4(), battleId, userId, choice, amount, status: 'pending' };
  bets.set(bet.id, bet);
  return res.status(201).json({ betId: bet.id, balance: user.ggxBalance });
});

app.get('/api/bets/:userId', (req, res) => {
  res.json([...bets.values()].filter((bet) => bet.userId === req.params.userId));
});

app.post('/api/users', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  const existing = [...users.values()].find((user) => user.email === email);
  if (existing) return res.json({ userId: existing.id, balance: existing.ggxBalance });
  const user = { id: uuidv4(), email, ggxBalance: 100, createdAt: Date.now() };
  users.set(user.id, user);
  return res.status(201).json({ userId: user.id, balance: user.ggxBalance });
});

app.get('/api/users/:id/balance', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ userId: user.id, balance: user.ggxBalance });
});

app.post('/api/create-payment-intent', async (req, res) => {
  const { ggx, usd, email } = req.body;
  if (!Number.isSafeInteger(ggx) || ggx <= 0 || !Number.isFinite(usd) || usd <= 0 || !email) {
    return res.status(400).json({ error: 'positive integer ggx, positive usd, and email required' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY in .env' });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(usd * 100),
      currency: 'usd',
      metadata: { ggx: String(ggx), email: String(email).trim().toLowerCase() },
      receipt_email: email,
      description: `GoGames.XYZ — ${ggx} GGX play credits`,
    });
    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('[Stripe]', error.message);
    return res.status(500).json({ error: 'Unable to create payment intent' });
  }
});

const { router: payoutRouter, store: payoutStore } = createPayoutRouter();
app.use(payoutRouter);

app.get('/api/leaderboard', (req, res) => {
  const game = req.query.game || 'all';
  res.json({
    game,
    rankings: [
      { model: 'GPT-4o', wins: 47, losses: 12, draws: 5 },
      { model: 'Claude-3.5-Sonnet', wins: 43, losses: 15, draws: 8 },
      { model: 'Gemini-1.5-Pro', wins: 38, losses: 20, draws: 7 },
      { model: 'GPT-4o-mini', wins: 31, losses: 28, draws: 6 },
      { model: 'Llama-3.1-70B', wins: 29, losses: 32, draws: 4 },
      { model: 'Mistral-7B', wins: 18, losses: 44, draws: 3 },
      { model: 'GPT-3.5-Turbo', wins: 15, losses: 50, draws: 7 },
    ],
  });
});

app.use((error, _req, res, _next) => {
  const status = Number(error.statusCode) || 500;
  if (status >= 500) console.error('[API]', error);
  const body = { error: status >= 500 ? 'Internal server error' : error.message };
  if (error.details && status < 500) body.details = error.details;
  res.status(status).json(body);
});

app.get('*', staticLimiter, (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`GoGames.XYZ listening on http://localhost:${PORT}`);
    console.log(`Real-value payouts: ${process.env.REAL_VALUE_PAYOUTS_ENABLED === 'true' ? 'ENABLED' : 'disabled (safe default)'}`);
  });
}

module.exports = {
  app,
  server,
  stores: { rooms, users, battles, bets, payouts: payoutStore },
};
