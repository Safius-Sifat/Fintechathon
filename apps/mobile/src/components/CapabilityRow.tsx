import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { Capability } from "../config/capabilities";
import { colors, space, stackedFontScale, type } from "../theme";
import { IconTile } from "./IconTile";
import { StatusTag, statusLabel } from "./StatusTag";

// Read-only row: icon tile, title, detail and an explicit state tag.
export function CapabilityRow({ capability }: { capability: Capability }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > stackedFontScale;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${capability.title}. ${statusLabel(capability.state)}. ${capability.detail}`}
    >
      <IconTile icon={capability.icon} tone={capability.tone} />
      <View style={[styles.body, !stacked && styles.bodyInline]}>
        <View style={styles.text}>
          <Text style={styles.title}>{capability.title}</Text>
          <Text style={styles.detail}>{capability.detail}</Text>
        </View>
        <StatusTag state={capability.state} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.xs,
  },
  body: { flex: 1, gap: space.sm },
  bodyInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  text: { flexShrink: 1, gap: 2 },
  title: { ...type.bodyStrong, color: colors.ink },
  detail: { ...type.small, color: colors.textMuted },
});
