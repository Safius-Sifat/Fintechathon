import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "../components/Banner";
import {
  ActionTile,
  Note,
  Row,
  Rows,
  SectionHeading,
  TokenRow,
} from "../components/blocks";
import { Icon, type IconName } from "../components/Icon";
import { RoundButton } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fonts, makeStyles, space, type, useColors } from "../theme";
import { agentWallet, balances } from "../wallet/chain";
import { TOKENS } from "../wallet/config";
import { formatAmount, shortAddress } from "../wallet/format";
import { currentAccount, useWallet } from "../wallet/session";
import { useAsync } from "../wallet/useAsync";

// Wallet home. Balances are read from Base Sepolia. The personal account and
// its agent wallet are separate and their balances are never added together.
export function HomeScreen() {
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useWallet();
  const account = currentAccount();
  const bal = useAsync(
    () => (account ? balances(account.address) : Promise.resolve(null)),
    [account?.address],
  );
  const agent = useAsync(
    () => (account ? agentWallet(account.address) : Promise.resolve(null)),
    [account?.address],
  );
  const dusd = bal.data
    ? formatAmount(bal.data.values[0]!, TOKENS[0]!.decimals)
    : "—";
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={bal.loading && bal.data !== undefined}
            onRefresh={() => {
              bal.reload();
              agent.reload();
            }}
          />
        }
      >
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Account ${account?.label ?? ""}. Opens accounts`}
            onPress={() => navigation.navigate("Accounts")}
            style={({ pressed }) => [styles.account, pressed && styles.pressed]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(account?.index ?? 0) + 1}</Text>
            </View>
            <Text style={styles.accountName}>{account?.label}</Text>
            <Icon name="chevron-down" size={22} color={colors.ink2} />
          </Pressable>
          <RoundButton
            icon="qrcode-scan"
            label="Scan QR code"
            onPress={() => navigation.navigate("Scan")}
          />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Personal account</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue} accessibilityRole="header">
              {dusd}
            </Text>
            <Text style={styles.heroUnit}>DUSD</Text>
          </View>
          <Text style={styles.heroNote}>
            {account ? shortAddress(account.address) : ""} · Test funds. No
            market value.
          </Text>
        </View>
        {bal.error ? (
          <Banner
            icon="cloud-off-outline"
            title="Balances unavailable"
            body={bal.error}
          />
        ) : null}

        <View style={styles.tiles}>
          <ActionTile
            icon="arrow-bottom-left"
            label="Receive"
            onPress={() => navigation.navigate("Receive")}
          />
          <ActionTile
            icon="arrow-top-right"
            label="Send"
            onPress={() => navigation.navigate("Send")}
          />
          <ActionTile
            icon="qrcode-scan"
            label="Scan"
            onPress={() => navigation.navigate("Scan")}
          />
        </View>

        <SectionHeading
          action="See all"
          onAction={() => navigation.navigate("Tabs", { screen: "Agents" })}
        >
          Agents
        </SectionHeading>
        <Rows>
          <Row
            label={agent.data ? "Agent wallet" : "No agent wallet"}
            detail={
              agent.error
                ? agent.error
                : agent.data
                  ? `${agent.data.frozen ? "Frozen" : agent.data.paused ? "Paused" : "Active"} · ${formatAmount(agent.data.balances[0]!, TOKENS[0]!.decimals)} DUSD`
                  : agent.loading
                    ? "Checking the chain…"
                    : "Create on chain, then register with the service to run tasks."
            }
            onPress={() => navigation.navigate("AgentWallet")}
          />
        </Rows>

        <SectionHeading>Tokens</SectionHeading>
        <View>
          {TOKENS.map((t, i) => (
            <TokenRow
              key={t.name}
              mark={
                t.symbol === "DUSD" ? (
                  <View style={styles.demoMark}>
                    <Text style={styles.demoLetter}>M</Text>
                  </View>
                ) : (
                  <TokenGlyph
                    icon={t.symbol === "ETH" ? "ethereum" : "currency-usd"}
                    color={colors.ink}
                  />
                )
              }
              title={t.name}
              subtitle={t.note}
              value={
                bal.data ? formatAmount(bal.data.values[i]!, t.decimals) : "—"
              }
            />
          ))}
        </View>
        {bal.data ? (
          <Note>
            As of block {bal.data.block.toString()}. Pull down to refresh.
          </Note>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TokenGlyph({ icon, color }: { icon: IconName; color: string }) {
  return <Icon name={icon} size={26} color={color} />;
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  content: {
    paddingTop: space.sm,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  account: { flexDirection: "row", alignItems: "center", gap: space.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.waxTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.ink },
  accountName: { ...type.heading, fontSize: 20, color: colors.ink },
  pressed: { opacity: 0.7 },
  hero: { gap: space.xs },
  heroLabel: { ...type.body, color: colors.ink2 },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  heroValue: {
    ...type.display,
    fontFamily: fonts.serifBold,
    fontSize: 64,
    lineHeight: 70,
    color: colors.ink,
  },
  heroUnit: { ...type.heading, fontSize: 22, color: colors.ink2 },
  heroNote: { ...type.body, color: colors.ink2 },
  tiles: { flexDirection: "row", gap: space.md },
  demoMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  demoLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.onAccent,
  },
}));
