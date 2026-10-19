import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, space, touchTarget, type } from "../theme";
import { Icon, type IconName } from "./Icon";

interface HeroActionProps {
  label: string;
  icon: IconName;
  disabled?: boolean;
  // Read by screen readers; explains why a disabled action is unavailable.
  accessibilityHint?: string;
  onPress?: () => void;
}

// Pill action on the dark hero card.
export function HeroAction({
  label,
  icon,
  disabled = false,
  accessibilityHint,
  onPress,
}: HeroActionProps) {
  const fg = disabled ? colors.onDarkDisabled : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: "rgba(15, 23, 42, 0.12)" }}
      style={[styles.action, disabled ? styles.disabled : styles.enabled]}
    >
      <Icon name={icon} size={18} color={fg} />
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 120,
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  enabled: { backgroundColor: colors.onDark },
  disabled: {
    backgroundColor: colors.heroFill,
    borderWidth: 1,
    borderColor: colors.heroLine,
  },
  label: { ...type.bodyStrong, textAlign: "center", flexShrink: 1 },
});
