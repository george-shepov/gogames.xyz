'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, '..');

// ────────────────────────────────────────────────────────────
// MIDDLEWARE
// ────────────────────────────────────────────────────────────

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
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const payLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/api/create-payment-intent', payLimiter);

// Serve static files from repo root
app.use(express.static(STATIC_DIR));

// ────────────────────────────────────────────────────────────
// IN-MEMORY STORES (replace with DB for production)
// ────────────────────────────────────────────────────────────

/** @type {Map<string, Room>} */
const rooms = new Map();

/** @type {Map<string, UserAccount>} */
const users = new Map();

/** @type {Map<string, Battle>} */
const battles = new Map();

/** @type {Map<string, Bet>} */
const bets = new Map();

/**
 * @typedef {Object} Room
 * @property {string} id
 * @property {string} game - 'chess'|'checkers'|'reversi'|'tictactoe'
 * @property {'waiting'|'playing'|'finished'} status
 * @property {string|null} hostId
 * @property {string|null} guestId
 * @property {WebSocket|null} hostWs
 * @property {WebSocket|null} guestWs
 * @property {number} createdAt
 * @property {number|null} wager - GGX wager amount (null = no wager)
 */

/**
 * @typedef {Object} Battle
 * @property {string} id
 * @property {string} game
 * @property {string} modelAName
 * @property {string} modelBName
 * @property {'live'|'finished'|'cancelled'} status
 * @property {number} moveCount
 * @property {string|null} winner - 'a'|'b'|'draw'|null
 * @property {WebSocket[]} spectators
 * @property {number} createdAt
 * @property {boolean} bettingOpen
 * @property {number} poolA
 * @property {number} poolB
 * @property {number} poolDraw
 */

/**
 * @typedef {Object} Bet
 * @property {string} id
 * @property {string} battleId
 * @property {string} userId
 * @property {'a'|'b'|'draw'} choice
 * @property {number} amount
 * @property {'pending'|'won'|'lost'|'refunded'} status
 */

/**
 * @typedef {Object} UserAccount
 * @property {string} id
 * @property {string} email
 * @property {number} ggxBalance
 * @property {number} createdAt
 */

// ────────────────────────────────────────────────────────────
// WEBSOCKET — MULTIPLAYER ROOMS
// ────────────────────────────────────────────────────────────

wss.on('connection', (ws) => {
  ws.id = uuidv4();
  ws.roomId = null;
  ws.battleId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.type) {
      case 'join':       handleJoin(ws, msg); break;
      case 'move':       handleMove(ws, msg); break;
      case 'spectate':   handleSpectate(ws, msg); break;
      case 'battle_move':handleBattleMove(ws, msg); break;
      case 'chat':       handleChat(ws, msg); break;
      default: break;
    }
  });

  ws.on('close', () => {
    cleanupConnection(ws);
  });

  ws.on('error', (err) => {
    console.error('[WS] error on', ws.id, err.message);
  });
});

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function handleJoin(ws, msg) {
  const { room: roomId, role, game } = msg;
  if (!roomId || !role) return;

  let room = rooms.get(roomId);
  if (!room) {
    // Create new room
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
  } else if (role === 'guest' && !room.guestId && room.hostId) {
    room.guestId = ws.id;
    room.guestWs = ws;
    room.status = 'playing';
    send(ws, { type: 'joined', role: 'guest', room: roomId, game: room.game });
    send(room.hostWs, { type: 'opponent_joined', room: roomId });
    broadcastToRoom(roomId, { type: 'game_start', room: roomId, game: room.game });
  } else {
    send(ws, { type: 'error', message: 'Room full or invalid join' });
  }
}

function handleMove(ws, msg) {
  const room = ws.roomId ? rooms.get(ws.roomId) : null;
  if (!room || room.status !== 'playing') return;
  // Relay move to opponent
  const isHost = ws.id === room.hostId;
  const opponent = isHost ? room.guestWs : room.hostWs;
  if (opponent) {
    send(opponent, { type: 'move', move: msg.move, from: isHost ? 'host' : 'guest' });
  }
}

function handleSpectate(ws, msg) {
  const { battleId } = msg;
  if (!battleId) return;
  const battle = battles.get(battleId);
  if (!battle) { send(ws, { type: 'error', message: 'Battle not found' }); return; }
  ws.battleId = battleId;
  battle.spectators.push(ws);
  send(ws, { type: 'spectating', battleId, battle: sanitizeBattle(battle) });
}

function handleBattleMove(ws, msg) {
  const battle = ws.battleId ? battles.get(ws.battleId) : null;
  if (!battle) return;
  battle.moveCount = (battle.moveCount || 0) + 1;
  // Broadcast to all spectators
  battle.spectators.forEach(sw => {
    if (sw !== ws) send(sw, { type: 'battle_move', move: msg.move, moveCount: battle.moveCount });
  });
}

