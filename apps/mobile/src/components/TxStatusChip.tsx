import { StyleSheet, Text, View } from "react-native";
import {
  GROUP_INFO,
  STATE_LABELS,
  statusGroup,
  type StatusGroup,
  type TxState,
} from "../config/txStatus";
import { radius, space, tones, type, type Tone } from "../theme";
import { Icon, type IconName } from "./Icon";

const GROUP_STYLE: Record<StatusGroup, { tone: Tone; icon: IconName }> = {
  pending: { tone: "blue", icon: "clock-outline" },
  confirmed: { tone: "green", icon: "check-circle-outline" },
  failed: { tone: "red", icon: "alert-circle-outline" },
  replaced: { tone: "slate", icon: "swap-horizontal" },
  unknown: { tone: "amber", icon: "help-circle-outline" },
};

type ChipProps = { state: TxState } | { group: StatusGroup };

// Group colour and icon reinforce the text; the label always says the state
// (or the group name in the status guide).
export function TxStatusChip(props: ChipProps) {
  const group = "state" in props ? statusGroup(props.state) : props.group;
  const label =
    "state" in props ? STATE_LABELS[props.state] : GROUP_INFO[group].title;
  const { tone, icon } = GROUP_STYLE[group];
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      <Icon name={icon} size={14} color={t.fg} />
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
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
  label: { ...type.label, flexShrink: 1 },
});
