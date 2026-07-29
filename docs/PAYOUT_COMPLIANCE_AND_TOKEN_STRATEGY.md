# GoGames real-reward payout gate and token strategy

## Decision

GoGames must keep three balances separate:

1. **GGX play credits** — game-only credits. They are not transferable, redeemable, or represented as money.
2. **Reward claims** — a server-created claim denominated in USD minor units. A browser score can never create one directly.
3. **Approved payouts** — an external payout, initially recommended as USDC on Base or Solana, dispatched only after all checks pass for that exact claim.

Do not launch a publicly tradable GGX token in the first real-reward release. Creating a token is technically cheap; creating durable value is not. Value requires funded redemption, real utility that buyers voluntarily pay for, or supplied market liquidity. Each creates legal, treasury, accounting, fraud, and consumer-protection obligations.

## Fail-closed state machine

```text
server-verified reward event
          |
          v
      payout claim
       (blocked)
          |
          +-- identity -------- pass / fail / pending
          +-- age ------------- pass / fail / pending
          +-- jurisdiction ---- pass / fail / pending
          +-- sanctions ------- pass / fail / pending
          +-- terms ----------- pass / fail / pending
          +-- self-exclusion -- pass / fail / pending
          +-- limits ---------- pass / fail / pending
          |
          v
   human review allowed
   only after all seven pass
          |
          +-- reject ----------> rejected
          |
          +-- approve ---------> approved
                                  |
                         re-check all eight
                                  |
                           provider dispatch
                                  |
                                paid
```

The service treats pending, failed, missing, malformed, or expired evidence as a block. Updating any automated check invalidates a prior manual approval.

## Security boundaries implemented in this PR

- Only a trusted internal service with `X-Compliance-Key` can create payout claims or record automated decisions.
- The public browser cannot create a payout claim from a score.
- Manual approval uses a different `X-Admin-Key` and cannot be written through the compliance API.
- Provider completion uses a third `X-Payout-Provider-Key`; the compliance service cannot mark a payout paid.
- Each payout has its own eight-check record; approval is never inherited from another payout.
- All amounts use integer USD minor units.
- Idempotency prevents duplicate claims from the same reward event.
- Public claim status uses a one-time opaque bearer token and masks the destination.
- Admin responses may show evidence references, but raw identity documents should remain with the verification provider.
- The dispatch endpoint re-checks every requirement immediately before changing state.
- `REAL_VALUE_PAYOUTS_ENABLED=false` is the default.
- No wallet private key, blockchain signer, or automatic transfer code is included.

## API workflow

### 1. Trusted reward service creates a claim

```bash
curl -X POST https://gogames.xyz/api/internal/payouts \
  -H 'Content-Type: application/json' \
  -H 'X-Compliance-Key: ...' \
  -H 'X-Service-Name: verified-results-service' \
  -d '{
    "userId": "user-123",
    "sourceEventId": "match-result-456",
    "amountMinor": 500,
    "asset": "USDC",
    "network": "base",
    "destination": "0x...",
    "idempotencyKey": "match-result-456:reward-1"
  }'
```

The response contains the payout ID and a claim-status token. The token is returned only on first creation.

### 2. Compliance workers record each automated result

```bash
curl -X PUT https://gogames.xyz/api/internal/payouts/PAYOUT_ID/checks/sanctions \
  -H 'Content-Type: application/json' \
  -H 'X-Compliance-Key: ...' \
  -H 'X-Service-Name: sanctions-screening' \
  -d '{
    "status": "pass",
    "provider": "provider-name",
    "evidenceRef": "provider-case-id",
    "expiresAt": "2026-07-29T04:00:00.000Z"
  }'
```

Repeat for `identity`, `age`, `jurisdiction`, `sanctions`, `terms`, `selfExclusion`, and `limits`.

A useful evidence contract is:

- `identity`: verification case ID and verification level
- `age`: date-of-birth verification reference and required age threshold
- `jurisdiction`: country/state, IP/device location evidence, and rule-set version
- `sanctions`: screening case ID, list versions, and expiration
- `terms`: exact accepted terms/reward-rules version and timestamp
- `selfExclusion`: statewide/provider/house-list decision and expiration
- `limits`: amount-specific daily, weekly, monthly, velocity, and source-of-funds decision

### 3. Human reviewer approves or rejects

Open `/admin/payout-approvals.html`. The page does not store the admin key in local storage.

Approval is rejected by the API until all seven automated checks pass and remain unexpired.

### 4. Dispatch remains disabled

Even an approved payout receives HTTP 503 from the dispatch endpoint while `REAL_VALUE_PAYOUTS_ENABLED=false` or `PAYOUT_PROVIDER_MODE` is not `external`.

Before enabling it, replace the in-memory store with a transactional database and integrate a licensed/custodial payout provider. The provider should receive an immutable payout instruction and return a unique provider reference. A separate signed provider webhook or worker authenticated with `X-Payout-Provider-Key` should mark the payout paid.

## Recommended token/payment approach

### Recommended first release: USDC payout, no custom tradable token

Use the internal reward-claim ledger for accounting and pay approved claims in **USDC on Base or Solana**.

- **Base** fits the existing JavaScript/EVM ecosystem and standard ERC-20 tooling.
- **Solana** generally offers very low transaction fees and mature SPL-token tooling.
- Using an existing stablecoin avoids inventing a market price, but GoGames still must fund every payout and handle custody, compliance, accounting, tax reporting, and network fees.

The player-facing promise should be a funded reward amount, not “GGX will become valuable.”

### How authors can create rewards without paying upfront

A game author can create a reward campaign at no charge only when another source funds the reward pool. Examples:

- platform-funded launch budget;
- sponsor-funded tournaments;
- ad revenue allocated to verified wins;
- subscription revenue allocated to a monthly reward pool;
- platform fees from non-reward products;
- a capped promotional budget with no purchase necessary, if structured and reviewed as a lawful promotion.

The campaign service must reserve the funded amount before advertising the prize. Do not promise unfunded rewards.

### Later option: custom GGX asset

Only consider an on-chain GGX asset after counsel and licensing review. The safer design would be transfer-restricted and allowlisted, with mint/burn controlled by a custody service and redemption limited to approved users. A freely tradable speculative token is the highest-risk option and is not recommended for the initial product.

## Production requirements not solved by this scaffold

This PR creates the approval boundary and safe default, not legal authorization to operate real-money gaming.

Before real payouts:

- server-authoritative game results, anti-cheat, replay verification, and fraud scoring;
- authenticated users and service-to-service identities;
- PostgreSQL tables, transactions, row locks, unique idempotency constraints, and an append-only audit log;
- KYC/age vendor integration and secure PII retention policy;
- sanctions screening with ongoing re-screening;
- state/country geolocation and rule engine;
- self-exclusion integration plus a GoGames house exclusion list;
- deposit, wager, loss, time, velocity, and payout limits;
- responsible-gaming controls and cooling-off periods;
- licensed legal review for each operating jurisdiction;
- money-transmission, AML, tax, sweepstakes/contest, gambling, and securities analysis;
- funded reserve, reconciliation, chargeback handling, and incident response;
- custody/provider integration with no private keys in application environment variables;
- monitoring that pages an operator on duplicate, stuck, reversed, or anomalous payouts.

## Tests

```bash
cd server
npm test
```

The test suite verifies blocked-by-default behavior, all-check approval, self-exclusion blocking, approval invalidation, expired-check dispatch blocking, idempotency, manual-approval separation, and integer amount validation.
