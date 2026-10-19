import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gradients, space, type } from "../theme";

interface ScreenProps {
  title: string;
  subtitle?: string;
  // Replaces the plain title, e.g. the Home brand row.
  header?: ReactNode;
  children: ReactNode;
}

// Scrollable tab screen on the glow canvas. The top inset sits outside the
// scroll view so content never scrolls under the transparent edge-to-edge
// status bar. The tab bar owns the bottom inset.
export function Screen({ title, subtitle, header, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.canvas} pointerEvents="none" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {header ?? (
          <View style={styles.titleBlock}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        )}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  canvas: {
    ...StyleSheet.absoluteFillObject,
    experimental_backgroundImage: gradients.canvas,
  },
  scroll: { flex: 1 },
  content: {
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  titleBlock: { gap: space.xs, paddingTop: space.sm, paddingBottom: space.xs },
  title: { ...type.title, color: colors.ink },
  subtitle: { ...type.body, color: colors.textMuted },
});
