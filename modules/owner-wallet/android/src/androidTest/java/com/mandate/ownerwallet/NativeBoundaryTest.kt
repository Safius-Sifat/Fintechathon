package com.mandate.ownerwallet

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

// P3-01.T01 (partial): the Wallet Core JNI library loads on the device and the
// bridge status carries public metadata only.
@RunWith(AndroidJUnit4::class)
class NativeBoundaryTest {
  @Test
  fun P3_01_T01_walletCoreLoadsAndComputes() {
    val status = WalletCoreProbe.run()
    assertTrue("Wallet Core JNI library did not load: ${status.error}", status.loaded)
    assertTrue("keccak256 known-answer test failed", status.keccakSelfTest)
    assertEquals("m/44'/60'/0'/0/0", status.ethereumDerivationPath)
    assertNull(status.error)
  }

  @Test
  fun P3_01_T01_bridgeStatusHasOnlyPublicFields() {
    val keys = WalletCoreProbe.run().toBridgeMap().keys
    assertEquals(
        setOf(
            "platform",
            "walletCoreVersion",
            "walletCoreLoaded",
            "keccakSelfTest",
            "ethereumDerivationPath",
            "error",
        ),
        keys,
    )
  }
}
