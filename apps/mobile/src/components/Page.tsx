import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows, space, touchTarget, type } from "../theme";
import { Icon } from "./Icon";

interface PageProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  // Pinned under the scrolling content, e.g. the main action.
  footer?: ReactNode;
  children: ReactNode;
}

// Full-screen flow page: back button, serif title, scrolling body and a pinned
// footer. The body scrolls, so signed terms are never hidden on small phones.
export function Page({ title, subtitle, onBack, footer, children }: PageProps) {
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
        contentContainerStyle={styles.content}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}
        >
          {footer}
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  backRow: { paddingTop: space.sm, paddingHorizontal: space.lg },
  back: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    boxShadow: shadows.card,
  },
  pressed: { opacity: 0.7 },
  scroll: { flex: 1 },
  content: {
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  titleBlock: { gap: space.xs },
  title: { ...type.title, color: colors.ink },
  subtitle: { ...type.body, color: colors.ink2 },
  footer: { paddingTop: space.md, paddingHorizontal: space.xl, gap: space.sm },
});
