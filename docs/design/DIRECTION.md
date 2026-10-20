# Mandate: direction

## Brief (self-authored where marked)

- **App:** Mandate. A phone wallet for one person, plus a separate funded wallet for an AI agent that does paid work for them within limits they approve. Tagline (kept): "Your agent. Your money. Real work."
- **Core action, first ten seconds, every day:** see what the agent is spending against the budget I approved, and stop it if I want to. (The current Home leads with two balance cards. This is a decision for the user, below.)
- **Feeling:** calm and trustworthy, precise and instrument-like. *Outside references: self-authored, none given.*
- **Deliverable:** mockups only. Nothing in the app changes until a direction is approved. Mockups use **sample data, labelled "Design mockup, sample data"**. The real app still shows only what it can do today.
- **Keep:** the name and tagline. Hard rules from AGENTS.md hold regardless: no screen may imply a capability exists that does not.
- **Platform:** iPhone mockups at 402 x 874. The app is React Native, so SwiftUI is not the build target.

## Current app

Source: `apps/mobile/src/theme.ts`, nine screens, simulator captures in `redesign/captures`.

**What it is.** A cool off-white canvas with two soft radial glows (blue top left, peach top right), white shadowed cards, a navy gradient hero card with its own radial glow, four pastel icon tiles (blue, amber, green, violet), a glossy gradient orb on Welcome. Personal is blue, agent is amber. System font throughout, sentence case, honest "Not available yet" tags.

**Which slop it hits (slop.md):**
- *Glow / mesh gradient as personality:* the canvas and the hero card, on every screen.
- *Confetti and icon chips:* four pastel tiles carry the meaning of rows that need no icon.
- *The dashboard reflex:* Home is a hero balance card, Address and Spendable tiles, then two buttons. Nothing says what the agent is doing.
- *Everything is a card:* every group is a rounded white box with a shadow.
- *3D glossy blob:* the Welcome orb says nothing about the product.
- *Fintech-dark hero:* the navy gradient card with glow.
- Not hit: greetings, emoji, marketing copy, centred FAB. Copy is good and stays.

**Inventory (a contract):**

| Keep | Lose | Unknown |
|---|---|---|
| Name, tagline, every word of existing copy where the feature still exists | Radial glows, gradient hero, orb | Whether personal wallet or agent wallet leads Home (decision 1) |
| Honest states: unavailable and not connected are said in words | Pastel icon tiles as the row identity | Tab structure (decision 2) |
| Personal and agent funds never added together | Cards around every group | |
| Receive, Send, Scan, Accounts, Activity, Settings, Welcome, Set up | Blue/amber colour coding of the two wallets | |
| "You can always stop them", even offline | | |
| Base Sepolia, test funds, stated | | |

**Harvested:** brand name and tagline, all copy, the chain chip text, the existing screens' structure. No logo to keep: the current mark is a stock "M in a box" glyph.

**Decisions for the user (not made silently):**
1. **Home leads with the agent and its budget, not two balance cards.** Personal balance drops to one quiet line. Receive and Send stay reachable (Home row and toolbar), but stop owning the hero.
2. **The wallets stop being colour-coded blue and amber.** They are told apart by type and position. The one accent now means "signed by you".
3. **Welcome loses the orb.** It gets the seal instead.
4. **A new agent name, "Atlas", and provider names, are invented for the mockups.** They are sample data.

## Concepts

| | Concept sentence | Family | Ground | Type | Accent | Richness |
|---|---|---|---|---|---|---|
| A | Mandate is a notary's seal press. | object | light | serif (New York) | red (wax) | shape |
| B | Mandate is a ship's bridge at night. | place | dark | condensed + mono | orange (amber) | shape |
| C | Mandate is a lock chamber filling with water. | nature | colour field | expanded | neutral on green | colour field |

Rendered on the core screen in `explore.html` (`shots/explore/sheet.png`). Scan on the first render: A clean; B one real FAIL (numeral collided with its caption); C clean.

**Chosen: A, with B's graduated scale.** A is the only one where the concept is *the product*: a mandate is a signed authority, and the owner approving a task is pressing a seal. That gives the whole app one object, one accent role and a signature interaction. B read as the most "precise", but a near-black ground with a bright signal is the crypto default I am refusing. C had the best idea (a water level is a budget) but a large empty water field and a green ground read as money-green. **From B:** the tick scale around the dial, tabular figures, monospace times. **From C:** nothing.

**History check** (`~/.app-designer/history.md`, one row: object / light / custom-display / teal / illustration). Mandate: object / light / serif / red / shape. Differs on type, accent and richness: 3 of 5.

## The category default I am refusing

