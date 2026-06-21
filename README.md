# GoGames.XYZ

**Play · Watch · Bet · Battle AI**

A full-featured web gaming platform with Chess, Checkers, Reversi, Tic-Tac-Toe (10×10), Snake, Math Raindrops, and Battleship — plus an AI Battle Arena where you bring your own model.

## Features

| Feature | Description |
|---------|-------------|
| 🎮 **7 Games** | Chess, Checkers, Reversi, 10×10 Tic-Tac-Toe, Snake, Math Raindrops, Battleship |
| 🤖 **Bring Your Own AI** | Configure any OpenAI-compatible API (GPT-4o, Claude, Gemini, Llama, custom) with API key, URL, model params, and system prompt |
| ⚔ **AI vs AI Battles** | Watch two AI models battle live, with move log and real-time stats |
| 👥 **Multiplayer** | Real-time human vs human via WebSocket rooms with shareable links |
| 👁 **Spectate & Bet** | Join live games as a spectator and wager GGX tokens on the outcome |
| 💎 **GGX Token** | Platform currency — buy via Stripe, earn by winning and betting correctly |
| 💳 **Stripe Payments** | Secure checkout for GGX token bundles (100 / 500 / 2000 / 5000 GGX) |

## Quick Start

### 1. Clone & Install

```bash
cd server
npm install
```

### 2. Configure

```bash
cp server/.env.example server/.env
# Edit server/.env — add your Stripe keys
```

### 3. Run

```bash
cd server
npm start
# Server running at http://localhost:3000
```

Then open `http://localhost:3000` in your browser.

## File Structure

```
index.html               ← Main landing / lobby page
games/
  arena.html             ← Chess + Checkers + Reversi (AI battle config included)
  tictactoe.html         ← 10×10 Tic-Tac-Toe, 5-in-a-row
  snake.html             ← Classic Snake
  math-raindrops.html    ← Math Raindrops brain training
  battleship.html        ← Battleship vs AI
ai-arena.html            ← Bring-your-own-model AI battle arena
pay.html                 ← GGX token purchase (Stripe)
server/
  server.js              ← Node.js + Express + WebSocket backend
  package.json
  .env.example           ← Copy to .env and fill in keys
```

## AI Arena — Bring Your Own Model

The AI Arena (`/ai-arena.html`) lets you:

1. Configure **two AI models** with your own API keys (any OpenAI-compatible endpoint)
2. Select a game: Chess, Checkers, Reversi, or 10×10 Tic-Tac-Toe
3. Set move delay, max moves, temperature, and system prompts
4. Watch the battle live with a move log and response-time stats
5. Allow spectators to **bet GGX tokens** on the outcome

Supported model providers:
- OpenAI (GPT-4o, GPT-4o-mini, GPT-3.5-turbo, etc.)
- Anthropic (Claude via OpenAI-compatible proxy)
- Google (Gemini via Vertex AI proxy)
- Ollama (local models at `http://localhost:11434/v1`)
- Any OpenAI-compatible endpoint

## Stripe Setup

1. Create a [Stripe account](https://stripe.com)
2. Get your API keys from the Stripe Dashboard
3. Add them to `server/.env`:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Add the webhook endpoint in Stripe Dashboard → Webhooks:
   - URL: `https://yourdomain.com/api/stripe-webhook`
   - Events: `payment_intent.succeeded`

## Deployment (VPS)

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Start server
cd /path/to/gogames.xyz/server
npm install
cp .env.example .env  # fill in your keys
pm2 start server.js --name gogames

# Set up Nginx reverse proxy (example)
# proxy_pass http://localhost:3000;
```

## Games Credits

Games ported from [FieldKit](https://github.com/george-shepov/FieldKit) — a collection of offline-safe progressive web apps.

## License

MIT
