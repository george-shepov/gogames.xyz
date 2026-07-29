# Skyline Sprint Arcade, Generated Levels, and Reward Safety

## Purpose

Skyline Sprint: Neon Citadel adds a skill-based arcade lane to GoGames without making the browser authoritative for real-value rewards.

The current game can:

- run timed skill challenges;
- record local qualifier badges;
- emit a structured `ggx:arcade-qualifier` browser event;
- generate and save deterministic procedural sectors locally;
- request an AI-authored sector from a future backend endpoint;
- let the player create a free named sector from a numeric seed.

The current client does **not** issue, transfer, promise, or redeem real-value GGX rewards.

## Trust boundary

Anything running only in the browser is untrusted. Local storage, elapsed time, score, health, collected items, emitted events, and generated level data can all be altered by a player.

A real-value challenge must therefore be created and settled by a server-authoritative flow.

## Proposed challenge flow

1. The server creates a challenge with:
   - a unique challenge ID;
   - a signed level seed or immutable level hash;
   - difficulty and game-version identifiers;
   - start and expiration timestamps;
   - qualifying time, score, and damage thresholds;
   - eligibility and reward rules.
2. The client downloads the signed challenge and starts a fresh run.
3. The client records a compact input timeline and periodic state checkpoints.
4. The client submits the replay package, final state, and challenge signature.
5. The server re-simulates or validates the run against the exact game version and level hash.
6. Anti-cheat and eligibility checks run before any reward decision.
7. A successful settlement writes one idempotent reward transaction.

## Replay package

A submission should contain only the minimum required data:

```json
{
  "challengeId": "challenge_uuid",
  "game": "skyline-sprint",
  "gameVersion": "2026.07.28.1",
  "levelHash": "sha256:...",
  "difficulty": "Hard",
  "startedAt": "2026-07-28T20:00:00Z",
  "finishedAt": "2026-07-28T20:01:12Z",
  "inputs": [
    { "t": 0, "action": "right", "down": true },
    { "t": 622, "action": "jump", "down": true }
  ],
  "checkpoints": [
    { "t": 10000, "x": 410.2, "y": 318, "health": 84, "score": 450 }
  ],
  "final": {
    "elapsedMs": 72112,
    "score": 1850,
    "damageTaken": 16,
    "requiredCollected": 8
  },
  "challengeSignature": "..."
}
```

The server should reject:

- unknown or expired challenge IDs;
- reused challenge submissions;
- mismatched game versions or level hashes;
- impossible input rates or movement;
- checkpoint divergence beyond a small deterministic tolerance;
- unsigned client-selected reward terms;
- submissions from ineligible accounts or locations.

## Qualification versus reward

A **qualification** is a performance result. A **reward** is a separate server decision.

The browser may immediately display:

- personal bests;
- local badges;
- practice rankings clearly labeled as unverified;
- an indication that a run is eligible for submission.

Only the server may display a run as verified or create a real-value reward transaction.

## Eligibility and compliance gate

Before enabling anything redeemable or exchangeable, the platform should define and enforce:

- minimum age;
- permitted countries and states;
- official contest rules and entry method;
- whether purchase is required or prohibited;
- tax reporting obligations;
- identity verification where necessary;
- sanctions and fraud screening where applicable;
- responsible-play limits;
- dispute, cancellation, and refund procedures;
- retention and privacy rules for replay data.

A legal review is required before launching paid entry, wagering, chance-based prizes, transferable tokens, or cash-equivalent redemption.

## Reward ledger

Reward settlement should be idempotent and auditable.

Recommended fields:

- `transaction_id`;
- `challenge_id`;
- `submission_id`;
- `account_id`;
- `reward_type`;
- `amount`;
- `currency_or_token`;
- `status`;
- `rule_version`;
- `created_at`;
- `settled_at`;
- `reversal_transaction_id`.

The unique constraint should prevent more than one successful settlement for the same challenge submission.

## AI-authored sectors

Proposed endpoint:

```http
POST /api/arcade/skyline/levels/generate
Content-Type: application/json
```

Request:

```json
{
  "game": "skyline-sprint",
  "sector": 10,
  "difficulty": "Hard",
  "theme": "optional user prompt",
  "requestId": "idempotency_key"
}
```

Response must satisfy a validated schema containing:

- `name`, `seed`, and `sky`;
- `start` and `exit`;
- reachable `platforms`;
- valid `ladders` connecting the route;
- `cores`, `hazards`, and `enemies` within bounds;
- optional `override` and pressure configuration;
- a server-generated level hash and generator version.

The backend should run deterministic reachability and safety checks before returning a level. LLM output must never be sent directly to the game without schema validation and route verification.

## Free versus paid creation

Recommended model:

- **Free procedural sector:** deterministic local generation from a seed, unlimited, saved locally.
- **Community sector:** player names a seed-generated sector and can later submit it for moderation and sharing.
- **AI sector:** optional paid generation only after the backend estimates cost, receives explicit confirmation, uses an idempotency key, and returns a validated level.
- **Featured sector:** curated or community-voted content that is versioned and signed by the server.

A failed AI request must not charge the player. The client currently states this explicitly and falls back to free procedural generation.

## Cross-game portals

Portals can launch other GoGames titles and return a non-monetary in-run bonus. Future verified cross-game quests should use a server-issued quest token rather than trusting tab focus or local storage.

Example:

1. Skyline requests a short-lived quest token.
2. The destination game records the required achievement.
3. The server marks the quest complete.
4. Skyline redeems the token once for an in-game bonus.

## Rollout phases

### Phase 1 — included in this PR

- free arcade game;
- local autoplay and difficulty selection;
- deterministic endless sectors;
- local qualifier badges;
- disabled/untrusted reward hook;
- AI endpoint contract with graceful fallback.

### Phase 2 — server verification

- signed challenge seeds;
- replay capture and deterministic validation;
- verified leaderboards;
- account and eligibility checks.

### Phase 3 — limited rewards

- non-transferable promotional points or badges;
- fixed official challenge rules;
- fraud controls and settlement ledger;
- monitored pilot in permitted locations.

### Phase 4 — broader economy

Only after legal, payments, identity, tax, security, and responsible-play requirements are satisfied should GoGames consider paid AI sectors, entry fees, transferable tokens, or real-value prizes.
