# Mandate Product Demonstration Script

**Target Duration:** 4:45  
**Network:** Base Sepolia (Chain ID `84532`)  
**Product:** Mandate Wallet & Autonomous Delegated Agent System

---

## Overview & Scene Breakdown

| Scene | Timestamp | Description | Visual / Action | Key Narrative |
| :--- | :--- | :--- | :--- | :--- |
| **1. Personal Wallet** | `0:00 - 0:40` | Seed creation, backup, receive DemoUSD/ETH, and manual personal send. | Mobile app screen recording. Native seed phrase import, balance update, and direct EOA send via QR scan. | "Self-custody personal wallet for everyday crypto transfers on Base Sepolia. The owner holds the keys locally with biometric protection." |
| **2. Managed Funding & Task Approval** | `0:40 - 1:15` | Transfer funds to managed agent wallet, review and co-sign agent permit. | Mobile screen. Tap "Fund Managed Wallet", move 2.00 DemoUSD. Agent requests checkout-testing task. Owner signs EIP-712 Permit, then locks phone. | "The owner funds a smart contract wallet with a bounded budget and signs a cryptographically enforceable permit defining caps, allowed services, and expiry." |
| **3. Autonomous Paid Agent Execution** | `1:15 - 2:20` | Phone offline. Agent runs browser checkout, handles provider failure, falls back cleanly. | Terminal + Browser split screen. Playwright runs target. Provider A times out/fails; agent detects failure and automatically falls back to Provider B. | "With the owner's phone completely offline, the agent executes work autonomously under on-chain boundaries. When Provider A fails, it recovers by using approved Provider B without exceeding spend limits." |
| **4. Liquidity & Scheduled Keeper** | `2:20 - 2:55` | Scheduled periodic execution and bounded vault keeper. | CLI / Dashboard view showing vault deposit and periodic payment tick. | "Bounded runbooks allow scheduled payments and vault deposits that run strictly once per period with risk signals checked." |
| **5. Owner Control & Emergency Stop** | `2:55 - 3:30` | Owner executes direct transfer (`OwnerTransfer`) from managed wallet, incrementing epoch and stopping agent. | Mobile app. Owner opens wallet, taps "Emergency Stop / Withdraw". Direct on-chain transfer executes. | "The owner retains ultimate authority. A manual withdrawal increments the wallet epoch, instantly and permanently invalidating all active agent permits on-chain." |
| **6. Continuity & QR Validation** | `3:30 - 4:00` | Multi-account switching, transaction history, and error rejection on invalid QR. | Mobile screen. Scan invalid Base Mainnet QR and duplicate param QR. Clean native error alerts appear. | "The wallet enforces strict chain and input validation, rejecting unsupported chains or malicious QR parameters before any transaction can be drafted." |
| **7. Independent Verification** | `4:00 - 4:45` | Standalone CLI verification without backend trust. | Terminal running `mandate-verify evidence.zip`. All 6 green checks display. | "Anyone can verify the entire execution offline using our open-source verifier. Six tamper-evident findings prove integrity, authority, policy, settlement, delivery, and completion against Base Sepolia RPC." |

---

## Detailed Scene Directions

### Scene 1: Personal Wallet & Setup (0:00 – 0:40)
* **Visual:** Mobile screen recording on physical device or simulator.
* **Steps:**
  1. Open Mandate app, displaying Personal EOA account balance (0.05 ETH, 10.00 DemoUSD).
  2. Tap **Receive**; show generated ERC-681 QR code for Base Sepolia.
  3. Tap **Send**; scan a valid DemoUSD transfer QR from `demo/wallet-requests/index.html`.
  4. Show review sheet: Recipient `0x6666...`, Amount `1.50 DemoUSD`, Gas paid by personal EOA.
  5. Confirm transfer; show successful transaction toast and updated balance.
* **Voiceover:**
  > "Welcome to Mandate — the self-custody wallet built for you and your autonomous agents. We start in the personal wallet. Your keys are generated locally and secured by device hardware. Receiving and sending ETH or DemoUSD on Base Sepolia is fast, direct, and completely independent of any server trust."

### Scene 2: Managed Funding & Task Approval (0:40 – 1:15)
* **Visual:** Mobile screen.
* **Steps:**
  1. Switch to the **Managed Agent Wallet** tab.
  2. Tap **Fund Wallet**; deposit `2.00 DemoUSD` from personal account.
  3. A push notification / prompt appears: *"Agent requests permission for Staging Checkout Check"*.
  4. Review details: Spend Cap `1.00 DemoUSD`, Max Payments `2`, Allowed Providers `[Provider A, Provider B]`, Expiration `1 hour`.
  5. Tap **Approve & Sign Permit**. Native EIP-712 signature generated.
  6. Lock phone and put it aside.
