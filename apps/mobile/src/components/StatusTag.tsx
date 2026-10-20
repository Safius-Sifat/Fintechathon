import { Text, View } from "react-native";
import type { CapabilityState } from "../config/capabilities";
import { radius, space, type, makeStyles, useColors } from "../theme";
import { Icon, type IconName } from "./Icon";

// State is always spelled out in text; color and icon only reinforce it.
const LABELS: Record<CapabilityState, { label: string; icon: IconName }> = {
  configured: { label: "Configured", icon: "check-circle-outline" },
  notBuilt: { label: "Not available yet", icon: "progress-clock" },
  notConnected: { label: "Not connected", icon: "link-variant-off" },
  unavailable: { label: "Unavailable", icon: "cloud-off-outline" },
};

export function statusLabel(state: CapabilityState) {
  return LABELS[state].label;
}

interface StatusTagProps {
  state: CapabilityState;
  label?: string;
  // Translucent variant for use on the dark hero card.
  onDark?: boolean;
}

export function StatusTag({ state, label, onDark }: StatusTagProps) {
  const colors = useColors();
  const styles = useStyles();
  const tag = LABELS[state];
  const fg = onDark ? colors.onInk : colors.ink2;
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: onDark ? colors.inkFill : colors.tile },
      ]}
    >
      <Icon name={tag.icon} size={14} color={fg} />
      <Text style={[styles.label, { color: fg }]}>{label ?? tag.label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  // Wraps inside the tag at large text sizes instead of overflowing it.
  label: { ...type.label, flexShrink: 1 },
}));
