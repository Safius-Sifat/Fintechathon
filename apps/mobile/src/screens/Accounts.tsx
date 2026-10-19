import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { CapabilityRow } from "../components/CapabilityRow";
import { Icon, type IconName } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { Screen } from "../components/Screen";
import type { Capability } from "../config/capabilities";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Account switcher preview. Accounts are derived from the wallet's recovery
// phrase, and no wallet exists on this phone yet, so the list is empty and
// adding or renaming is not available. Nothing here invents an account.

type Props = NativeStackScreenProps<RootStackParamList, "Accounts">;

const HOW_ACCOUNTS_WORK: readonly { icon: IconName; text: string }[] = [
  {
    icon: "format-list-numbered",
    text: "One recovery phrase gives you up to 20 accounts, each with its own address.",
  },
  {
    icon: "robot-outline",
    text: "Each account has its own agent wallet and its own sign-in. Agents never move between accounts.",
  },
  {
    icon: "swap-horizontal",
    text: "Switching accounts clears everything the previous account was showing.",
  },
  {
    icon: "tag-outline",
    text: "Account names are stored only on this phone. Restoring from your phrase does not bring them back.",
  },
  {
    icon: "magnify",
    text: "After a restore you see your first 5 accounts and can reveal more. An empty account does not prove that later ones are empty.",
  },
];

const ACCOUNT_ACTIONS: readonly Capability[] = [
  {
    id: "add-account",
    title: "Add account",
    detail: "Adds the next account from your recovery phrase.",
    icon: "account-plus-outline",
    tone: "blue",
    state: "notBuilt",
  },
  {
    id: "rename-account",
    title: "Rename account",
    detail: "Gives an account a name only you see.",
    icon: "pencil-outline",
    tone: "violet",
    state: "notBuilt",
  },
];

export function AccountsScreen({ navigation }: Props) {
  return (
    <Screen
      title="Accounts"
      subtitle="Each account is a separate address from your recovery phrase."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <View style={styles.empty}>
          <IconTile icon="account-multiple-outline" tone="slate" size={56} />
          <Text style={styles.emptyTitle}>No accounts on this phone</Text>
          <Text style={styles.emptyText}>
            Accounts appear after you create or restore a wallet. Neither is
            available in this build.
          </Text>
        </View>
        <PrimaryButton
          label="Set up a wallet"
          accessibilityHint="Shows the wallet setup options"
          onPress={() => navigation.navigate("Setup", { direct: true })}
        />
      </Card>

      <SectionTitle>How accounts work</SectionTitle>
      <Card>
        {HOW_ACCOUNTS_WORK.map((item) => (
          <View key={item.icon} style={styles.fact}>
            <Icon name={item.icon} size={20} color={colors.textMuted} />
            <Text style={styles.factText}>{item.text}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Account actions</SectionTitle>
      <Card>
        {ACCOUNT_ACTIONS.map((action) => (
          <CapabilityRow key={action.id} capability={action} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  emptyTitle: { ...type.heading, color: colors.ink, textAlign: "center" },
  emptyText: { ...type.small, color: colors.textMuted, textAlign: "center" },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  factText: { ...type.body, color: colors.text, flex: 1 },
});
