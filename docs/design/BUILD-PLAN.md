# Build plan: Mandate app redesign

Decisions agreed: Agents is a fourth tab; DemoUSD is the hero number; bundle a serif for both platforms; no marketplace; export the seal "M" as the icon; merge PR #40 first; screens scroll on small phones and never hide signed terms.

Rules for every PR: Conventional Commits, no co-author trailer, `make check-mobile` passes, a screen whose backend or native signer does not exist shows an explicit "not available" state (never fake data), no secrets in logs. Existing code: `apps/mobile/src/{theme.ts,components,screens,navigation}`; tabs today are Home, Activity, Settings.

| # | PR | What changes | Done when |
|---|---|---|---|
| 0 | Merge PR #40 | Welcome includes how-it-works. Merge it first. | Merged to main. |
| 1 | Tokens and fonts | Replace `theme.ts` colours with the design tokens (light and dark), add the type scale, bundle one serif via `expo-font`, remove the gradients and amber/blue split. | App builds and renders with new tokens; tests pass. |
| 2 | Core components | Rework Button, Row, Banner, StatusTag, Screen and add Seal, Stepper, Sheet, Field to match `source/wallet.html`. | Storybook-free: a dev-only screen shows each component. |
| 3 | Wallet shell | Home (DemoUSD hero, tokens), token detail, Receive, Send, Review, Activity with You/Agent labels, Settings. | Matches the wallet sheet; personal send flow unchanged in behaviour. |
| 4 | Fourth tab: Agents | Add the Agents tab and an empty state that says what is not available yet. | Tab shows honest unavailable state when no agent wallet exists. |
| 5 | Wallet creation and recovery | Create, recovery phrase, quiz, passphrase, import, lock, backup (pass 1). Native module only, no seed in JS. | Works on the Android build; iOS shows unavailable until P3-X01. |
| 6 | Start an agent (UI) | Agent wallet intro, provisioning stepper, fund, intent compose and review, four task forms, wallet limits, allowance approval (pass 2). Behind capability flags. | Each screen renders real data or an explicit unavailable state. |
| 7 | Run and stop | Running task, approval request, needs-you, task done, stop choices, pause review, pending and confirmed stop, freeze, offline stop (pass 3). | Stop shows pending until the chain confirms. |
| 8 | Prove it | Proof with six findings, finding detail, export, independent check, decisions record (pass 4). | Needs the verifier (P4-05); until then shows unavailable. |
| 9 | Icon and polish | Export the seal "M" icon, small-phone scroll checks, accessibility sizes, dark mode pass. | Checked on device or simulator; limits stated. |

Order: 0, 1, 2, 3 are independent of backend work and come first. 5 to 8 depend on Person 2, 3 and 4 deliverables; coordinate through Person 1 before building them.

## Status after PR #42 (merged)
Done: design tokens, bundled Newsreader serif, Seal, Page and shared blocks, redesigned Welcome, Agents tab with explicit unavailable states, seal icon, and about 45 layout screens behind the development-only sample preview (`apps/mobile/src/screens/preview/`). Mobile typecheck and tests pass. Only some screens were looked at in the iOS simulator.

## Remaining work

Two kinds. Part A can be done now by one person in one branch. Part B needs a capability that does not exist yet; each item must be built together with it, because the repo rules forbid fake results (`preview` flags in `apps/mobile/src/config/capabilities.ts` stay false until the code behind them works).

### Part A: doable now, one branch `feat/mobile-redesign-finish`
| # | Work | Done when |
|---|---|---|
| A1 | Look at every preview screen in the simulator at 440 wide and 375x667, fix overflow, clipping and the press-and-hold layout | Each screen opened and noted in `docs/design/CRITIQUE.md`; fixes committed |
| A2 | Restyle older screens (Home, Accounts, Receive, Send, TransferReview, Scan, Activity) with the new Page, Row and Seal blocks; keep behaviour unchanged | Screens match `docs/design/source/wallet.html`; existing tests pass |
| A3 | Dark mode: replace static `colors` with a theme hook (`useTheme`) driven by the system setting; dark tokens from `DIRECTION.md` | Every screen readable in both themes; status bar follows |
| A4 | Android adaptive icon (foreground seal on the ground colour) and iOS icon check in `app.json` | Icon shows correctly on both launchers |
| A5 | Accessibility pass: large text (stacked rows), VoiceOver and TalkBack labels on blocks, 44/48 point targets | Checked at 130% text on both platforms; gaps listed |
| A6 | Tests: render tests for Page, Row, Steps, FindingRow and the hold-to-seal timing (cancel early signs nothing) | Tests in `apps/mobile/test`, run by `make check-mobile` |

### Part B: needs other work first (build each with its capability)
| # | Screen group | Needs | Owner and plan task |
|---|---|---|---|
| B1 | Wallet creation, recovery phrase, quiz, passphrase, import | Native secure screens, no seed in JavaScript | Person 3, P3-01 and P3-W01 |
| B2 | Lock and backup status with real state | Native lock and backup state | Person 3, P3-W01 |
| B3 | Real Home, Receive, Send, Review, Activity, transaction detail | Wallet, assets and history API, signing | Person 3 P3-W02, Person 2 API |
| B4 | Agent wallet creation, funding, intent compose and review, four task forms | Mandate service, provisioning, `/v1/intents/compile` | Person 2, with Person 3 P3-03 |
| B5 | Wallet limits, allowance approval, approvals and alerts | Policy relay, native signing of Permit and Approval | Person 3 P3-A01 and P3-A02 |
| B6 | Run, stop, pause, freeze, offline stop | Admin signing and chain reads | Person 3 P3-05 |
| B7 | Proof, export, independent check, decisions | Evidence API and the verifier | Person 4 P4-05, Person 3 P3-04 |
| B8 | iOS | Native iOS module | Person 3 P3-X01 |

How each B item lands: replace the sample props in its preview screen with real view models from the API or native module, register the real route, set the matching `preview` flag only when it works, add it to `make check-mobile`, and remove the sample entry from the gallery. Changes to shared schema or API contracts go through Person 1.

Order: A1 to A6 first (one PR), then B1 and B2, B3, B4 and B5, B6, B7, B8 as their owners land them.

## Fast path (decided 2026-10-20)
Part B no longer waits for native code. The wallet is built in TypeScript with Expo and npm packages (viem, @scure/bip39, expo-secure-store, expo-local-authentication). Steps J1 to J6 are in `docs/plans/03 - Android Owner Wallet.md`, section "Fast path (v7.2)". J1 to J3 and J5 need no Mandate backend; J4 uses the existing auth API; J6 waits for Person 2 and Person 4.
