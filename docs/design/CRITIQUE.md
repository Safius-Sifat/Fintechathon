# Critique (self-scored, harder than feels fair; no fresh-eyes critic was used)

Scored with critique.md's rubric. Round 1 = `shots/r1/sheet.png`. Final = `shots/r6/sheet.png` (r2 to r5 were fixes in between).

| # | Line | R1 | Final |
|---|---|---|---|
| 1 | Concept on the pixel | 4 | 4 |
| 2 | Not the category average | 4 | 4 |
| 3 | Not this skill's average | 3 | 4 |
| 4 | Hierarchy | 4 | 4 |
| 5 | Typography | 4 | 4 |
| 6 | Colour | 4 | 4 |
| 7 | Richness | 3 | 4 |
| 8 | Rhythm and space | 2 | 4 |
| 9 | Craft details | 3 | 4 |
| 10 | Native fluency | 4 | 4 |
| 11 | Signature | 3 | 4 |
| 12 | The feature test | 3 | 3 |
| 13 | Fidelity (redesign) | 3 | 4 |

Final: no line below 3, 12 of 13 at 4 or above. By critique.md's stop rule that is done. Line 12 stays a 3 on purpose: below the seal, the lists are still typographic rows.

## Round 1 findings, and what landed

1. Home had a 140px dead gap and no limits shown. **Landed:** third payment row, a "9 payments, 4.42 spent. Most per payment 1.50." line, and a tappable Personal account row with a chevron.
2. The tick scale taken from direction B was nearly invisible. **Landed:** darker ticks, longer majors, spent ticks in ink.
3. Welcome's empty seal was a blank disc and the screen had a gap. **Landed:** a ghost "M" in wax tint (the mark waiting to be pressed), a larger seal, more row padding.
4. Activity did not look like it scrolled. **Landed:** a third day running under the glass tab bar.
5. Storyboard frames were unreadable at mini size and "Rest" looked like "Holding". **Landed:** three cropped frames at 0.6 scale beside their captions; spec rows merged to fit.
6. Small phone (375 x 667) collided: flex items shrank the seal into the text. **Landed:** `flex: none`, Decline moved to the toolbar, and at small heights the least important rows are dropped, never the type.

## Declined / kept

- A second accent for "spent" versus "left": declined. One accent, one role (signed by you).
- Putting Receive and Send back as a row of round buttons: declined. It is the wallet category's skeleton. They stay reachable through the Personal account row; this is decision 1 for the user.

## Not verified

- Real-device feel, haptic timing and the press-to-seal motion (shown as frames only).
- SF Pro and New York render from this Mac. React Native needs bundled fonts, and New York is not available there: see the report.
- Small-phone check ran on Home, Approve, Welcome and Activity. The storyboard panel is documentation, not a phone screen, and hides its spec at that size. Activity's scroll warning at small size is deliberate (a list passing under glass).

---

# Wallet-first set (`wallet.html`), self-scored again

Brief change: a typical wallet with the agent features inside it (see RESEARCH.md). Round 1 = `shots/w1/sheet.png`. Final = `shots/w5/sheet.png`; `w2` to `w4` were fix rounds.

| # | Line | R1 | Final |
|---|---|---|---|
| 1 | Concept on the pixel | 4 | 4 |
| 2 | Not the category average | 3 | 3 |
| 3 | Not this skill's average | 3 | 4 |
| 4 | Hierarchy | 4 | 4 |
| 5 | Typography | 4 | 4 |
| 6 | Colour | 4 | 4 |
| 7 | Richness | 3 | 3 |
| 8 | Rhythm and space | 3 | 4 |
| 9 | Craft details | 3 | 4 |
| 10 | Native fluency | 4 | 4 |
| 11 | Signature | 4 | 4 |
| 12 | The feature test | 3 | 3 |
| 13 | Fidelity (redesign) | 4 | 4 |

