import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, shadows, space, touchTarget, type } from "../theme";
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

interface PrimaryButtonProps {
  label: string;
  icon?: IconName;
  accessibilityHint?: string;
  onPress: () => void;
}

// Full-width dark pill for the main action of a flow step.
export function PrimaryButton({
  label,
  icon = "arrow-right",
  accessibilityHint,
  onPress,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      android_ripple={{ color: "rgba(255, 255, 255, 0.16)" }}
      style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
      <Icon name={icon} size={20} color={colors.onDark} />
    </Pressable>
  );
}

interface TextButtonProps {
  label: string;
  accessibilityHint?: string;
  onPress: () => void;
}

// Secondary action shown as plain text under a primary button.
export function TextButton({
  label,
  accessibilityHint,
  onPress,
}: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.text, pressed && styles.pressed]}
    >
      <Text style={styles.textLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    boxShadow: shadows.hero,
    overflow: "hidden",
  },
  primaryLabel: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.onDark,
    textAlign: "center",
    flexShrink: 1,
  },
  text: {
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  textLabel: {
    ...type.bodyStrong,
    color: colors.textMuted,
    textAlign: "center",
  },
  pressed: { opacity: 0.85 },
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
