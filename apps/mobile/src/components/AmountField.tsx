import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, space, tones, type } from "../theme";
import { Icon } from "./Icon";

interface AmountFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  // Limit or meaning, shown under the field while there is no error.
  hint?: string;
  error?: string | undefined;
  // Whole numbers such as days or a count.
  integer?: boolean;
}

// Labelled number field with its limit and an inline error. The error is
// spelled out in text and read with the field; the red border only
// reinforces it.
export function AmountField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  integer = false,
}: AmountFieldProps) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        keyboardType={integer ? "number-pad" : "decimal-pad"}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? (
        <View style={styles.errorRow}>
          <Icon name="alert-circle-outline" size={16} color={tones.red.fg} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  label: { ...type.label, color: colors.textMuted },
  input: {
    ...type.body,
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.14)",
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  inputError: { borderColor: tones.red.fg },
  hint: { ...type.small, color: colors.textMuted },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: space.xs },
  error: { ...type.small, color: tones.red.fg, flex: 1 },
});