function handleChat(ws, msg) {
  const room = ws.roomId ? rooms.get(ws.roomId) : null;
  if (!room) return;
  broadcastToRoom(ws.roomId, { type: 'chat', text: (msg.text || '').slice(0, 200), from: ws.id });
}

function broadcastToRoom(roomId, obj) {
  const room = rooms.get(roomId);
  if (!room) return;
  [room.hostWs, room.guestWs].forEach(ws => { if (ws) send(ws, obj); });
}

function cleanupConnection(ws) {
  if (ws.roomId) {
    const room = rooms.get(ws.roomId);
    if (room) {
      const isHost = ws.id === room.hostId;
      const opponent = isHost ? room.guestWs : room.hostWs;
      if (opponent) send(opponent, { type: 'opponent_left' });
      room.status = 'finished';
    }
  }
  if (ws.battleId) {
    const battle = battles.get(ws.battleId);
    if (battle) {
      battle.spectators = battle.spectators.filter(s => s !== ws);
    }
  }
}

function sanitizeBattle(b) {
  return { id: b.id, game: b.game, modelAName: b.modelAName, modelBName: b.modelBName,
           status: b.status, moveCount: b.moveCount, winner: b.winner,
           spectatorCount: b.spectators.length, bettingOpen: b.bettingOpen,
           poolA: b.poolA, poolB: b.poolB, poolDraw: b.poolDraw };
}

// ────────────────────────────────────────────────────────────
// REST API — ROOMS
// ────────────────────────────────────────────────────────────

app.post('/api/rooms', (req, res) => {
  const { game, wager } = req.body;
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  const room = { id, game: game || 'chess', status: 'waiting', hostId: null, guestId: null,
                 hostWs: null, guestWs: null, createdAt: Date.now(), wager: wager || null };
  rooms.set(id, room);
  res.json({ roomId: id, url: `/games/arena.html?room=${id}` });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ id: room.id, game: room.game, status: room.status,
             players: (room.hostId ? 1 : 0) + (room.guestId ? 1 : 0) });
});

// ────────────────────────────────────────────────────────────
// REST API — BATTLES (AI vs AI)
// ────────────────────────────────────────────────────────────

app.post('/api/battles', (req, res) => {
  const { game, modelAName, modelBName, bettingOpen } = req.body;
  if (!game || !modelAName || !modelBName) {
    return res.status(400).json({ error: 'game, modelAName, modelBName required' });
  }
  const id = uuidv4();
  const battle = { id, game, modelAName, modelBName, status: 'live',
                   moveCount: 0, winner: null, spectators: [],
                   createdAt: Date.now(), bettingOpen: !!bettingOpen,
                   poolA: 0, poolB: 0, poolDraw: 0 };
  battles.set(id, battle);
  res.json(sanitizeBattle(battle));
});

app.get('/api/battles', (req, res) => {
  const live = [...battles.values()]
    .filter(b => b.status === 'live')
    .map(sanitizeBattle);
  res.json(live);
});

