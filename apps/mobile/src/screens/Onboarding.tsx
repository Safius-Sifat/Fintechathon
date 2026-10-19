import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "../components/Banner";
import { PrimaryButton, TextButton } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { Orb } from "../components/Orb";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  colors,
  gradients,
  radius,
  shadows,
  space,
  tones,
  touchTarget,
  type,
  type Tone,
} from "../theme";

// First-run flow: Welcome -> How it works -> Set up your wallet -> app.
// Creating and restoring a wallet run on native screens that are not built
// yet, so setup only explains them; nothing here collects recovery words.

type Props<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

const ORB_CHIPS = [
  { icon: "wallet-outline", color: tones.blue.fg, x: 0.16, y: 0.24 },
  { icon: "robot-outline", color: tones.amber.fg, x: 0.86, y: 0.3 },
  { icon: "shield-check-outline", color: tones.green.fg, x: 0.12, y: 0.74 },
  { icon: "key-outline", color: tones.violet.fg, x: 0.84, y: 0.8 },
] as const;

export function WelcomeScreen({ navigation }: Props<"Welcome">) {
  const { width } = useWindowDimensions();
  const orbSize = Math.min(width - space.xl * 2, 300);
  return (
    <FlowLayout
      centered
      footer={
        <>
          <PrimaryButton
            label="Get started"
            onPress={() => navigation.navigate("Intro")}
          />
          <TextButton
            label="I have a recovery phrase"
            accessibilityHint="Shows how restoring a wallet will work"
            onPress={() => navigation.navigate("Setup")}
          />
        </>
      }
    >
      <View style={styles.welcomeBrand}>
        <Icon name="alpha-m-box" size={56} color={colors.ink} />
        <Text style={styles.welcomeTitle} accessibilityRole="header">
          Mandate
        </Text>
        <Text style={styles.welcomeTagline}>
          Your agent. Your money. Real work.
        </Text>
      </View>
      <View style={styles.orbRow}>
        <Orb size={orbSize} chips={ORB_CHIPS} />
      </View>
      <Text style={styles.welcomeBody}>
        A wallet that lives on your phone, and AI agents that spend only within
        the limits you approve.
      </Text>
    </FlowLayout>
  );
}

const HOW_IT_WORKS: readonly {
  icon: IconName;
  tone: Tone;
  title: string;
  body: string;
}[] = [
  {
    icon: "cellphone-key",
    tone: "blue",
    title: "Your wallet stays on this phone",
    body: "Your recovery phrase and keys never leave the device and are never sent to Mandate.",
  },
  {
    icon: "robot-outline",
    tone: "amber",
    title: "Agents get a separate wallet",
    body: "You fund it and approve each task's budget. Your personal funds are never mixed in.",
  },
  {
    icon: "hand-back-left-outline",
    tone: "green",
    title: "You can always stop them",
    body: "Pause an agent or move its funds back yourself, even when the Mandate service is offline.",
  },
  {
    icon: "flask-outline",
    tone: "violet",
    title: "Test network only",
    body: "Mandate runs on Base Sepolia with test funds. Nothing here is real money.",
  },
];

export function IntroScreen({ navigation }: Props<"Intro">) {
  return (
    <FlowLayout
      header={
        <StepHeader step={1} steps={2} onBack={() => navigation.goBack()} />
      }
      footer={
        <PrimaryButton
          label="Next"
          onPress={() => navigation.navigate("Setup")}
        />
      }
    >
      <StepTitle
        title="Let your agent handle the real work"
        subtitle="You decide how much it can spend, and you can stop it at any time."
      />
      <View style={styles.pointList}>
        {HOW_IT_WORKS.map((point) => (
          <View
            key={point.title}
            style={styles.point}
            accessible
            accessibilityLabel={`${point.title}. ${point.body}`}
          >
            <IconTile icon={point.icon} tone={point.tone} />
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>{point.title}</Text>
              <Text style={styles.pointBody}>{point.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Banner
        icon="information-outline"
        title="Preview build"
        body="This describes how the wallet is designed to work. Wallet features are not built yet."
      />
    </FlowLayout>
  );
}

export function SetupScreen({ navigation }: Props<"Setup">) {
  return (
    <FlowLayout
      header={
        <StepHeader step={2} steps={2} onBack={() => navigation.goBack()} />
      }
      footer={
        <PrimaryButton
          label="Explore the preview"
          accessibilityHint="Opens the app without a wallet"
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: "Tabs" }] })
          }
        />
      }
    >
      <StepTitle
        title="Set up your wallet"
        subtitle="Both options will run on secure screens of their own. Neither is available in this build."
      />
      <SetupOption
        icon="plus-circle-outline"
        tone="blue"
        title="Create a new wallet"
        body="You get a new 12-word recovery phrase and confirm that you have written it down."
      />
      <SetupOption
        icon="backup-restore"
        tone="violet"
        title="Restore a wallet"
        body="Enter your recovery phrase, and your passphrase if you added one. A different passphrase opens a different wallet."
      />
      <View style={styles.notes}>
        <Text style={styles.notesTitle} accessibilityRole="header">
          Before you start
        </Text>
        <Note
          icon="pencil-outline"
          text="Write your recovery phrase on paper. Mandate cannot recover it for you."
        />
        <Note
          icon="alert-outline"
          text="Anyone who has your phrase can take your funds. Never share it."
        />
        <Note
          icon="lock-outline"
          text="You will only ever enter the phrase on a protected screen, never in an ordinary text field."
        />
      </View>
      <Banner
        icon="information-outline"
        title="Not available in this build"
        body="Wallet creation and restore come in a later milestone. Until then you can explore the app without a wallet."
      />
    </FlowLayout>
  );
}

