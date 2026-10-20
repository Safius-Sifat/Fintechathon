import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Row, Rows, SectionHeading } from "../components/blocks";
import { Screen } from "../components/Screen";
import { statusLabel } from "../components/StatusTag";
import {
  connectionCapabilities,
  securityCapabilities,
  type Capability,
} from "../config/capabilities";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  nativeModuleCapability,
  useNativeModuleState,
} from "../state/nativeStatus";

function CapabilityRows({ items }: { items: readonly Capability[] }) {
  return (
    <Rows>
      {items.map((c) => (
        <Row
          key={c.id}
          label={c.title}
          detail={c.detail}
          value={c.stateLabel ?? statusLabel(c.state)}
        />
      ))}
    </Rows>
  );
}

export function SettingsScreen() {
  const nativeModule = nativeModuleCapability(useNativeModuleState());
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Screen title="Settings">
      <SectionHeading>Security</SectionHeading>
      <CapabilityRows items={[nativeModule, ...securityCapabilities]} />

      <SectionHeading>Connections</SectionHeading>
      <CapabilityRows items={connectionCapabilities} />

      <SectionHeading>Network</SectionHeading>
      <Rows>
        <Row
          label={network.name}
          detail={`Chain ${network.chainId}${network.isTestnet ? ". Test network only." : ""}`}
          value="Configured"
        />
      </Rows>

      {__DEV__ ? (
        <>
          <SectionHeading>Development</SectionHeading>
          <Rows>
            <Row
              label="Design preview"
              detail="Sample-data screens for review"
              onPress={() => navigation.navigate("PreviewIndex")}
            />
          </Rows>
        </>
      ) : null}

      <SectionHeading>About</SectionHeading>
      <Rows>
        <Row label="Build" value="Development preview" />
        <Row label="Milestone" value="P3-01 checkpoint 1" />
      </Rows>
    </Screen>
  );
}
