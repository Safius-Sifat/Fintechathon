import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, space, type, type Tone } from "../theme";
import { Icon, type IconName } from "./Icon";
import { IconTile } from "./IconTile";

interface NavRowProps {
  icon: IconName;
  tone: Tone;
  label: string;
  value: string;
  // Extra line or tag under the value.
  footer?: ReactNode;
  accessibilityHint?: string;
  onPress: () => void;
}

// Tappable card row that opens another screen.
export function NavRow({
  icon,
  tone,
  label,
  value,
  footer,
  accessibilityHint,
  onPress,
}: NavRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${value}.`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      android_ripple={{ color: "rgba(15, 23, 42, 0.06)" }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <IconTile icon={icon} tone={tone} size={40} />
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
        {footer}
      </View>
      <Icon name="chevron-right" size={24} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: shadows.card,
    overflow: "hidden",
  },
  pressed: { opacity: 0.85 },
  text: { flex: 1, gap: 2 },
  label: { ...type.label, color: colors.textMuted },
  value: { ...type.bodyStrong, color: colors.ink },
});