Top wallet apps (Phantom, Coinbase Wallet, Trust, Base): a dark or electric-blue ground, a mascot or glossy token illustration, a big portfolio balance, a row of round Buy/Send/Swap buttons, a token list. Colour cliché: blue or navy for trust, lime or neon for crypto. I refuse: the portfolio balance as hero, the round action row, the token list as the product, blue as trust, neon. I also refuse this skill's rut (grey paper, black ink, one red, mono, ruled rows): richness comes from the seal, the dial, a serif voice and the Welcome scene, not from rules alone.

## Tokens

**Roles (light / dark).** Dark is a second design: elevation goes lighter, wax lightened and slightly desaturated.

| Token | Light | Dark |
|---|---|---|
| ground | `#E8ECEB` cool bone | `#0F1315` |
| raised | `#F4F6F5` | `#171D20` |
| ink | `#14191C` | `#ECEAE3` |
| ink-2 | `#454E54` | `#A7AFB3` |
| ink-3 | `#5A646A` | `#8C969B` |
| rule | `#C6CDCF` | `#283034` |
| accent (wax) | `#8F2A2E` | `#C95B5F` |
| accent-tint (wax, the authorised limit) | `#D9C2C3` | `#3A2527` |
| on-ink | `#F4F6F5` | `#0F1315` |

**Accent role:** "signed by you": the budget you authorised, a seal you pressed, an action you took yourself. Used on the dial, owner rows in Activity, the seal in Welcome and the icon. **System tint follows ink**, not the accent, because the role is a state, not an action. No red for danger: nothing in this app can exceed a limit, and "stop" is an ink capsule.

**Type.** Two families. *New York* for the voice: screen titles and the hero numeral (500 at 78, 600 at 38, tracking -3% and -2.4%, lining figures). *SF Pro* for everything functional, *SF Mono* only for times and addresses. Sizes: 78, 38, 22, 17, 15, 13, 11 (tab labels 10, system). Weights Regular, Medium, Semibold; display at 500 to 600, no light weights. Tabular figures on every amount.

**Layout.** Side margin 20. Radius family: 27 (capsule), 26 (sheets and grouped lists), 14 (small). Spacing 4, 8, 12, 16, 24, 32, 48. Hairline 0.5pt.

## The richness source

**A notary's seal, drawn by one hand.** A scalloped disc (48 beads), a thin inner ring, a graduated tick scale around it (from concept B), embossed with a one-pixel white highlight on its lower edge and a faint cool shadow on its upper edge. Always the same object: the budget dial (Home), the empty seal (Welcome), the stamp (Approve), the icon. Light on it is physical (emboss), never glow. No gradients anywhere.

## The signature: press to seal

On "Approve a task", the owner **presses and holds** the seal for 0.6s.

| t | Frame | Haptic |
|---|---|---|
| 0 | Empty dashed seal, label "Press and hold to seal" | none |
| 0 to 600ms | A wax ring fills clockwise; the seal scales 1 to 0.97; the budget figure and limits stay on screen | light rigid ticks every 50ms, rising intensity |
| 600ms | The disc floods wax; spring back to 1.04 then 1.0 over 220ms; the beaded edge appears; mark embossed | one heavy impact |
| after | Label becomes "Sealed 14:57"; the capsule below becomes "Atlas can start" | none |
| release early | Ring drains back in 150ms; nothing is signed | one soft tick |

Reduced motion: no scale, the ring fills linearly, the final state and the heavy haptic stay. The press is also the confirmation for a signature, so it cannot be done by accident and cannot be done by a double tap.

## Content (all sample data, labelled in the mockups)

