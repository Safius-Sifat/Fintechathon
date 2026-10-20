import { Pressable, Text, useWindowDimensions } from "react-native";
import {
  radius,
  space,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../theme";
import { Icon, type IconName } from "./Icon";

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
  const colors = useColors();
  const styles = useStyles();
  const fg = disabled ? colors.ink4 : colors.onInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: colors.rippleOnInk }}
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
  const styles = useStyles();
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
  const colors = useColors();
  const styles = useStyles();
  const fg = disabled ? colors.ink4 : colors.ink;
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

const useStyles = makeStyles((colors) => ({
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
    borderColor: colors.rule,
    backgroundColor: colors.raised,
  },
  outlineDisabled: { backgroundColor: colors.tile },
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
  primaryDisabled: { backgroundColor: colors.tile, boxShadow: "none" },
  primaryLabel: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.onInk,
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
    color: colors.ink2,
    textAlign: "center",
  },
  pressed: { opacity: 0.85 },
}));
