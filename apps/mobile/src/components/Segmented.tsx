import { Pressable, Text, View } from "react-native";
import {
  makeStyles,
  radius,
  shadows,
  space,
  touchTarget,
  type,
} from "../theme";

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
  const styles = useStyles();
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

const useStyles = makeStyles((colors) => ({
  block: { gap: space.xs },
  label: { ...type.label, color: colors.ink2 },
  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.tile,
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
    backgroundColor: colors.raised,
    boxShadow: shadows.card,
  },
  text: { ...type.bodyStrong, color: colors.ink2, textAlign: "center" },
  textSelected: { color: colors.ink },
  textDisabled: { color: colors.ink4 },
  detail: { ...type.small, color: colors.ink2, textAlign: "center" },
}));
