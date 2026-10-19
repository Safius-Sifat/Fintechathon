package com.mandate.ownerwallet

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import wallet.core.jni.CoinType
import wallet.core.jni.Hash

class OwnerWalletModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OwnerWallet")

    AsyncFunction("getNativeStatus") { WalletCoreProbe.run().toBridgeMap() }
  }
}

internal data class WalletCoreStatus(
    val loaded: Boolean,
    val keccakSelfTest: Boolean,
    val ethereumDerivationPath: String?,
    val error: String?,
)

// Loads the Wallet Core JNI library once and checks that it computes: keccak256
// of empty input against the published constant, and Wallet Core's own default
// Ethereum derivation path. Touches no keys.
internal object WalletCoreProbe {
  private const val KECCAK256_EMPTY =
      "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"

  private val status: WalletCoreStatus by lazy { probe() }

  fun run(): WalletCoreStatus = status

  private fun probe(): WalletCoreStatus {
    try {
      System.loadLibrary("TrustWalletCore")
    } catch (e: UnsatisfiedLinkError) {
      return WalletCoreStatus(false, false, null, describe(e))
    }
    return try {
      val digest = Hash.keccak256(ByteArray(0)).joinToString("") { "%02x".format(it) }
      WalletCoreStatus(true, digest == KECCAK256_EMPTY, CoinType.ETHEREUM.derivationPath(), null)
    } catch (e: UnsatisfiedLinkError) {
      WalletCoreStatus(true, false, null, describe(e))
    }
  }

  private fun describe(e: Throwable) = "${e.javaClass.simpleName}: ${e.message}"
}

internal fun WalletCoreStatus.toBridgeMap(): Map<String, Any?> =
    mapOf(
        "platform" to "android",
        "walletCoreVersion" to BuildConfig.WALLET_CORE_VERSION,
        "walletCoreLoaded" to loaded,
        "keccakSelfTest" to keccakSelfTest,
        "ethereumDerivationPath" to ethereumDerivationPath,
        "error" to error,
    )
