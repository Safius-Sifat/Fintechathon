import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  shadows,
  space,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../theme";
import { Icon, type IconName } from "./Icon";

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
  const colors = useColors();
  const styles = useStyles();
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

const useStyles = makeStyles((colors) => ({
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
}));

interface FrameProps {
  title?: string;
  onBack?: () => void;
  // Round button on the right of the top bar, e.g. Scan.
  right?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
}

// Pushed screen with a centred small title between a back button and an
// optional right button, as in the Receive, Send and Review designs.
export function Frame({
  title,
  onBack,
  right,
  footer,
  scroll = true,
  children,
}: FrameProps) {
  const insets = useSafeAreaInsets();
  const styles = useFrameStyles();
  const colors = useColors();
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.flex}
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content]}>{children}</View>
  );
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <Icon name="chevron-left" size={28} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
        <Text style={styles.barTitle} accessibilityRole="header">
          {title}
        </Text>
        {right ?? <View style={styles.spacer} />}
      </View>
      {body}
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

// Round icon button for the top bar.
export function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
}) {
  const styles = useFrameStyles();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      <Icon name={icon} size={24} color={colors.ink} />
    </Pressable>
  );
}

const useFrameStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
  },
  barTitle: { ...type.heading, fontSize: 19, color: colors.ink },
  round: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    boxShadow: shadows.card,
  },
  spacer: { width: touchTarget, height: touchTarget },
  pressed: { opacity: 0.7 },
  content: {
    paddingTop: space.lg,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  footer: { paddingTop: space.md, paddingHorizontal: space.xl, gap: space.sm },
}));