interface SetupOptionProps {
  icon: IconName;
  tone: Tone;
  title: string;
  body: string;
}

// An unavailable choice: rendered as a disabled control so screen readers
// announce it as a button that cannot be used yet.
function SetupOption({ icon, tone, title, body }: SetupOptionProps) {
  return (
    <Pressable
      disabled
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={`${title}. Not available yet. ${body}`}
      style={styles.option}
    >
      <View style={styles.optionTop}>
        <IconTile icon={icon} tone={tone} />
        <StatusTag state="notBuilt" />
      </View>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionBody}>{body}</Text>
    </Pressable>
  );
}

function Note({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.note}>
      <Icon name={icon} size={20} color={colors.textMuted} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.stepTitle}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

interface StepHeaderProps {
  step: number;
  steps: number;
  onBack: () => void;
}

function StepHeader({ step, steps, onBack }: StepHeaderProps) {
  return (
    <View style={styles.stepHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Icon name="chevron-left" size={28} color={colors.ink} />
      </Pressable>
      <View
        style={styles.track}
        accessible
        accessibilityLabel={`Step ${step} of ${steps}`}
      >
        <View
          style={[styles.trackFill, { width: `${(step / steps) * 100}%` }]}
        />
      </View>
      <Text style={styles.stepCount} importantForAccessibility="no">
        {step}/{steps}
      </Text>
    </View>
  );
}

interface FlowLayoutProps {
  header?: ReactNode;
  footer: ReactNode;
  // Centres short content vertically; it still scrolls when it overflows.
  centered?: boolean;
  children: ReactNode;
}

// Full-screen flow step: scrolling content on the glow canvas with the
// actions pinned above the bottom inset, so they stay reachable at any text
// size.
function FlowLayout({ header, footer, centered, children }: FlowLayoutProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.canvas} pointerEvents="none" />
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, centered && styles.centered]}
      >
        {children}
      </ScrollView>
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}
      >
        {footer}
      </View>
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
  centered: { flexGrow: 1, justifyContent: "center" },
  content: {
    paddingTop: space.lg,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  footer: {
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    gap: space.xs,
  },
  pressed: { opacity: 0.7 },

  welcomeBrand: { alignItems: "center", gap: space.xs, paddingTop: space.xl },
  welcomeTitle: {
    ...type.title,
    fontSize: 34,
    lineHeight: 40,
    color: colors.ink,
  },
  welcomeTagline: {
    ...type.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  orbRow: { alignItems: "center" },
  welcomeBody: {
    ...type.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
    textAlign: "center",
    paddingHorizontal: space.sm,
  },

  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
  },
  back: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    boxShadow: shadows.card,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  stepCount: { ...type.label, color: colors.textMuted, minWidth: 28 },

  stepTitle: { gap: space.sm },
  title: { ...type.title, color: colors.ink },
  subtitle: { ...type.body, color: colors.textMuted },

  pointList: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
    boxShadow: shadows.card,
  },
  point: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  pointText: { flex: 1, gap: 2 },
  pointTitle: { ...type.bodyStrong, color: colors.ink },
  pointBody: { ...type.small, color: colors.textMuted },

  option: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    boxShadow: shadows.card,
  },
  optionTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  optionTitle: { ...type.heading, color: colors.textMuted },
  optionBody: { ...type.small, color: colors.textMuted },

  notes: { gap: space.md, paddingHorizontal: space.xs },
  notesTitle: { ...type.heading, color: colors.ink },
  note: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  noteText: { ...type.body, color: colors.text, flex: 1 },
});
