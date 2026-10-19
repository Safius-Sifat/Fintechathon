# Native owner-wallet boundary — Person3

Expo module with the owner's recovery words, accounts, encrypted seed storage, native confirmation and typed signing (handoff 03, S8.6). No seed, recovery word or private key crosses the React Native bridge; there is no raw-sign method and no embedded-provider signing substitute.

## Current state (P3-01 checkpoint 1)

- Android Gradle project `:owner-wallet`, autolinked into `apps/mobile` as the workspace package `@mandate/owner-wallet`.
- Trust Wallet Core `com.trustwallet:wallet-core:4.8.4` (Apache-2.0). `app.plugin.js` adds its GitHub Packages repository; see `docs/mobile-build.md` for the build credential.
- One bridge call, `getNativeStatus()`: whether the Wallet Core JNI library loaded, a keccak256 known-answer self-test, Wallet Core's default Ethereum derivation path and the pinned version. It returns public metadata only.
- Not built yet: wallet creation, recovery words, seed storage, unlock and signing. iOS (Swift) comes with P3-X01.

Physical Android 12+ phone acceptance is still required; emulator results are local only.
