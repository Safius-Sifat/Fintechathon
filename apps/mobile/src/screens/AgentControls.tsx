import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { IconTile } from "../components/IconTile";
import { Screen } from "../components/Screen";
import { TaskStateChip } from "../components/TaskStateChip";
import { findControl, type ControlId } from "../config/agentControls";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// The separate ways to stop or limit agents (plan S9.6). Each control says
// what it does to existing permissions. The agent wallet's state comes only
// from confirmed chain data, which this build cannot read, so no agent is
// ever shown as stopped. Every control needs the owner key and the native
// confirmation screen, or the Mandate service, so all are unavailable.

type Props = NativeStackScreenProps<RootStackParamList, "AgentControls">;

const GROUPS: readonly {
  title: string;
  ids: readonly ControlId[];
}[] = [
  { title: "Temporary stop", ids: ["freeze", "unfreeze"] },
  { title: "End permissions", ids: ["pause", "revoke"] },
  { title: "This phone's session", ids: ["logout"] },
];

export function AgentControlsScreen({ navigation }: Props) {
  return (
    <Screen
      title="Agent controls"
      subtitle="Each control does something different to your agents."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <Text style={styles.cardTitle}>Agent wallet now</Text>
        <DetailRow label="Account" value="No account yet" muted />
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
        <DetailRow label="Frozen" value="Unavailable" muted />
        <DetailRow label="Paused" value="Unavailable" muted />
        <DetailRow label="Service hold" value="Unavailable" muted />
        <Text style={styles.caption}>
          Read from confirmed chain state and the Mandate service. This build
          cannot read either, so it never shows an agent as stopped.
        </Text>
      </Card>

      <Banner
        icon="timer-sand"
        title="A stop counts once it is confirmed"
        body="Freeze, pause and revoke take effect when their transaction is confirmed on chain. Payments sent before that may still settle."
      />

      {GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <SectionTitle>{group.title}</SectionTitle>
          {group.ids.map((id) => (
            <ControlCard key={id} id={id} />
          ))}
        </View>
      ))}

      <Text style={styles.caption}>
        Sending funds out of the agent wallet with an owner transfer also pauses
        agents and ends their permissions.
      </Text>
    </Screen>
  );
}

function ControlCard({ id }: { id: ControlId }) {
  const control = findControl(id);
  return (
    <Card>
      <View style={styles.head}>
        <IconTile icon={control.icon} tone={control.tone} />
        <View style={styles.headText}>
          <Text style={styles.cardTitle}>{control.title}</Text>
          <TaskStateChip
            info={{
              label: control.onChain
                ? "Acts on chain"
                : "Acts on the service session",
              group: "ended",
            }}
            icon={control.onChain ? "link-variant" : "cellphone-key"}
          />
        </View>
      </View>
      <Text style={styles.body}>{control.effect}</Text>
      <View style={styles.afterwards}>
        <Text style={styles.label}>Existing permissions</Text>
        <Text style={styles.body}>{control.afterwards}</Text>
      </View>
      <View style={styles.actions}>
        <OutlineButton
          label={control.action}
          icon={control.icon}
          disabled
          accessibilityHint={
            control.onChain
              ? "Unavailable. Needs the owner key on this phone and the native confirmation screen."
              : "Unavailable. This build has no session with the Mandate service."
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  caption: { ...type.small, color: colors.textMuted },
  label: { ...type.label, color: colors.textMuted },
  group: { gap: space.lg },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1, gap: space.xs },
  afterwards: { gap: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