**Agent and task.** Agent: Atlas. Task: "Compare freight quotes, Rotterdam to Savannah." Approved at 14:31 for 12.00 DUSD (the app's test token, valueless). Most per payment: 1.50. Can pay only: Kestrel Data, Portline API, Harbour Index. Ends 20 Oct, 18:00. Atlas wallet holds 41.60 DUSD after funding. Spent so far 4.42, left 7.58 (63%). Nine payments.

**Home.** Title "Atlas"; state "Working, since 14:31"; chip "Test network"; seal: 7.58, "DUSD left", "of 12.00 for this task"; now-row "Paying Harbour Index 1.10"; then Kestrel Data (lane rates, 14:49, 0.42), Portline API (transit times, 14:44, 0.30); personal line "Personal account 128.00 DUSD"; capsule "Pause Atlas". Tabs: Home, Activity, Settings.

**Approve.** Title "New task from Atlas". Sentence: the task. Rows: Budget 12.00 DUSD; Most per payment 1.50 DUSD; Can pay Kestrel Data, Portline API, Harbour Index; Ends 20 Oct, 18:00. Note (existing copy): "You can pause Atlas at any time, even when the Mandate service is offline." Actions: "Press and hold to seal", "Decline".

**Activity.** Today: 14:51 Harbour Index port fees 1.10; 14:49 Kestrel Data lane rates 0.42; 14:44 Portline API transit times 0.30; 14:31 "You approved Freight quotes, Rotterdam to Savannah" 12.00 (owner row). Yesterday: 18:20 "You moved 40.00 DUSD to Atlas" (funding, not spending); 16:05 "You paused Atlas" (owner row); 15:58 Kestrel Data lane rates 0.42.

**Welcome (first run, honest).** "Mandate", "Your agent. Your money. Real work.", the four existing trust points (titles only), "Get started", "I have a recovery phrase". A line "Preview build. Wallet features are not built yet." stays, because the real app needs it.

**Not designed in this pass:** Accounts, Receive, Scan, Send, Transfer review, Set up your wallet, Settings, the personal-wallet Home. They inherit the tokens.


---

## Addendum: wallet first (supersedes the Home and tab decisions above)

The user asked for a typical wallet with the agent features inside it. Research is in `RESEARCH.md`; screens are in `wallet.html` (`shots/w5/sheet.png`). What changed, and what did not:

- **Home is a wallet.** Account chip with a chevron, hero numeral, Receive / Send / Scan, then Agents and Tokens sections. The agent is a section, not the page. The "Needs you" row sits first in it.
- **One new tab, Agents** (Wallet, Agents, Activity, Settings). The agent screens in the plan (Approvals, Task, Control, Schedule) need a home. Decision for the user.
- **The seal narrowed to three jobs:** the budget gauge on agent cards (Revolut shows a circular spent-against-limit gauge, one product), the signature on approval, and the Welcome scene and icon.
- **Honest wallet adaptation.** No fiat column, chart or total. The hero is the DemoUSD balance with "Test funds. No market value." Review shows the token amount and the ETH fee as separate rows, never summed.
- **Token glyphs are monochrome discs**; DemoUSD carries the seal mark.
- **Unchanged:** tokens, type, accent role ("signed by you"), the press-to-seal signature, light and dark, the icon.

**Decisions for the user:** (1) the Agents tab; (2) Home hero shows DemoUSD, not a "total"; (3) Decline sits in the toolbar on Approve; (4) a serif has to be bundled for Android, since New York is Apple-only; (5) "Pause all agents" appears in both the Agents tab and Settings.


---

## Addendum: pass 1 (own the wallet)

Research: `RESEARCH.md`, "Pass 1" (ten studies). Screens: `pass1.html` (`shots/p4/sheet.png`). Decisions:

- **Creation is a four-step flow with a progress line** (phrase, confirm, passphrase, Face ID) and ends on a **sealed wax seal with a check**: the same object that signs an agent approval, used once for "you made this wallet".
- **The recovery words are the display moment**, set in the serif, numbered, two columns. They are hidden until "Show phrase". There is **no copy button**.
- **The quiz is multiple choice**, three questions, and nothing is marked backed up until all three are right.
- **The passphrase is its own optional step** with a separate acknowledgement, per the plan.
- **Lock** is Face ID or the device passcode, one minute by default. No app PIN.
- **Remove wallet is an ink button, not red.** Red already means "signed by you".
- **Scan** rejects a wrong-network code in words and fills nothing in; the camera-off state has a way out (paste an address).
- **Contacts** say they stay on the phone and are not recovered from the phrase.
- **Transaction detail** shows the plan's lifecycle as three steps, with Speed up and Cancel, and says a cancel can lose.
- **Network and Help** show an offline state, RPC and explorer, and the test-funds steps.
- **Icon unchanged:** the wax seal with the "M". The app has no icon asset today; this is the one to add.

## Addendum: pass 2 (start an agent)
- Provisioning is a vertical stepper (deploy, create key, ready) with "Close and notify me". No spinner-only wait.
- Funding uses chips (10, 25, 50, 100) and states that these are test funds.
- Intent: goal first, then a draft, then "what you would sign" with Edit terms and Approve. The goal sits above the terms.
- The four task kinds are rows in a chooser. Schedule shows its total cap.
- Allowance approval uses the press-and-hold seal, the same signature as other agent authority.
- Wallet limits show what removing a rule does before signing (sheet "Before you sign").
- Providers show manifest facts and "Recently delivered", never stars. There is no marketplace.

## Addendum: pass 3 (run and stop an agent)
- Running task is a vertical stepper; the agent's choice is read-only with its reason. Owner can only stop it.
- Co-signature approval uses the press-and-hold seal, with an expiry and "do nothing means no payment".
- Stop is three separate rows (pause all, end a permission, freeze). Pending and confirmed are different screens. Offline stop reads the chain directly.
- Sign-out sheet says agents may keep working.

## Addendum: pass 4 (prove it)
- Activity names who made each row. Agent payment detail shows task, decision, limit, approval and status, and links to the proof.
- Proof lists the six findings with a glyph, state and one-line reason. The wax red is used only for a failed finding.
- The service's view and the independent verifier's report are separate screens. Completion stays "Not independent" in both.
- Export is a file the owner shares through the system sheet.
