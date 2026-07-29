# GoGames.XYZ

**Play · Watch · Compete · Battle AI**

A web gaming platform with Chess, Checkers, Reversi, Tic-Tac-Toe, Snake, Math Raindrops, ChronoQuest, Battleship, FieldKit games, Spades Royale, multiplayer rooms, and AI-vs-AI exhibitions.

## Reward safety boundary

GoGames does **not** treat a browser-calculated score or browser-reported winner as prize-safe.

- Existing browser-hosted games, multiplayer rooms, and BYOK AI battles are practice/entertainment experiences.
- Their results may be displayed, but they cannot settle a wager or trigger a payout.
- Reward-bearing play must use a registered server-authoritative verifier.
- The first verifier, `math-sprint-v1`, generates questions and calculates score on the server.
- Identity, age, jurisdiction, sanctions, terms, self-exclusion, risk, score, limits, and manual review must all pass before a live payout request can be dispatched.
- Reward mode defaults to `off` and fails closed when configuration is incomplete.

See [`server/docs/REWARDS.md`](server/docs/REWARDS.md) for the trust model, API, rollout sequence, and payout-webhook contract.

## Features

| Feature | Description |
|---|---|
| 🎮 **Game library** | Board, arcade, brain-training, FieldKit, and card games |
| 🤖 **Bring Your Own AI** | Configure OpenAI-compatible model endpoints for exhibition battles |
| ⚔ **AI vs AI exhibitions** | Watch two models play with a move log and live stats |
| 👥 **Multiplayer** | Real-time WebSocket rooms with shareable links |
| 💎 **GGX utility credits** | Non-withdrawable platform credits for approved platform services |
| ✅ **Server-verified rewards** | Separate compliance-gated claim pipeline; never based on a client score |
| 💳 **Stripe payments** | Server-priced GGX utility-credit packages and verified webhooks |

## Quick start

```bash
cd server
npm install
cp .env.example .env
npm test
npm start
```

Open `http://localhost:3000`.

## Reward modes

```env
REWARDS_MODE=off
```

- `off`: no reward sessions
- `review`: verified sessions and claims, no payout dispatch
- `live`: manual approval plus a signed, idempotent payout webhook

Do not enable `review` or `live` until all required secrets, durable storage, identity integration, compliance profiles, and an explicit jurisdiction allowlist are configured. `live` additionally requires an HTTPS payout webhook.

## Server API highlights

### Practice multiplayer and AI battles

- `POST /api/rooms`
- `POST /api/battles`
- `PATCH /api/battles/:id/finish`

These endpoints return `rewardEligible: false`. Browser-reported battle results are display-only.

### Server-verified rewards

- `GET /api/rewards/status`
- `POST /api/rewards/sessions`
- `POST /api/rewards/sessions/:id/answers`
- `POST /api/rewards/sessions/:id/finish`
- `GET /api/rewards/claims`
- `PUT /api/rewards/admin/users/:userId/compliance`
- `GET /api/rewards/admin/claims`
- `POST /api/rewards/admin/claims/:id/approve`
- `POST /api/rewards/admin/claims/:id/reject`

Reward player endpoints require a short-lived server-signed identity token. Admin endpoints require `REWARDS_ADMIN_TOKEN`.

## Stripe setup

1. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
2. Register `https://your-domain/api/stripe-webhook` for `payment_intent.succeeded`.
3. The server selects the package price; it does not trust a browser-submitted USD amount.
4. Purchased GGX is labeled utility credit and is not reward eligibility, a cash balance, or a prize claim.

## File structure

```text
index.html
pay.html
games/
fieldkit/
server/
  server.js
  reward-engine.js
  package.json
  .env.example
  docs/REWARDS.md
  test/reward-engine.test.js
```

## Validation

```bash
cd server
npm run check
```

The reward tests cover signed identity, compliance rejection, server-owned scoring, answer-rate integrity, idempotent claim creation, refusal to accept browser scores, and idempotent payout dispatch.

## Deployment notes

- Store `REWARDS_DATA_FILE` outside the public repository tree, such as `/var/lib/gogames/rewards.json`.
- Keep reward, identity, admin, payout, and Stripe secrets server-side.
- The server blocks `/server` and dotfiles from static delivery.
- Replace the JSON reward store with a transactional database before material volume or reward value.
- Complete legal, security, fraud, tax, and payout-provider review before allowlisting a jurisdiction.

## Games credits

Games are also ported from [FieldKit](https://github.com/george-shepov/FieldKit), an offline-first collection of tools and games.

## License

MIT
