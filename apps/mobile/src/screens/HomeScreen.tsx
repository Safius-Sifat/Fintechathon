import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

// Wallet home. The personal account and its agent wallet are separate
// surfaces and their balances are never combined. No wallet exists on this
// phone yet, so nothing here shows an address, a balance or a working action.
export function HomeScreen() {
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account. No account yet."
            accessibilityHint="Opens accounts"
            onPress={() => navigation.navigate("Accounts")}
            style={({ pressed }) => [styles.account, pressed && styles.pressed]}
          >
            <View style={styles.avatar}>
              <Icon name="account-outline" size={24} color={colors.accent} />
            </View>
            <Text style={styles.accountName}>No account</Text>
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
          <Text style={styles.heroValue} accessibilityRole="header">
            No wallet yet
          </Text>
          <Text style={styles.heroNote}>
            Test funds. No balance or address until a wallet exists.
          </Text>
        </View>

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
            label="No agent wallet"
            detail="Needs the Mandate service. Not connected."
            onPress={() => navigation.navigate("Tabs", { screen: "Agents" })}
          />
        </Rows>

        <SectionHeading>Tokens</SectionHeading>
        <View>
          <TokenRow
            mark={<DemoMark />}
            title="DemoUSD"
            subtitle="Base Sepolia"
            value="Unavailable"
          />
          <TokenRow
            mark={<TokenGlyph icon="ethereum" color={colors.ink} />}
            title="Ether"
            subtitle="Test ETH, pays network fees"
            value="Unavailable"
          />
          <TokenRow
            mark={<TokenGlyph icon="currency-usd" color={colors.ink} />}
            title="USDC"
            subtitle="Circle test token"
            value="Unavailable"
          />
        </View>
        <Note>
          Preview build. This build cannot sign, send or show balances.
        </Note>
      </ScrollView>
    </View>
  );
}

// DemoUSD carries the Mandate seal mark.
function DemoMark() {
  const styles = useStyles();
  return (
    <View style={styles.demoMark}>
      <Text style={styles.demoLetter}>M</Text>
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
  accountName: { ...type.heading, fontSize: 20, color: colors.ink },
  pressed: { opacity: 0.7 },
  hero: { gap: space.xs },
  heroLabel: { ...type.body, color: colors.ink2 },
  heroValue: {
    ...type.display,
    fontFamily: fonts.serifBold,
    color: colors.ink,
  },
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
