import { StyleSheet, Text, View } from "react-native";
import type { StateGroup, StateInfo } from "../config/taskStatus";
import { radius, space, tones, type, type Tone } from "../theme";
import { Icon, type IconName } from "./Icon";

const GROUP_STYLE: Record<StateGroup, { tone: Tone; icon: IconName }> = {
  waiting: { tone: "slate", icon: "clock-outline" },
  attention: { tone: "amber", icon: "account-alert-outline" },
  active: { tone: "blue", icon: "progress-clock" },
  done: { tone: "green", icon: "check-circle-outline" },
  ended: { tone: "slate", icon: "stop-circle-outline" },
  problem: { tone: "red", icon: "alert-circle-outline" },
  unknown: { tone: "amber", icon: "help-circle-outline" },
};

// One task-related state (outcome, authority, payment, delivery or schedule
// period). The label always spells the state out; colour and icon only
// reinforce it.
export function TaskStateChip({
  info,
  icon: iconOverride,
}: {
  info: StateInfo;
  icon?: IconName;
}) {
  const { tone, icon: groupIcon } = GROUP_STYLE[info.group];
  const icon = iconOverride ?? groupIcon;
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      <Icon name={icon} size={14} color={t.fg} />
      <Text style={[styles.label, { color: t.fg }]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  // Android can measure a short bold label slightly narrower than it draws
  // (seen with the "ff" in "Allowlist off"), clipping its last word; the
  // end padding leaves room for that.
  label: { ...type.label, flexShrink: 1, paddingEnd: 2 },
});