app.get('/api/battles/:id', (req, res) => {
  const battle = battles.get(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle not found' });
  res.json(sanitizeBattle(battle));
});

app.patch('/api/battles/:id/finish', (req, res) => {
  const battle = battles.get(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle not found' });
  const { winner } = req.body; // 'a' | 'b' | 'draw'
  battle.status = 'finished';
  battle.winner = winner || null;
  // Resolve bets
  resolveBets(req.params.id, winner);
  // Notify spectators
  battle.spectators.forEach(ws => send(ws, { type: 'battle_over', battleId: battle.id, winner }));
  res.json(sanitizeBattle(battle));
});

// ────────────────────────────────────────────────────────────
// REST API — BETTING
// ────────────────────────────────────────────────────────────

app.post('/api/bets', (req, res) => {
  const { battleId, userId, choice, amount } = req.body;
  if (!battleId || !userId || !choice || !amount) {
    return res.status(400).json({ error: 'battleId, userId, choice, amount required' });
  }
  if (!['a','b','draw'].includes(choice)) {
    return res.status(400).json({ error: 'choice must be a, b, or draw' });
  }
  const battle = battles.get(battleId);
  if (!battle || !battle.bettingOpen) {
    return res.status(400).json({ error: 'Battle not found or betting closed' });
  }
  const user = users.get(userId);
  if (!user || user.ggxBalance < amount) {
    return res.status(400).json({ error: 'Insufficient GGX balance' });
  }
  // Deduct balance
  user.ggxBalance -= amount;
  // Add to pool
  if (choice === 'a') battle.poolA += amount;
  else if (choice === 'b') battle.poolB += amount;
  else battle.poolDraw += amount;
  // Record bet
  const bet = { id: uuidv4(), battleId, userId, choice, amount, status: 'pending' };
  bets.set(bet.id, bet);
  res.json({ betId: bet.id, balance: user.ggxBalance });
});

app.get('/api/bets/:userId', (req, res) => {
  const userBets = [...bets.values()].filter(b => b.userId === req.params.userId);
  res.json(userBets);
});

function resolveBets(battleId, winner) {
  const battleBets = [...bets.values()].filter(b => b.battleId === battleId && b.status === 'pending');
  const battle = battles.get(battleId);
  if (!battle) return;
  const totalPool = battle.poolA + battle.poolB + battle.poolDraw;
  const winnerPool = winner === 'a' ? battle.poolA : winner === 'b' ? battle.poolB : battle.poolDraw;
  battleBets.forEach(bet => {
    const user = users.get(bet.userId);
    if (!user) return;
    if (winner === null) {
      // Refund
      bet.status = 'refunded';
      user.ggxBalance += bet.amount;
    } else if (bet.choice === winner) {
      // Win: proportional share of total pool minus 5% platform fee
      bet.status = 'won';
      const share = winnerPool > 0 ? (bet.amount / winnerPool) : 1;
      const winnings = Math.floor((totalPool * 0.95) * share);
      user.ggxBalance += winnings;
    } else {
      bet.status = 'lost';
    }
  });
}

// ────────────────────────────────────────────────────────────
// REST API — USERS & GGX
// ────────────────────────────────────────────────────────────

app.post('/api/users', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  // Check if exists
  const existing = [...users.values()].find(u => u.email === email);
  if (existing) return res.json({ userId: existing.id, balance: existing.ggxBalance });
  const user = { id: uuidv4(), email, ggxBalance: 100, createdAt: Date.now() };
  users.set(user.id, user);
  res.status(201).json({ userId: user.id, balance: user.ggxBalance });
});

app.get('/api/users/:id/balance', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ userId: user.id, balance: user.ggxBalance });
});

// ────────────────────────────────────────────────────────────
// REST API — STRIPE PAYMENTS
// ────────────────────────────────────────────────────────────

app.post('/api/create-payment-intent', async (req, res) => {
  const { ggx, usd, email } = req.body;
  if (!ggx || !usd || !email) {
    return res.status(400).json({ error: 'ggx, usd, email required' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY in .env' });
  }
  try {
    const amount = Math.round(usd * 100); // cents
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: { ggx: String(ggx), email },
      receipt_email: email,
      description: `GoGames.XYZ — ${ggx} GGX tokens`,
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[Stripe]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook — fulfill GGX after successful payment
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.sendStatus(200); // skip in dev

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const ggx = parseInt(intent.metadata.ggx, 10);
    const email = intent.metadata.email;
    if (email && ggx > 0) {
      let user = [...users.values()].find(u => u.email === email);
      if (!user) {
        user = { id: uuidv4(), email, ggxBalance: 0, createdAt: Date.now() };
        users.set(user.id, user);
      }
      user.ggxBalance += ggx;
      console.log(`[GGX] Credited ${ggx} GGX to ${email} (balance: ${user.ggxBalance})`);
    }
  }

  res.sendStatus(200);
});

// ────────────────────────────────────────────────────────────
// LEADERBOARD
// ────────────────────────────────────────────────────────────

app.get('/api/leaderboard', (req, res) => {
  const game = req.query.game || 'all';
  // In production: query a real DB. For now return static data.
  const data = [
    { model: 'GPT-4o',              wins: 47, losses: 12, draws: 5  },
    { model: 'Claude-3.5-Sonnet',   wins: 43, losses: 15, draws: 8  },
    { model: 'Gemini-1.5-Pro',      wins: 38, losses: 20, draws: 7  },
    { model: 'GPT-4o-mini',         wins: 31, losses: 28, draws: 6  },
    { model: 'Llama-3.1-70B',       wins: 29, losses: 32, draws: 4  },
    { model: 'Mistral-7B',          wins: 18, losses: 44, draws: 3  },
    { model: 'GPT-3.5-Turbo',       wins: 15, losses: 50, draws: 7  },
  ];
  res.json({ game, rankings: data });
});

// ────────────────────────────────────────────────────────────
// SPA FALLBACK — serve index.html for unknown routes
// ────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// ────────────────────────────────────────────────────────────
// START
// ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`
┌─────────────────────────────────────────────┐
│  GoGames.XYZ Server                         │
│  http://localhost:${PORT}                       │
│                                             │
│  WebSocket:  ws://localhost:${PORT}/ws          │
│  Static:     ${STATIC_DIR.slice(-30).padEnd(30)} │
│  Stripe:     ${process.env.STRIPE_SECRET_KEY ? '✅ configured' : '⚠  not configured (set STRIPE_SECRET_KEY)'}  │
└─────────────────────────────────────────────┘
`);
});

module.exports = { app, server };