* **Voiceover:**
  > "When you want an AI agent to perform work for you, you don't hand over your private keys. Instead, you fund a managed smart contract wallet and approve an EIP-712 task permit specifying exact spending caps, approved counterparties, and deadlines. Once approved, the phone can be completely powered off."

### Scene 3: Autonomous Agent & Bounded Recovery (1:15 – 2:20)
* **Visual:** Split screen: Terminal running agent worker + Playwright browser window.
* **Steps:**
  1. Agent worker receives task and queries `packages/runbooks` for next step.
  2. Step 1: Agent queries Provider A for quote (`0.20 DemoUSD`). Proposes payment.
  3. MPC executor submits transaction on Base Sepolia. Payment confirmed.
  4. Provider A attempts delivery on `checkout-broken` target; form submit fails or times out.
  5. Runbook engine logs honest delivery failure; gross spend `0.20 DemoUSD` recorded.
  6. Fallback step: Remaining cap `0.80 DemoUSD` permits fallback. Agent queries Provider B (`0.35 DemoUSD`).
  7. Payment confirmed to Provider B; Playwright completes healthy form submission. Screenshot and logs captured.
  8. Total gross spend `0.55 DemoUSD`, task marked COMPLETED.
* **Voiceover:**
  > "While the owner is offline, the agent runs. It first hires Provider A for 20 cents. But Provider A encounters a checkout error. Rather than getting stuck or hallucinating, Mandate's delivery engine records the failure, inspects the remaining budget, and safely falls back to Provider B for 35 cents. Both payments are settled honestly on-chain, and the completed result is delivered."

### Scene 4: Liquidity Keeper & Scheduled Automation (2:20 – 2:55)
* **Visual:** Dashboard and terminal logs.
* **Steps:**
  1. Show scheduled payment keeper ticking at the specified window.
  2. Show liquidity keeper evaluating vault reserves: verifies risk signal is `NORMAL` before proposing bounded deposit of `0.50 DemoUSD` into `DemoVault`.
  3. Transaction executes within pre-authorized policy limits.
* **Voiceover:**
  > "Mandate also supports specialized financial workflows like scheduled payments and automated vault liquidity management. Every action is evaluated against on-chain policy constraints and risk sentinels before any signature can be produced."

### Scene 5: Owner Control & Emergency Stop (2:55 – 3:30)
* **Visual:** Mobile app screen.
* **Steps:**
  1. Owner opens phone and navigates to the Managed Wallet.
  2. Tap **Emergency Stop / Sweep Funds**.
  3. Confirm `OwnerTransfer` of all remaining DemoUSD back to Personal EOA.
  4. Transaction confirms on Base Sepolia.
  5. Show contract epoch incremented from `1` to `2`.
  6. Attempting to run any prior agent task immediately reverts on-chain with `PermitEpochInvalid`.
* **Voiceover:**
  > "You are always in control. If an agent behaves erratically or you need your funds back, a single Owner Transfer moves your assets back to your personal wallet. This on-chain action increments the wallet epoch, instantly and irrevocably revoking every active agent permit."

### Scene 6: App Continuity & QR Safety (3:30 – 4:00)
* **Visual:** Mobile app screen.
* **Steps:**
  1. Show switching between multiple personal sub-accounts and inspecting activity history.
  2. Open scanner and scan an invalid QR code from `demo/wallet-requests` (Base Mainnet chain ID `8453`).
  3. App immediately displays alert: `Unsupported Chain (8453). This wallet operates on Base Sepolia (84532)`.
  4. Scan duplicate parameter QR; app flags `Invalid Request`.
* **Voiceover:**
  > "The wallet enforces strict cryptographic and protocol boundaries. Scanning an invalid chain or malformed request fails immediately with clear explanations, preventing accidental transfers."

### Scene 7: Independent Evidence Verification (4:00 – 4:45)
* **Visual:** Clean terminal window.
* **Steps:**
  1. Download execution evidence bundle `evidence.zip`.
  2. Run CLI command:
     ```bash
     mandate-verify --bundle evidence.zip
     ```
  3. Output scrolls with green checks:
     - `[✓ PASS] INTEGRITY: Sequential hash chain and checkpoint signature verified`
     - `[✓ PASS] AUTHORITY: Owner Permit recovered and active`
     - `[✓ PASS] POLICY: Spend cap (1.00 USD) and max payment respected`
     - `[✓ PASS] SETTLEMENT: Canonical Base Sepolia confirmations verified`
     - `[✓ PASS] DELIVERY: Browser result and screenshot hashes validated`
     - `[✓ PASS] COMPLETION: Task achieved terminal completion`
  4. Concluding title card.
* **Voiceover:**
  > "Finally, Mandate provides portable accountability. With our standalone verifier, anyone can audit the entire execution bundle offline. Six verifiable findings prove integrity, authority, policy compliance, settlement, delivery, and completion. That is Mandate: your wallet, your agents, your rules."
