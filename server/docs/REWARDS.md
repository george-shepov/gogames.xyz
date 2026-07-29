# Server-Verified Rewards

GoGames must never treat a score calculated in browser JavaScript as proof that a player earned a prize. Browser code, local storage, network requests, timers, and score fields can all be changed by the player.

This implementation creates a separate reward path with a fail-closed trust boundary:

1. An external authentication service issues a short-lived, HMAC-signed reward identity token.
2. A server-managed compliance profile must pass every configured check.
3. The server starts a registered game verifier and owns its challenge state.
4. The player submits only game inputs. The server calculates correctness, elapsed time, score, and qualification.
5. A single idempotent claim is created from the verified session.
6. Every qualifying claim requires manual approval.
7. In `live` mode, the server sends a signed, idempotent request to a separately configured payout service.

Browser-hosted multiplayer games and AI-vs-AI battles remain practice/entertainment experiences. Their reported result can be displayed, but it cannot settle a wager or reward.

## Modes

| Mode | Behavior |
|---|---|
| `off` | Reward sessions are unavailable. This is the default. |
| `review` | Server-verified sessions and claims are available, but payout dispatch is impossible. |
| `live` | Claims still require manual approval, then a signed payout webhook may be dispatched. |

The service refuses reward sessions when required configuration is missing. An empty jurisdiction list means nobody is eligible.

## First verifier: `math-sprint-v1`

The server generates each math problem, stores the correct answer privately, timestamps every submitted answer, enforces an integrity interval, and calculates the final score. The finish endpoint accepts no score field.

This proves the architecture without claiming that the existing arcade physics or browser score loops are reward-safe. Additional games must receive a dedicated server-authoritative verifier before they can be added to `supportedGames`.

## Identity token

Reward endpoints use:

```http
Authorization: Bearer <userId>.<expiresAtMs>.<hmacSha256>
```

The signature is HMAC SHA-256 over:

```text
<userId>.<expiresAtMs>
```

using `REWARDS_IDENTITY_SECRET`. Tokens are not issued by the public game server. They should be created by the authenticated account service only after login. The reward service also rejects tokens whose remaining lifetime exceeds `REWARDS_MAX_IDENTITY_TTL_MS`.

A Node service can issue a token with the exported helper:

```js
const { signRewardIdentity } = require('./reward-engine');

const token = signRewardIdentity(
  authenticatedUser.id,
  Date.now() + 15 * 60_000,
  process.env.REWARDS_IDENTITY_SECRET,
);
```

## Compliance profile

Only a server/admin integration may update compliance:

```http
PUT /api/rewards/admin/users/:userId/compliance
Authorization: Bearer <REWARDS_ADMIN_TOKEN>
Content-Type: application/json

{
  "ageVerified": true,
  "identityVerified": true,
  "sanctionsClear": true,
  "selfExcluded": false,
  "accountRestricted": false,
  "deviceRisk": "low",
  "country": "US",
  "region": "OH",
  "termsVersion": "2026-01",
  "termsAcceptedAt": "2026-07-28T18:00:00.000Z",
  "providerReference": "kyc_123"
}
```

The built-in gate checks:

- age verification
- identity verification
- sanctions clearance
- self-exclusion
- account restriction
- device/risk status
- exact terms version and acceptance time
- explicit country/region allowlist
- verified score threshold
- daily paid-reward cap

This is an engineering gate, not a legal opinion. A jurisdiction must not be allowlisted until counsel and the relevant compliance owners approve the reward structure, disclosures, tax handling, age rules, and any registration requirements.

## Player flow

Start a server-owned session:

```http
POST /api/rewards/sessions
Authorization: Bearer <reward-identity-token>
Content-Type: application/json

{ "gameId": "math-sprint-v1" }
```

Submit the answer to the currently issued question:

```http
POST /api/rewards/sessions/:sessionId/answers
Authorization: Bearer <reward-identity-token>
Content-Type: application/json

{ "answer": 42 }
```

After every question has been answered, finish the session:

```http
POST /api/rewards/sessions/:sessionId/finish
Authorization: Bearer <reward-identity-token>
Content-Type: application/json

{}
```

The server returns its score and one claim. Calling finish again returns the same claim; it cannot mint a duplicate.

## Manual review and payout

List pending claims:

```http
GET /api/rewards/admin/claims?status=pending_review
Authorization: Bearer <REWARDS_ADMIN_TOKEN>
```

Approve a claim in `live` mode:

```http
POST /api/rewards/admin/claims/:claimId/approve
Authorization: Bearer <REWARDS_ADMIN_TOKEN>
Content-Type: application/json

{ "reviewer": "compliance-operator-id" }
```

The payout request includes:

```http
Idempotency-Key: <claimId>
X-GoGames-Signature: sha256=<hex HMAC>
```

The signature is calculated over the exact raw JSON body using `REWARDS_PAYOUT_WEBHOOK_SECRET`. The payout provider must persist and honor the idempotency key. A retry after a network failure must return the original payout result rather than issuing a second reward.

## Persistence and audit

`REWARDS_DATA_FILE` stores sessions, compliance profiles, claims, and a hash-chained audit trail. Writes use a temporary file and atomic rename; the file and parent directory are created with restrictive permissions.

For higher volume or material reward value, replace the JSON store with a transactional database before launch. The engine API deliberately keeps persistence behind a small store boundary so that migration does not require putting browser scores back in the trust path.

## Safe rollout

1. Deploy with `REWARDS_MODE=off` and confirm `/api/rewards/status` reports `browserScoresAccepted: false`.
2. Configure durable storage, identity signing, the compliance provider, and secrets.
3. Switch to `review`; run internal sessions and inspect claims/audit records without paying anything.
4. Complete legal, security, fraud, tax, and payout-provider reviews.
5. Add only approved jurisdictions.
6. Configure an idempotent payout service and switch to `live`.
7. Keep manual approval until sufficient fraud data justifies a narrower automated policy.

## Explicit non-goals

- No cash or prize is awarded from local storage or a client score.
- No existing browser-hosted game is silently declared reward-safe.
- GGX utility-credit purchases do not create reward eligibility.
- A displayed AI battle winner does not settle anything of value.
- `review` mode cannot dispatch a payout.
