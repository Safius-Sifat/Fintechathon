import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { HeroAction } from "../components/Button";
import { Card, DetailRow, Divider } from "../components/Card";
import { ChainChip } from "../components/ChainChip";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { preview } from "../config/capabilities";
import { colors, gradients, radius, shadows, space, type } from "../theme";

// Home preview. The personal wallet and agent wallets are separate surfaces
// and their balances are never combined. No wallet exists on this phone yet,
// so nothing here shows an address, a balance or a working action.
export function HomeScreen() {
  return (
    <Screen title="Home" header={<BrandHeader />}>
      <PersonalWalletHero />

      <Banner
        icon="information-outline"
        title="Preview build"
        body="This build cannot sign, send funds or show balances."
      />

      <Card>
        <View style={styles.cardHeader}>
          <IconTile icon="robot-outline" tone="amber" />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Agent wallets</Text>
            <Text style={styles.cardSubtitle}>
              Separate funds your agents spend under your rules
            </Text>
          </View>
        </View>
        <StatusTag state="notConnected" />
        <Divider />
        <DetailRow label="Spendable" value="Unavailable" muted />
        <Text style={styles.caption}>
          Agent wallets need the Mandate service, which this build does not
          connect to.
        </Text>
      </Card>

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

function BrandHeader() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <Icon name="alpha-m-box" size={32} color={colors.ink} />
        <Text style={styles.wordmark} accessibilityRole="header">
          Mandate
        </Text>
      </View>
      <ChainChip />
    </View>
  );
}

function PersonalWalletHero() {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}>
          <Icon name="wallet-outline" size={20} color={colors.onDark} />
        </View>
        <Text style={styles.heroLabel}>Personal wallet</Text>
        <StatusTag state="notBuilt" label="Not set up" onDark />
      </View>

      <View style={styles.heroBody}>
        <Text style={styles.heroTitle}>No wallet yet</Text>
        <Text style={styles.heroText}>
          Your own account, kept on this phone. There is no balance or address
          to show until a wallet exists.
        </Text>
      </View>

      <View style={styles.heroActions}>
        <HeroAction
          label="Receive"
          icon="arrow-bottom-left"
          disabled={!preview.hasOwnerWallet}
          accessibilityHint="Unavailable. Needs a wallet on this phone."
        />
        <HeroAction
          label="Send"
          icon="arrow-top-right"
          disabled={!preview.canMoveFunds}
          accessibilityHint="Unavailable. Needs a wallet on this phone."
        />
      </View>
      <Text style={styles.heroCaption}>
        Receive and Send need a wallet on this phone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    minHeight: 56,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  brandMark: { flexDirection: "row", alignItems: "center", gap: space.xs },
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
