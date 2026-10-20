import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows, space, touchTarget, type } from "../theme";
import { Icon } from "./Icon";

interface ScreenProps {
  title: string;
  subtitle?: string;
  // Replaces the plain title, e.g. the Home brand row.
  header?: ReactNode;
  // For screens pushed over the tabs: shows a back button and pads for the
  // bottom inset, which no tab bar covers there.
  onBack?: () => void;
  children: ReactNode;
}

// Scrollable screen on the flat ground. The top inset sits outside the
// scroll view so content never scrolls under the transparent edge-to-edge
// status bar. On tab screens the tab bar owns the bottom inset.
export function Screen({
  title,
  subtitle,
  header,
  onBack,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {onBack ? (
        <View style={styles.backRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Icon name="chevron-left" size={28} color={colors.ink} />
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          onBack && { paddingBottom: space.xxxl + insets.bottom },
        ]}
      >
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
  backRow: { paddingTop: space.sm, paddingHorizontal: space.lg },
  back: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    boxShadow: shadows.card,
  },
  pressed: { opacity: 0.7 },
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
