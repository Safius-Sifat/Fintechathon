import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton, PrimaryButton } from "../components/Button";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { LOCAL_ACTIONS, RECOVERY_NEEDS } from "../config/ownerControl";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Recovery and backup preview (plan P3-01, S8.1, S8.5; WQ01, WQ10, WQ12).
// Two separate things: restoring the owner key on a phone, and recovering
// agent wallet funds with an owner command. Recovery words and passphrases
// are only ever entered or shown on protected native screens, never in this
// JavaScript screen, so this screen has no text fields and every action is
// disabled.

type Props = NativeStackScreenProps<RootStackParamList, "Recovery">;

const NEED_ICONS = {
  words: "format-list-numbered",
  passphrase: "form-textbox-password",
  index: "numeric",
} as const;

export function RecoveryScreen({ navigation }: Props) {
  return (
    <Screen
      title="Recovery and backup"
      subtitle="Restoring your owner key and recovering agent funds are separate steps."
      onBack={() => navigation.goBack()}
    >
      <SectionTitle>1. Restore your wallet on a phone</SectionTitle>
      <Card>
        <Text style={styles.body}>
          Your owner key lives only on this phone. To get it back on this or
          another phone you need:
        </Text>
        {RECOVERY_NEEDS.map((need) => (
          <View key={need.id} style={styles.need}>
            <IconTile icon={NEED_ICONS[need.id]} tone="blue" size={40} />
            <View style={styles.needText}>
              <Text style={styles.bodyStrong}>{need.title}</Text>
              <Text style={styles.caption}>{need.detail}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Banner
        icon="shield-lock-outline"
        title="Entered only on a protected screen"
        body="Words and passphrases are typed or shown only on a protected screen built into the app, with screenshots blocked. Never in an ordinary text field, a chat or a website."
      />

      <Card>
        <Text style={styles.cardTitle}>After a restore</Text>
        <Text style={styles.body}>
          The first five addresses are checked for balances and agent wallets.
          You can reveal more. An empty first address does not mean the words
          hold no funds.
        </Text>
        <Text style={styles.caption}>
          Mandate cannot recover your words. There is no server or cloud copy.
          Losing this phone and your words means losing the wallet.
        </Text>
        <PrimaryButton
          label="Restore a wallet"
          icon="key-arrow-right"
          disabled
          accessibilityHint="Unavailable. Restoring needs the protected native restore screen, which is not built."
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>This phone's backup</Text>
        <DetailRow label="Wallet on this phone" value="None" muted />
        <DetailRow
          label="Recovery words backed up"
          value="Not applicable"
          muted
        />
        <View style={styles.actions}>
          <OutlineButton
            label="Show recovery words"
            icon="eye-outline"
            disabled
            accessibilityHint="Unavailable. There is no wallet, and the protected screen that shows words is not built."
          />
        </View>
      </Card>

      <SectionTitle>2. Recover agent wallet funds</SectionTitle>
      <Card>
        <Text style={styles.body}>
          Restoring your owner key gives you control of your agent wallet again.
          It does not move any funds or stop any agent.
        </Text>
        <Text style={styles.body}>
          Each owner command has its own effect. Pause stops agents. Recover,
          Recover liquid and a sweep to owner bring agent wallet funds to your
          owner address, and each also pauses agents. Unpause stops nothing. A
          command counts only once it is confirmed on chain.
        </Text>
      </Card>
      <NavRow
        icon="shield-key-outline"
        tone="amber"
        label="Owner control"
        value="Pause, recover and sweep to owner"
        accessibilityHint="Opens owner control"
        onPress={() => navigation.navigate("Control")}
      />

      <SectionTitle>What does not stop agents</SectionTitle>
      {LOCAL_ACTIONS.map((action) => (
        <Card key={action.id}>
          <Text style={styles.cardTitle}>{action.title}</Text>
          <TaskStateChip
            info={{ label: "Does not stop agents", group: "attention" }}
            icon="robot-outline"
          />
          <Text style={styles.body}>{action.effect}</Text>
          {action.id === "removeWallet" ? (
            <View style={styles.actions}>
              <OutlineButton
                label="Remove wallet"
                icon="delete-outline"
                disabled
                accessibilityHint="Unavailable. There is no wallet on this phone."
              />
            </View>
          ) : (
            <StatusTag state="notBuilt" label="Not available in this build" />
          )}
        </Card>
      ))}
      <Text style={styles.caption}>
        To stop agents, freeze, pause or revoke from Agent controls, or use
        owner control when the service is down.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  bodyStrong: { ...type.bodyStrong, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  need: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  needText: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
