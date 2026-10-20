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

## Status (one branch, `feat/mobile-tokens-fonts`, PR #42)
Built:
- Design tokens and the bundled Newsreader serif; the seal, Page and shared building blocks; redesigned Welcome; the fourth Agents tab with explicit "not available yet" states; the seal app icon.
- Every designed screen from passes 1 to 4 that can exist without a secret, as layout components in `apps/mobile/src/screens/preview/`: lock, backup status, contacts, transaction detail, network, help; agent setup (intro, provisioning, wallet, fund, compose, draft review, chooser, four task forms, allowance approval, wallet limits and their effects, providers); run and stop (running, why, approval, needs you, done, agent home with alert, stop choices, pause review, pending, confirmed, freeze, offline stop, sign-out); proof (activity by who, payment and owner transfer detail, proof, running proof, three finding details, export, independent check, decisions).
- They are reachable only in development builds, from Settings, Design preview, and show labelled sample data. The route does not exist in release builds.

Not built, because the capability behind each does not exist yet (`preview` flags in `apps/mobile/src/config/capabilities.ts` are all false, and the repo rules forbid fake results): the real data and actions behind those screens (owner key, signing, the Mandate service, agent wallet, verifier). The recovery phrase, quiz and passphrase screens are native secure screens by rule and are not in JavaScript at all.

Also not done: dark mode (components read static colours), Android adaptive icon, restyling every older screen against the mockups, device checks beyond the iOS simulator.
