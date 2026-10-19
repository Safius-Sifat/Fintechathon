import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space, touchTarget, type } from "../theme";

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  // Second line under the label, e.g. a connection state.
  detail?: string;
  disabled?: boolean;
}

interface SegmentedProps<K extends string> {
  label: string;
  options: readonly SegmentOption<K>[];
  selected: K;
  onSelect: (key: K) => void;
}

// Labelled single-choice control. Options wrap onto new rows at large text.
export function Segmented<K extends string>({
  label,
  options,
  selected,
  onSelect,
}: SegmentedProps<K>) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {options.map((option) => {
          const isSelected = option.key === selected;
          const disabled = option.disabled === true;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityHint={option.detail}
              disabled={disabled}
              onPress={() => onSelect(option.key)}
              style={[styles.item, isSelected && styles.itemSelected]}
            >
              <Text
                style={[
                  styles.text,
                  isSelected && styles.textSelected,
                  disabled && styles.textDisabled,
                ]}
              >
                {option.label}
              </Text>
              {option.detail ? (
                <Text style={[styles.detail, disabled && styles.textDisabled]}>
                  {option.detail}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  label: { ...type.label, color: colors.textMuted },
  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  item: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 120,
    minHeight: touchTarget - space.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  itemSelected: {
    backgroundColor: colors.surface,
    boxShadow: "0px 1px 4px rgba(15, 23, 42, 0.10)",
  },
  text: { ...type.bodyStrong, color: colors.textMuted, textAlign: "center" },
  textSelected: { color: colors.ink },
  textDisabled: { color: colors.textDisabled },
  detail: { ...type.small, color: colors.textMuted, textAlign: "center" },
});
