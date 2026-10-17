# Native owner-wallet boundary — Person3

Implement Kotlin/Wallet Core JNI owner create/import/backup, authenticated Keystore seed wrapping, native scope validation/confirmation and typed Login/Permit/Admin signing. Use the exact bridge in your handoff. No seed/private key crosses React Native bridge; no raw-sign method; no embedded-provider signing substitute.

No native signing module is supplied by this bootstrap. `apps/mobile` currently displays foundation status only. Native Android build/Wallet Core integration is the G1 gate; do not treat opening Metro as wallet readiness. Android12+ physical device required for acceptance.
