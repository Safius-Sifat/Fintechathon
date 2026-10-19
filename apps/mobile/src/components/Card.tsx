import type { ReactNode } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  colors,
  radius,
  shadows,
  space,
  stackedFontScale,
  type,
} from "../theme";

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

interface DetailRowProps {
  label: string;
  value: string;
  muted?: boolean;
}

// Label/value pair. Stacks when large text is on so nothing truncates.
export function DetailRow({ label, value, muted }: DetailRowProps) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > stackedFontScale;
  return (
    <View style={[styles.detailRow, stacked && styles.detailRowStacked]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          muted && styles.detailValueMuted,
          !stacked && styles.detailValueEnd,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    boxShadow: shadows.card,
  },
  sectionTitle: {
    ...type.heading,
    color: colors.ink,
    marginTop: space.sm,
    marginBottom: -space.xs,
  },
  divider: { height: 1, backgroundColor: colors.hairline },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: space.md,
  },
  detailRowStacked: { flexDirection: "column", gap: 2 },
  detailLabel: { ...type.small, color: colors.textMuted },
  detailValue: { ...type.bodyStrong, color: colors.ink, flexShrink: 1 },
  detailValueMuted: { color: colors.textMuted },
  detailValueEnd: { textAlign: "right" },
});
