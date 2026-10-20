import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
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

interface PrimaryButtonProps {
  label: string;
  icon?: IconName;
  disabled?: boolean;
  // Read by screen readers; explains why a disabled action is unavailable.
  accessibilityHint?: string;
  onPress?: () => void;
}

// Full-width dark pill for the main action of a flow step.
export function PrimaryButton({
  label,
  icon = "arrow-right",
  disabled = false,
  accessibilityHint,
  onPress,
}: PrimaryButtonProps) {
  const fg = disabled ? colors.textDisabled : colors.onDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: "rgba(255, 255, 255, 0.16)" }}
      style={({ pressed }) => [
        styles.primary,
        disabled && styles.primaryDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.primaryLabel, { color: fg }]}>{label}</Text>
      <Icon name={icon} size={20} color={fg} />
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

interface OutlineButtonProps {
  label: string;
  icon: IconName;
  disabled?: boolean;
  // Read by screen readers; explains why a disabled action is unavailable.
  accessibilityHint?: string;
  onPress?: () => void;
}

// Light secondary pill on cards, e.g. Copy and Share.
export function OutlineButton({
  label,
  icon,
  disabled = false,
  accessibilityHint,
  onPress,
}: OutlineButtonProps) {
  const fg = disabled ? colors.textDisabled : colors.ink;
  // The minimum width grows with the text size, so side-by-side buttons
  // wrap onto their own rows instead of breaking a label mid-word.
  const { fontScale } = useWindowDimensions();
  const minWidth = OUTLINE_MIN_WIDTH * Math.max(1, fontScale);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outline,
        { minWidth },
        disabled && styles.outlineDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={18} color={fg} />
      <Text style={[styles.outlineLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const OUTLINE_MIN_WIDTH = 120;

const styles = StyleSheet.create({
  outline: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  outlineDisabled: { backgroundColor: colors.surfaceMuted },
  outlineLabel: { ...type.bodyStrong, textAlign: "center", flexShrink: 1 },
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
    overflow: "hidden",
  },
  primaryDisabled: { backgroundColor: colors.surfaceMuted, boxShadow: "none" },
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