Final: no line below 3, 10 of 13 at 4 or above. Done by the stop rule. Three lines stay at 3 on purpose and I would not inflate them:
- **Not the category average (3):** the wallet skeleton is the category's, by request: hero numeral, action row, token list. What differs is voice (serif, wax, a seal that means "signed by you"), not structure.
- **Richness (3):** the seal is rich, but only on the agent parts, Welcome and the icon. The plain wallet screens are typographic lists. More richness there would mean token art or illustration, which I refused as confetti.
- **Feature test (3):** a careful wallet, not one an editor would feature on its own.

## Round 1 findings, and what landed

1. Dark Home failed contrast (3.49:1 on the avatar numeral). **Landed:** numeral in ink.
2. The Accounts sheet was far taller than its content. **Landed:** sheet sized to content.
3. Review and Send had large dead gaps. **Landed:** taller rows, a larger amount.
4. Inset hairlines read as shadows (scan: seven shadows). **Landed:** real borders.
5. No screen showed which approval authorised an agent payment. **Landed:** Agent payment detail.
6. Type scale was 14 sizes. **Landed:** 10 (88, 66, 56, 38, 28, 22, 17, 15, 13, system 10).
7. Small phone: Receive buttons collided with the warning, Agents, Atlas and Payment detail ran under the Pause button. **Landed:** classes instead of inline sizes so the small-height rules apply; the least important rows drop out, never the type.

## Declined

- Fiat values, a price chart and a total value: declined. This is a test network with no price source. Showing them would be fake data in the product's own voice.
- Coloured token logos: declined. Four brand colours would rebuild the confetti the current app already has.
- A "slide to send" for personal sends: declined. Glow shows it, but one product is an example; the deliberate gesture stays reserved for the one real signature (approving an agent).

## Not verified

- Real-device feel, the press-to-seal motion and haptics.
- **Fonts in the app.** New York and SF Pro render here because this Mac has them. The app is React Native: New York is an Apple font and is not available on Android, so a serif would have to be bundled (an OFL face such as Newsreader). That is a decision, not a detail.
- Screens not designed: Scan (camera), Set up your wallet, recovery flow, Wallet limits, Approved providers, Brindle's detail, empty and error states, Receive/Send for the agent wallet, Transfer review for an owner transfer.

---

# Pass 1 (`pass1.html`): own the wallet, self-scored

20 frames: setup choice, recovery phrase (hidden and shown), confirm quiz, passphrase, Face ID, wallet ready, restore, restore accounts, locked, security and backup, remove wallet, Scan (camera, wrong network, camera off), Contacts (list, add), transaction detail, Network and Help, icon. Round 1 = `shots/p1/sheet.png`. Final = `shots/p4/sheet.png` (standard) and `shots/p4-se/sheet.png` (375 x 667).

| # | Line | R1 | Final |
|---|---|---|---|
| 1 | Concept on the pixel | 4 | 4 |
| 2 | Not the category average | 3 | 4 |
| 3 | Not this skill's average | 4 | 4 |
| 4 | Hierarchy | 4 | 4 |
| 5 | Typography | 4 | 4 |
| 6 | Colour | 4 | 4 |
| 7 | Richness | 3 | 3 |
| 8 | Rhythm and space | 4 | 4 |
| 9 | Craft details | 3 | 4 |
| 10 | Native fluency | 4 | 4 |
| 11 | Signature | 4 | 4 |
| 12 | The feature test | 3 | 3 |
| 13 | Fidelity | 4 | 4 |

Final: no line below 3, 11 of 13 at 4 or above. Done by the stop rule. Standard size has no scan failures; 375 x 667 has none.

## What changed between rounds

1. The disabled "I have written it down" capsule failed contrast (3.76:1). **Landed:** ink-2 on the rule tone, 5.4:1.
2. The Face ID glyph inside the lock button was black on black. **Landed:** drawn in the button's own ink.
3. Small phone: the phrase screen's button sat under the home indicator, the "ready" screen collided, and the Scan caption overlapped "Paste an address instead". **Landed:** titles shortened to one line ("Recovery phrase", "Confirm phrase"), the seal and caption positions follow the height, least important rows drop.
4. The phrase and quiz screens had no display moment (three text sizes, flat). **Landed:** the words themselves are the hero, set in the serif at 22.

