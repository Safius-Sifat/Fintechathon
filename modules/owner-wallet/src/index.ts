import { requireOptionalNativeModule } from "expo";

// Public build and library metadata only. The module never returns recovery
// words, seeds or keys.
export interface NativeStatus {
  platform: "android";
  walletCoreVersion: string;
  walletCoreLoaded: boolean;
  keccakSelfTest: boolean;
  ethereumDerivationPath: string | null;
  error: string | null;
}

interface OwnerWalletNativeModule {
  getNativeStatus(): Promise<NativeStatus>;
}

const native =
  requireOptionalNativeModule<OwnerWalletNativeModule>("OwnerWallet");

// Resolves to null when this build does not contain the native module.
export async function getNativeStatus(): Promise<NativeStatus | null> {
  return native ? native.getNativeStatus() : null;
}
