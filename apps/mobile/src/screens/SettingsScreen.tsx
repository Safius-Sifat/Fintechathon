import { Card, DetailRow, SectionTitle } from "../components/Card";
import { CapabilityRow } from "../components/CapabilityRow";
import { Screen } from "../components/Screen";
import { Row, Rows } from "../components/blocks";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  connectionCapabilities,
  securityCapabilities,
  type Capability,
} from "../config/capabilities";
import { network } from "../config/network";
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

export function SettingsScreen() {
  const nativeModule = nativeModuleCapability(useNativeModuleState());
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

      <SectionTitle>Connections</SectionTitle>
      <Card>
        {connectionCapabilities.map((capability) => (
          <CapabilityRow key={capability.id} capability={capability} />
        ))}
      </Card>

      {__DEV__ ? (
        <>
          <SectionTitle>Development</SectionTitle>
          <Rows>
            <Row
              label="Design preview"
              detail="Sample-data screens for review"
              onPress={() => navigation.navigate("PreviewIndex")}
            />
          </Rows>
        </>
      ) : null}

      <SectionTitle>About</SectionTitle>
      <Card>
        <DetailRow label="Build" value="Development preview" />
        <DetailRow label="Milestone" value="P3-01 checkpoint 1" />
      </Card>
    </Screen>
  );
}
