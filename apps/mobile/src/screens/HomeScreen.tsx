import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { GhostButton, Heading, Note, Row, Rows } from "../components/blocks";
import { ChainChip } from "../components/ChainChip";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, space, touchTarget, type, useColors } from "../theme";

// Home preview. The personal account and its agent wallet are separate
// surfaces and their balances are never combined. No wallet exists on this
// phone yet, so nothing here shows an address, a balance or a working action.
export function HomeScreen() {
  const styles = useStyles();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Screen
      title="Home"
      header={<BrandHeader onScan={() => navigation.navigate("Scan")} />}
    >
      <AccountRow onPress={() => navigation.navigate("Accounts")} />

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Personal account</Text>
          <StatusTag state="notBuilt" label="Not set up" />
        </View>
        <Text style={styles.heroTitle}>No wallet yet</Text>
        <Text style={styles.heroText}>
          Your own account, kept on this phone. There is no balance or address
          to show until a wallet exists.
        </Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.action}>
          <GhostButton
            label="Receive"
            onPress={() => navigation.navigate("Receive")}
          />
        </View>
        <View style={styles.action}>
          <GhostButton
            label="Send"
            onPress={() => navigation.navigate("Send")}
          />
        </View>
      </View>
      <Note>Receiving and sending need a wallet on this phone.</Note>

      <Banner
        icon="information-outline"
        title="Preview build"
        body="This build cannot sign, send funds or show balances."
      />

      <Heading>Agents</Heading>
      <Rows>
        <Row
          label="Agent wallet"
          detail="Separate funds your agents spend under your rules. Not connected."
          onPress={() => navigation.navigate("Tabs", { screen: "Agents" })}
        />
      </Rows>
      <Note>
        Personal and agent funds stay separate. Their balances are never added
        together.
      </Note>
    </Screen>
  );
}

function BrandHeader({ onScan }: { onScan: () => void }) {
  const styles = useStyles();
  const colors = useColors();
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

// Opens the account switcher. With no wallet there is no account to name.
function AccountRow({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account. No account yet."
      accessibilityHint="Opens accounts"
      onPress={onPress}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [styles.accountRow, pressed && styles.pressed]}
    >
      <IconTile icon="account-circle-outline" tone="blue" size={40} />
      <View style={styles.accountText}>
        <Text style={styles.accountLabel}>Account</Text>
        <Text style={styles.accountValue}>No account yet</Text>
      </View>
      <Icon name="chevron-right" size={24} color={colors.ink3} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  brand: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingTop: space.sm,
  },
  brandMark: { flexDirection: "row", alignItems: "center", gap: space.sm },
  wordmark: { ...type.hero, color: colors.ink },
  brandActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  scanButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  pressed: { opacity: 0.7 },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: touchTarget + space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 26,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  accountText: { flex: 1, gap: 2 },
  accountLabel: { ...type.small, color: colors.ink2 },
  accountValue: { ...type.bodyStrong, color: colors.ink },
  hero: { gap: space.md, paddingTop: space.md },
  heroTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  heroLabel: { ...type.small, color: colors.ink2 },
  heroTitle: { ...type.title, color: colors.ink },
  heroText: { ...type.body, color: colors.ink2 },
  actions: { flexDirection: "row", gap: space.md },
  action: { flex: 1 },
}));
