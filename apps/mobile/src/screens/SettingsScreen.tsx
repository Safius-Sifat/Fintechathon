import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { CapabilityRow } from "../components/CapabilityRow";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import {
  connectionCapabilities,
  securityCapabilities,
  type Capability,
} from "../config/capabilities";
import { network } from "../config/network";
import type {
  RootStackParamList,
  TabParamList,
} from "../navigation/RootNavigator";
import {
  nativeModuleCapability,
  useNativeModuleState,
} from "../state/nativeStatus";

const NETWORK_ROW: Capability = {
  id: "network",
  title: network.name,
  detail: `Chain ID ${network.chainId}${network.isTestnet ? " · Testnet" : ""}`,
  icon: "access-point-network",
  tone: "blue",
  state: "configured",
};

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Settings">,
  NativeStackScreenProps<RootStackParamList>
>;

export function SettingsScreen({ navigation }: Props) {
  const nativeModule = nativeModuleCapability(useNativeModuleState());
  return (
    <Screen
      title="Settings"
      subtitle="What this build can and cannot do. Nothing is marked available until it works."
    >
      <SectionTitle>Network</SectionTitle>
      <Card>
        <CapabilityRow capability={NETWORK_ROW} />
      </Card>

      <SectionTitle>Wallet security</SectionTitle>
      <Card>
        <CapabilityRow capability={nativeModule} />
        {securityCapabilities.map((capability) => (
          <CapabilityRow key={capability.id} capability={capability} />
        ))}
      </Card>
      <NavRow
        icon="key-chain-variant"
        tone="blue"
        label="Recovery and backup"
        value="Restore your wallet; recover agent funds"
        accessibilityHint="Opens recovery and backup"
        onPress={() => navigation.navigate("Recovery")}
      />

      <SectionTitle>Connections</SectionTitle>
      <Card>
        {connectionCapabilities.map((capability) => (
          <CapabilityRow key={capability.id} capability={capability} />
        ))}
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card>
        <DetailRow label="Build" value="Development preview" />
        <DetailRow label="Milestone" value="P3-01 checkpoint 1" />
      </Card>
    </Screen>
  );
}
