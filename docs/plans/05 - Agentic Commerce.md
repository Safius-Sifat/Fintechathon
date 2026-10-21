# 05 – Agentic Commerce: chat shopping with x402

Status: proposed, 2026-10-21. Owner sign-off needed before work starts (it crosses Person 1, 2 and 4 areas).

## Goal

You tell the agent in the app "buy me running shoes under 25 USDC". The agent searches a shop and shows you options in the chat. You pick one, confirm the price and delivery address on a sheet, and hold to sign. The agent wallet then pays the shop with a real x402 USDC payment on Base Sepolia, and the shop returns a signed order receipt. You can stop the agent at any moment.

Real, end to end:
- the conversation, driven by an OpenAI model through the OpenAI Agents SDK;
- the agent wallet, its limits and the owner's signatures;
- the MPC-signed x402 authorization and its on-chain USDC settlement;
- the shop's 402 quote and signed order receipt;
- the evidence bundle the verifier checks.

Not real: the shop. It is our own demo merchant with sample products, and no goods ship. The app says so on every receipt.

## What we found

### Products we compared

- **Cobo Agentic Wallet** ([product page](https://www.cobo.com/agentic-wallet), [The Block](https://www.theblock.co/post/397856/cobo-launches-agentic-wallet)):
  - The user approves a scoped "Pact" (limits, allowlists, approval rules) instead of handing the agent a key.
  - MPC signing.
  - Blocked actions return a structured reason to the agent.
  - An audit trail of pending, approved and denied actions.
  - Mandate already has the same parts: Permit and WalletPolicy, MPC executor, refusals with reasons, and the evidence log.
- **Circle**:
  - [Autonomous payments with Circle Wallets, USDC and x402](https://www.circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402) shows an agent paying a data API with x402.
  - We use Circle test USDC as an ordinary token.
  - AGENTS.md forbids Circle wallets, custody or signing, so Circle is a UX and protocol reference only.
- **x402**:
  - The public testnet facilitator `https://x402.org/facilitator` answers `/supported` with `exact` on `eip155:84532` (Base Sepolia) for x402 v1 and v2. We checked this live on 2026-10-21.
  - The [Bazaar](https://docs.x402.org/extensions/bazaar) discovery list on the CDP facilitator holds about 500 paid services, but only 4 accept Base Sepolia, and those are hobby endpoints. So the demo needs its own merchant.

### What Mandate already has

- **The contract can pay x402.**
  - `MandateWallet` supports `OP_X402` for Permits of kind BROWSER or ALLOWANCE when the asset is USDC.
  - `X402Lib` registers an executor-signed EIP-3009 authorization. The wallet then accepts it through ERC-1271, so USDC's `transferWithAuthorization` can pull from the smart-contract wallet.
  - Up to 8 can be outstanding, pruned on expiry, settlement, epoch change or revocation.
- **Shared types exist.** `packages/schema/src/x402.ts` holds the Base Sepolia USDC address, its verified domain separator and the EIP-3009 types.
- **Not wired yet:**
  - No runbook emits an x402 action.
  - The worker never settles one.
  - The provider sends `x402: null`.
  - The API's intent compiler is configured as `null`.
  - No runbook asks the agent a question.
- **The phone already has:** the chat thread, product-style cards, the approval bottom sheet, hold to sign, Stop and the redesigned agent wallet (branch `feat/mobile-agent-chat`).

### Mobbin references for the experience

- **Agent in chat:**
  - [Grok Bot, connected service in chat](https://mobbin.com/screens/3dfbca7c-3f02-4ce8-8b54-38f7cbfda9b5).
  - [Bevel, thinking steps and result card](https://mobbin.com/screens/917eb5ec-cbe1-4074-82bd-3a8ff7a64055).
- **Confirmation inside the chat:**
  - [SHEIN, order confirmation card](https://mobbin.com/screens/3397c1eb-98a4-4ec7-8721-9d54db6de531).
  - [Agoda, irreversible action confirmation](https://mobbin.com/screens/3fa46baa-048c-482c-a9dc-1c74ae9479d7).
  - [Airbnb, pay button under the chat](https://mobbin.com/screens/2a8a460b-833e-416b-9111-887052276eb3).
- **Discovering agents and services:**
  - [Base, agents in a wallet](https://mobbin.com/screens/a3fd65a5-dbe5-4033-9fd8-a69ea8e40b5e).
  - [World App, Explore](https://mobbin.com/screens/f762c8b4-2f3b-480e-b471-d2f688f68d89).
  - [Alexa, example prompts with Launch](https://mobbin.com/screens/4996c78e-9e18-487c-9626-e223e59efd18).

## Decisions taken (2026-10-21)

1. **Merchant:** our own test shop, a real x402 seller on Base Sepolia.
2. **Facilitator:** the public x402.org facilitator first. Our worker settles instead if the facilitator rejects contract-wallet authorizations, which Task 1 proves either way.
3. **Agent model:** OpenAI Agents SDK with the owner's OpenAI key. This replaces "Claude Agent SDK" in architecture S9, so Task 9 updates the docs and AGENTS.md.
4. **Checkout:** one saved test delivery address on the phone. It is shown on the confirmation sheet and sent to the shop only after you sign.

## How it works

```
Phone (chat)  ──message──▶  API /v1/conversations  ──▶  Agent service (OpenAI Agents SDK)
     ▲                              │                         │ tools: search, show options,
     │  events: text, products,     │                         │ request purchase, status, cancel
     │  approval needed, status,    ▼                         ▼
     │  receipt               tasks + permits  ◀──  commerce runbook (worker)
     │                              │                         │ 1. quote from shop (HTTP 402)
     └── approval sheet + hold ─────┘                         │ 2. MPC executor signs OP_X402 Action
                                                              │ 3. wallet registers EIP-3009 auth (on chain)
                                                              │ 4. facilitator settles USDC (on chain)
                                                              ▼ 5. shop returns signed order receipt
                                                     Mandate Shop (x402 seller)
```

**Safety rules that do not change:**
- The agent model never holds a key and cannot move money.
- Its tools only:
  - read the catalogue;
  - show options;
  - ask the service to open a purchase task;
  - read status.
- Money moves only through the owner-signed Permit and the MPC executor, and the wallet contract checks every payment:
  - asset, recipient and amount;
  - per-payment, daily and weekly caps;
  - review threshold and epoch.
- Anything above "ask me first" needs the owner's co-signature (the existing Approval flow).
- Stop pauses the wallet on chain, which ends every outstanding authorization.

**Two ways to authorise a purchase**, both already supported by the contract:
- **One purchase:** a per-order Permit, kind BROWSER, recipient = the shop, max payment = the quoted price. You approve each order with hold to sign. This is the default.
- **Shopping allowance:** an ALLOWANCE Permit ("up to 30 USDC a week at Mandate Shop"). Orders under the review threshold go through without asking; orders above it raise the approval sheet. This is the Cobo "Pact" model, and it is optional in this plan (Task 8).

## Tasks

Each task ends with its own checks. Run commands with `pnpm --filter <package> check` unless a task says otherwise. Use Conventional Commits.

### Task 0: Pin versions and confirm the moving parts (half a day, Person 4)

- Pin exact, published versions of:
  - the OpenAI Agents SDK for TypeScript (`@openai/agents`);
  - the official x402 v2 TypeScript server and client packages.
- Record each version and source URL in `docs/plans/05 - Agentic Commerce.md`.
- Confirm in the FiatToken source on Base Sepolia that USDC exposes `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)`, the ERC-1271 path. Record the block and code hash.
- **Done when:** both versions are pinned and the USDC check is written down with its evidence.

### Task 1: Prove a contract-wallet x402 payment on Base Sepolia (1 day, Person 1 + 2)

- Write a script in `packages/contracts/script/` that:
  - uses a funded test agent wallet with a USDC ALLOWANCE or BROWSER Permit;
  - has the MPC executor sign an `OP_X402` Action, so `X402Lib.register` runs;
  - builds the x402 `exact` payment payload;
  - asks `https://x402.org/facilitator` to `/verify` and `/settle` it.
- If the facilitator rejects ERC-1271, add a self-settle path to the worker: the relayer calls the bytes-signature `transferWithAuthorization`.
- **Done when:** one real Base Sepolia transaction moves USDC from the agent wallet to a test payee, with the tx hash recorded. No contract change is expected. If one is needed, stop and ask for deploy authorization.

### Task 2: Mandate Shop, a real x402 seller (2 days, Person 4)

New app `apps/shop` (Fastify, like `apps/provider`):
- **`GET /catalog?q=&maxPrice=`** (free):
  - 12 sample products, mostly shoes, each with id, name, brand, sizes, price in USDC base units and an image;
  - images are original illustrations we make, with no third-party product photos.
- **`POST /orders`** with `{productId, size, address, requestId}`:
  - without payment it answers HTTP 402 with x402 `PaymentRequirements`: USDC, `payTo` = shop address, exact price, 60 s validity;
  - with a valid `X-PAYMENT` header it verifies and settles through the facilitator (or hands settlement to the worker, per Task 1);
  - it then returns an EIP-712 signed **OrderReceipt** `{orderId, productId, size, amount, payer, paymentTxHash, addressHash, createdAt}`.
- **`GET /orders/:id`** returns the signed receipt again. The same request never charges twice.
- Bazaar discovery metadata on the paid route, so it lists like any x402 service.
- The shop's signing key comes from Key Vault, never from code.
- **Tests:** a 402 shape test, a wrong-amount refusal, an expired-quote refusal, an idempotent repeat, receipt signature verification.
- **Done when:** a script pays the shop from the Task 1 wallet and gets a receipt that verifies.

### Task 3: Shared types (1 day, Person 1)

- Add `commerce-buy` to `RunbookIdSchema`, plus commerce conditions `{shop, productId, size, maxAmount}`.
- Add schemas for `OrderReceipt` and the chat event types (Task 5).
- Add golden vectors for the receipt digest. Update the manifest builder, the verifier and the mobile DTO copies in the same change.
- **Done when:** `pnpm -r check` passes and the vectors match in the schema, verifier and mobile tests.

### Task 4: Commerce runbook and worker settlement (2 days, Person 2 + 4)

- Add `packages/runbooks/src/commerce.ts`, which:
  1. requests a quote from the shop (402);
  2. checks the quote against the Permit (shop is a bound recipient, amount ≤ max payment);
  3. proposes an `OP_X402` intent from the quote (the worker has the MPC executor sign it, and the wallet registers it on chain);
  4. submits the payment header to the shop;
  5. completes with the signed receipt.
- On a quote above the threshold, the existing AWAITING_APPROVAL path raises the owner approval.
- In the worker, settle or confirm the EIP-3009 transfer from the receipt. Record every step in the evidence log (quote, authorization, settlement tx, receipt).
- **Done when:** a task created through the API with a signed Permit ends COMPLETED on testnet with a real USDC transfer and a verified receipt, and a second run with too high a price is refused with a reason.

### Task 5: Conversation service with the OpenAI Agents SDK (2–3 days, Person 2 + 4)

- Rework `apps/agent` into a service the API calls. It uses the OpenAI Agents SDK with the owner's OpenAI key from Key Vault (model chosen in Task 0) and these tools only:
  - `search_products(query, maxPrice, size)`: reads the shop catalogue;
  - `show_options(productIds, note)`: sends product cards to the chat;
  - `request_purchase(productId, size)`: opens a `commerce-buy` task. It cannot sign or pay; the phone must approve.
  - `get_status(taskId)`, `cancel(taskId)`.
- Add API routes:
  - `POST /v1/conversations` and `POST /v1/conversations/:id/messages`;
  - `GET /v1/conversations/:id/events` (SSE). Events are typed `text`, `products`, `approval_needed`, `status`, `receipt` and `error`.
- Store conversations in the DB, scoped to the owner session.
- The model's text is shown as the agent's words. Every money fact (price, status, tx hash) comes from service data, never from model text.
- Rate-limit requests and cap tokens per conversation. Without a key the route returns 503 and says why; it never sends a fake reply.
- **Done when:** a scripted conversation ("running shoes under 25, size 42" → pick → purchase) produces the right event sequence against the testnet shop.

### Task 6: Phone chat for shopping (2–3 days, Person 3 / you)

On top of `feat/mobile-agent-chat`:
- **Agent tab sends messages to the conversation API.** Remove the keyword reader (`readRequest`) for shopping; keep page checks as one more thing the agent can do.
- **Product cards:** a horizontal row of cards with image, name, price and "Choose", from the Grok and SHEIN references. Choosing sends the pick back to the agent.
- **Purchase sheet:** product, size, price in USDC, shop, delivery address and the per-payment limit it falls under, then hold to sign. This reuses `ApproveSheet` with an order layout and signs the per-order Permit.
- **Payment approval sheet** for orders above "ask me first" (the existing Approval flow).
- **Status steps:** quote received, payment authorised, paid on chain (tx link), receipt received. The now line and Stop stay as built.
- **Receipt card:** order number, item, amount, tx hash and "Test shop – no goods ship".
- **Discover section** on the Agent tab, from the Base, World App and Alexa references:
  - published services (the shop and the page-check providers) with price per use;
  - example prompts with "Try", which fills the message box.
- **Settings:** a saved test delivery address.
- **Done when:** on the simulator, a fresh account with test USDC can buy a shoe through chat, and the receipt and tx hash match BaseScan.

### Task 7: Evidence and verifier (1 day, Person 4)

- Add the quote, the x402 authorization, the settlement tx and the order receipt to the task evidence bundle (schema 4, additive events).
- Have `mandate-verify` check:
  - the receipt signature;
  - the payment amount and recipient against the Permit;
  - the settlement on chain.
- **Done when:** the verifier reports PASS for authority, policy, settlement and delivery on a real purchase bundle, with nothing marked PASS that was not checked.

### Task 8: Shopping allowance (optional, 1–2 days)

- Add an ALLOWANCE Permit flow: "Let the agent spend up to N USDC a week at Mandate Shop". Purchases under the threshold proceed without the purchase sheet; above it, the approval sheet appears.
- Show remaining allowance in the chat header and on the agent wallet.
- **Done when:** two purchases under the threshold settle without prompts, a third above the threshold asks for approval, and one over the weekly cap is refused on chain.

### Task 9: Docs, deploy and demo (1 day)

- Update architecture S9, AGENTS.md ("Claude Agent SDK" → OpenAI Agents SDK), README and the demo script.
- Deploy `apps/shop` and the updated API, worker and agent service to the demo VM. Rehearse the recording: fresh install → fund → chat purchase → stop.
- **Done when:** the dry run passes from a fresh install with only testnet funds.

## What I need from you

1. **OpenAI API key**, stored by you in the server's Key Vault (I'll name the secret). Please don't paste it in chat.
2. **Test funds.** Base Sepolia ETH for the personal account, about 0.01, and test USDC from [faucet.circle.com](https://faucet.circle.com) for funding the agent wallet. Both faucets need a human.
3. **Deploy authorization** for the new `apps/shop` service and the updated API, worker and agent on the demo VM. AGENTS.md requires this.
4. **Contract redeploy authorization, only if Task 1 shows the facilitator path needs a contract change.** I don't expect it to.
5. **Ownership sign-off.** This touches Person 1 (schema), Person 2 (API, worker), Person 3 (phone) and Person 4 (shop, runbook, verifier). Tell me whether I build it all on one branch with separate commits, or split it per owner.

## Risks

- **The public facilitator may not accept ERC-1271 authorizations.** Task 1 settles this first, and self-settlement through our relayer is the fallback.
- **The x402 v2 packages are new.** Versions are pinned in Task 0, and the shop's 402 shape is tested against the spec.
- **Model output can be wrong.** It never decides money facts: prices, recipients and amounts come from the shop quote and are checked by the phone, the service and the contract.
- **OpenAI cost** is small per demo but not zero. Token caps per conversation are in Task 5.
- **Third-party testnet endpoints disappear.** The demo depends only on our own shop.
