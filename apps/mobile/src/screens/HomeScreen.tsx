import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Banner } from "../components/Banner";
import { HeroAction } from "../components/Button";
import { Card, DetailRow, Divider } from "../components/Card";
import { ChainChip } from "../components/ChainChip";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { preview } from "../config/capabilities";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  colors,
  gradients,
  radius,
  shadows,
  space,
  stackedFontScale,
  touchTarget,
  type,
} from "../theme";

// Home preview. The personal account and its agent wallet are separate
// surfaces and their balances are never combined. No wallet exists on this
// phone yet, so nothing here shows an address, a balance or a working action.
export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Screen
      title="Home"
      header={<BrandHeader onScan={() => navigation.navigate("Scan")} />}
    >
      {/* With no wallet there is no account to name. */}
      <NavRow
        icon="account-circle-outline"
        tone="blue"
        label="Account"
        value="No account yet"
        accessibilityHint="Opens accounts"
        onPress={() => navigation.navigate("Accounts")}
      />

      <PersonalAccountHero
        onReceive={() => navigation.navigate("Receive")}
        onSend={() => navigation.navigate("Send")}
      />

      <NavRow
        icon="wallet-outline"
        tone="blue"
        label="Assets and tokens"
        value="Balances unavailable"
        accessibilityHint="Opens personal and agent wallet assets"
        onPress={() => navigation.navigate("Assets")}
      />

      <Banner
        icon="information-outline"
        title="Preview build"
        body="This build cannot sign, send funds or show balances."
      />

      <Card>
        <View style={styles.cardHeader}>
          <IconTile icon="robot-outline" tone="amber" />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Agent wallet</Text>
            <Text style={styles.cardSubtitle}>
              Separate funds your agents spend under your rules
            </Text>
          </View>
        </View>
        <StatusTag state="notConnected" />
        <Divider />
        <DetailRow label="Address" value="Not created" muted />
        <DetailRow label="DemoUSD balance" value="Unavailable" muted />
        <DetailRow label="DemoUSD spendable" value="Unavailable" muted />
        <DetailRow label="Test USDC balance" value="Unavailable" muted />
        <DetailRow label="Test USDC spendable" value="Unavailable" muted />
        <DetailRow label="Frozen" value="Unavailable" muted />
        <DetailRow label="Service hold" value="Unavailable" muted />
        <Text style={styles.caption}>
          Each asset is shown on its own and never added to personal funds. The
          agent wallet needs the Mandate service, which this build does not
          connect to.
        </Text>
      </Card>

      <NavRow
        icon="clipboard-text-clock-outline"
        tone="amber"
        label="Agent tasks"
        value="Tasks unavailable"
        accessibilityHint="Opens agent tasks"
        onPress={() => navigation.navigate("AgentTasks")}
      />
      <NavRow
        icon="account-check-outline"
        tone="amber"
        label="Approvals and alerts"
        value="Requests unavailable"
        accessibilityHint="Opens agent payment approvals and alerts"
        onPress={() => navigation.navigate("Approvals")}
      />
      <NavRow
        icon="shield-lock-outline"
        tone="amber"
        label="Agent controls"
        value="Status unavailable"
        accessibilityHint="Opens freeze, pause, revoke and logout"
        onPress={() => navigation.navigate("AgentControls")}
      />
      <NavRow
        icon="tune-variant"
        tone="amber"
        label="Wallet policy"
        value="Policy unavailable"
        accessibilityHint="Opens limits, allowed recipients and the review threshold for all agents"
        onPress={() => navigation.navigate("WalletPolicy")}
      />

      <View style={styles.note}>
        <IconTile icon="call-split" tone="slate" size={36} />
        <Text style={styles.noteText}>
          Personal and agent funds stay separate. Their balances are never added
          together.
        </Text>
      </View>
    </Screen>
  );
}

