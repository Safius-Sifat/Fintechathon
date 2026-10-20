# Open decisions

Consolidation notes (all five sets in `source/`):
- Tokens: identical in every set (ground #E8ECEB, ink #14191C, wax #8F2A2E, dark variants, radii, type scale).
- Sample data: one story throughout. The agent checks the demo shop checkout; providers are Tessel Checks (0.40) and Northgate Probes (0.55); task budget 3.00 DUSD, 1.00 per payment; wallet limits 2.00 per payment, 20.00 a day, 60.00 a week; wallet funded with 50.00 DUSD. The earlier freight-quote story is gone.
- All sets pass the scan at 402x874 and 375x667.

Decisions for you:
1. **Agents tab.** Agents is a fourth tab beside Wallet, Activity and Settings. Keep it, or fold agents into Wallet?
2. **Hero number.** DemoUSD balance is the hero because there is no price data. Keep that, or show a display total later?
3. **Serif font.** The voice uses New York, which is iOS only. Bundle a serif for Android (licence and size), or accept the system serif?
4. **Marketplace.** Providers are shown as manifest facts with a delivery record, with no ratings and no marketplace. Confirm that stays out of scope.
5. **App icon.** The seal "M" is drawn in `source/pass2.html`. Export it as the real icon file when the build starts?
6. **PR #40.** The Welcome change on `work/mobile-onboarding-direct` is still open. Merge before the redesign build?
7. **Small phones.** On 375x667 some reasons and notes are hidden to fit. Accept this, or make those screens scroll?

Blocked by missing backends (screens must fail explicitly until real): intent compile, agent wallet provisioning, questions and approvals API, verifier (P4-05), iOS native module (P3-X01).
