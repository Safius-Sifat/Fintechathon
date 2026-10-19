import { StyleSheet, Text, View } from "react-native";
import type { CapabilityState } from "../config/capabilities";
import { colors, radius, space, tones, type } from "../theme";
import { Icon, type IconName } from "./Icon";

// State is always spelled out in text; color and icon only reinforce it.
const TAGS: Record<
  CapabilityState,
  { label: string; icon: IconName; fg: string; bg: string }
> = {
  configured: {
    label: "Configured",
    icon: "check-circle-outline",
    fg: tones.green.fg,
    bg: tones.green.bg,
  },
  notBuilt: {
    label: "Not available yet",
    icon: "progress-clock",
    fg: colors.textMuted,
    bg: colors.surfaceMuted,
  },
  notConnected: {
    label: "Not connected",
    icon: "link-variant-off",
    fg: colors.textMuted,
    bg: colors.surfaceMuted,
  },
  unavailable: {
    label: "Unavailable",
    icon: "cloud-off-outline",
    fg: tones.amber.fg,
    bg: tones.amber.bg,
  },
};

export function statusLabel(state: CapabilityState) {
  return TAGS[state].label;
}

interface StatusTagProps {
  state: CapabilityState;
  label?: string;
  // Translucent variant for use on the dark hero card.
  onDark?: boolean;
}

export function StatusTag({ state, label, onDark }: StatusTagProps) {
  const tag = TAGS[state];
  const fg = onDark ? colors.onDark : tag.fg;
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: onDark ? colors.heroFill : tag.bg },
      ]}
    >
      <Icon name={tag.icon} size={14} color={fg} />
      <Text style={[styles.label, { color: fg }]}>{label ?? tag.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  label: { ...type.label },
});
