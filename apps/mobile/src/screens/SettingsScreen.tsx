import { Card, DetailRow, SectionTitle } from "../components/Card";
import { CapabilityRow } from "../components/CapabilityRow";
import { Screen } from "../components/Screen";
import {
  connectionCapabilities,
  securityCapabilities,
  type Capability,
} from "../config/capabilities";
import { network } from "../config/network";

const NETWORK_ROW: Capability = {
  id: "network",
  title: network.name,
  detail: `Chain ID ${network.chainId}${network.isTestnet ? " · Testnet" : ""}`,
  icon: "access-point-network",
  tone: "blue",
  state: "configured",
};

export function SettingsScreen() {
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

      <SectionTitle>About</SectionTitle>
      <Card>
        <DetailRow label="Build" value="UI preview" />
        <DetailRow label="Milestone" value="UI-01.1" />
      </Card>
    </Screen>
  );
}
