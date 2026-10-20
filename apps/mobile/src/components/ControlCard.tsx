import { StyleSheet, Text, View } from "react-native";
import { findControl, type ControlId } from "../config/agentControls";
import { colors, space, type } from "../theme";
import { OutlineButton } from "./Button";
import { Card, DetailRow } from "./Card";
import { IconTile } from "./IconTile";
import { TaskStateChip } from "./TaskStateChip";

// One agent or owner control: what it does, where it acts (chain or service
// session), what happens to existing permissions, and its action. Every
// action is disabled until the native confirmation screen and a relay exist.
export function ControlCard({
  id,
  unavailableHint,
  signedAs,
}: {
  id: ControlId;
  // Overrides the default reason the action is unavailable.
  unavailableHint?: string;
  // The signed command type and its lifetime, e.g. "Admin command · up to
  // 30 minutes".
  signedAs?: string;
}) {
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
      {signedAs ? <DetailRow label="Signed as" value={signedAs} /> : null}
      <View style={styles.actions}>
        <OutlineButton
          label={control.action}
          icon={control.icon}
          disabled
          accessibilityHint={
            unavailableHint ??
            (control.onChain
              ? "Unavailable. Needs the owner key on this phone and the native confirmation screen."
              : "Unavailable. This build has no session with the Mandate service.")
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  label: { ...type.label, color: colors.textMuted },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1, gap: space.xs },
  afterwards: { gap: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