## Two scan warnings I am keeping, deliberately

- **Restore accounts and Contacts:** "only 3 text sizes, hierarchy flat". They are a title over a list on purpose; the content is the screen.

## Declined

- **Copy button on the recovery phrase.** Four products have one; the plan forbids a secret on the clipboard.
- **Red for Remove wallet.** All four references use red. Here red already means "signed by you", so the button is ink and says what it does.
- **Slide to delete.** One product (Glow); an example, not precedent.
- **A free-text quiz.** A six-option choice cannot be mistyped.

## Not verified

- The press and hold of real Face ID prompts, FLAG_SECURE and iOS capture hiding, clipboard clearing. All are native behaviours; mockups show the intent.
- The sample recovery words are for the design only and are not a real wallet.

## Not designed in pass 1

Show-phrase re-authentication as its own step, the "not backed up" states, a wrong quiz answer and invalid-phrase errors, the passphrase step during restore, the speed-up and cancel review sheet, the other transaction states (included, finalized, unknown, replaced, reorged), token import and hide, account rename and hide, and the system Face ID prompt.

## Pass 2: start an agent (17 frames + icon)

Round 1: scan passed, but every frame rendered blank. The shared helper `review` was shadowed by the intent review function, and the scan does not flag empty screens. Renamed to `intentReview`; every frame is now opened and looked at.
Round 2: small-phone (375x667) overflow on the browser-check form, policy and allowance review. Fixed with container-query rules that hide the least important rows. Signed terms were never dropped. Contrast FAILs, the banned word "unlock" and a wrong provider name were fixed. Term values on the allowance approval are now right-aligned (q8).

Scores (13 lines): 11 of 13 at 4 or above. Lines 7 (richness) and 12 (feature test) stay at 3 on purpose: setup screens are forms and lists, and the richness sits in the seal and the stepper.
Deliberate warnings: "Only 3 text sizes" on the list and stepper screens. These are plain task screens, and a flat scale suits them.
Not verified: real-device feel, press-and-hold timing and haptics, New York on Android.

## Pass 3: run and stop an agent (13 frames)
Scan: no FAILs at 402x874 and 375x667. First round failed on the Stop button sitting under the tab bar (home indicator contrast); moved above the bar. All 13 frames opened and checked.
Self-score: 11 of 13 at 4 or above; richness (7) and feature test (12) stay at 3 on purpose. Warning kept: "Only 3 text sizes" on the stop-pending stepper.
Not verified: press-and-hold timing, push notification timing, real chain confirmation times. Sample data only.

## Pass 4: prove it (11 frames)
Round 1: every frame after the first rendered blank because helper names (`activity`, `payDetail`) collided with earlier sets; renamed with a `p4_` prefix. Round 2: on 375x667 the finding rows overflowed into the home indicator; reasons are hidden on the small phone only and stay on the detail screen.
Scan: no FAILs at both sizes. Warning kept: "Only 3 text sizes" on list screens.
Self-score: 11 of 13 at 4 or above; richness (7) and feature test (12) stay at 3 on purpose.
Not verified: real findings from the verifier (not built yet), share sheet, explorer links. Sample data only.

## Build review (iOS simulator, iPhone 17 Pro Max, dark mode)
Looked at: Welcome, Setup, Home, Agents, Settings, preview gallery, Fund, Lock, Allowance approval (also at accessibility-large text), Proof, Stop pending, Draft review. All render correctly; rows stack at large text; the pinned footer stays in view.
Not looked at one by one: the other preview screens (same blocks, typechecked). Not checked: a 375x667 phone (no small simulator installed), Android, VoiceOver and TalkBack, light mode on the new Home after the rewrite, the press-and-hold feel.
Changed after review: the hold-to-seal control now sits below the terms, so the terms are read before signing.