function BrandHeader({ onScan }: { onScan: () => void }) {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <Icon name="alpha-m-box" size={32} color={colors.ink} />
        <Text style={styles.wordmark} accessibilityRole="header">
          Mandate
        </Text>
      </View>
      <View style={styles.brandActions}>
        <ChainChip />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan QR code"
          onPress={onScan}
          style={({ pressed }) => [
            styles.scanButton,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="qrcode-scan" size={22} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

interface HeroProps {
  onReceive: () => void;
  onSend: () => void;
}

function PersonalAccountHero({ onReceive, onSend }: HeroProps) {
  // Side-by-side facts break words at large text sizes; stack them instead.
  const { fontScale } = useWindowDimensions();
  const factStyle =
    fontScale > stackedFontScale
      ? styles.heroFactStacked
      : styles.heroFactInline;
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}>
          <Icon name="wallet-outline" size={20} color={colors.onDark} />
        </View>
        <Text style={styles.heroLabel}>Personal account</Text>
        <StatusTag state="notBuilt" label="Not set up" onDark />
      </View>

      <View style={styles.heroBody}>
        <Text style={styles.heroTitle}>No wallet yet</Text>
        <Text style={styles.heroText}>
          Your own account, kept on this phone. There is no balance or address
          to show until a wallet exists.
        </Text>
      </View>

      <View style={styles.heroFacts}>
        <HeroFact label="Address" value="Not created" style={factStyle} />
        <HeroFact label="Spendable" value="Unavailable" style={factStyle} />
      </View>

      <View style={styles.heroActions}>
        <HeroAction
          label="Receive"
          icon="arrow-bottom-left"
          accessibilityHint="Shows where funds would arrive. No address exists yet."
          onPress={onReceive}
        />
        <HeroAction
          label="Send"
          icon="arrow-top-right"
          accessibilityHint="Shows the send form. Nothing can be sent yet."
          onPress={onSend}
        />
      </View>
      <Text style={styles.heroCaption}>
        Receiving and sending need a wallet on this phone.
      </Text>
    </View>
  );
}

interface HeroFactProps {
  label: string;
  value: string;
  style: StyleProp<ViewStyle>;
}

function HeroFact({ label, value, style }: HeroFactProps) {
  return (
    <View style={[styles.heroFact, style]}>
      <Text style={styles.heroFactLabel}>{label}</Text>
      <Text style={styles.heroFactValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },

  brand: {
    minHeight: 56,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  brandMark: { flexDirection: "row", alignItems: "center", gap: space.xs },
  brandActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  scanButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: shadows.card,
  },
  wordmark: {
    ...type.heading,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
  },

  hero: {
    borderRadius: radius.hero,
    padding: space.xl,
    gap: space.lg,
    experimental_backgroundImage: gradients.hero,
    backgroundColor: "#121A2E",
    boxShadow: shadows.hero,
  },
  heroTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.heroFill,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: { ...type.bodyStrong, color: colors.onDarkMuted, flexGrow: 1 },
  heroBody: { gap: space.xs },
  heroTitle: { ...type.hero, color: colors.onDark },
  heroText: { ...type.small, color: colors.onDarkMuted },
  heroFacts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  heroFact: {
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.heroFill,
  },
  heroFactInline: { flexGrow: 1, flexBasis: 0, minWidth: 120 },
  heroFactStacked: { width: "100%" },
  heroFactLabel: { ...type.label, color: colors.onDarkMuted },
  heroFactValue: { ...type.bodyStrong, color: colors.onDark },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  heroCaption: { ...type.small, color: colors.onDarkMuted },

  cardHeader: { flexDirection: "row", gap: space.md, alignItems: "center" },
  cardHeaderText: { flex: 1, gap: 2 },
  cardTitle: { ...type.heading, color: colors.ink },
  cardSubtitle: { ...type.small, color: colors.textMuted },
  caption: { ...type.small, color: colors.textMuted },

  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xs,
  },
  noteText: { ...type.small, color: colors.textMuted, flex: 1 },
});
