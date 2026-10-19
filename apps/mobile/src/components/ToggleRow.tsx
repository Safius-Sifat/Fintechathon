import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, space, touchTarget, type } from "../theme";
import { Icon } from "./Icon";

interface ToggleRowProps {
  label: string;
  detail?: string;
  checked: boolean;
  onToggle: () => void;
}

// Checkbox row for multiple choices, e.g. the checks a task asks for.
export function ToggleRow({
  label,
  detail,
  checked,
  onToggle,
}: ToggleRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon
        name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
        size={24}
        color={checked ? colors.agent : colors.textSubtle}
      />
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xs,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  label: { ...type.bodyStrong, color: colors.ink },
  detail: { ...type.small, color: colors.textMuted },
});
