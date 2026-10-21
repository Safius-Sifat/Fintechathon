import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import { ActionTile, Note, SectionHeading, Voice } from "../components/blocks";
import { TextLink } from "../components/chat";
import { Group, IconRow } from "../components/Group";
import { Icon, type IconName } from "../components/Icon";
import { MandateMark } from "../components/MandateMark";
import { Screen } from "../components/Screen";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { updateDraft } from "../state/sendDraft";
import { useDraftContext } from "../state/useSendDraft";
import { fonts, radius, space, type, makeStyles, useColors } from "../theme";
import {
  agentWallet,
  createAgentWallet,
  recentAgentEvents,
} from "../wallet/chain";
import { TOKENS } from "../wallet/config";
import { formatAmount, shortAddress } from "../wallet/format";
import { currentAccount, useWallet } from "../wallet/session";
import { errorText, useAsync } from "../wallet/useAsync";
import { ServiceAgent } from "./ServiceAgent";

const EVENT_ICONS: Record<string, IconName> = {
  ActionExecuted: "robot-outline",
  OwnerTransferExecuted: "arrow-up",
  WalletPaused: "pause-circle-outline",
  WalletFrozen: "snowflake",
  WalletPolicyUpdated: "tune-variant",
  PermitActivated: "check-decagram-outline",
};

const EVENT_LABELS: Record<string, string> = {
  ActionExecuted: "Agent payment",
  OwnerTransferExecuted: "Moved out by you",
  WalletPaused: "Pause changed",
  WalletFrozen: "Freeze changed",
  WalletPolicyUpdated: "Wallet limits signed",
  PermitActivated: "Task approved",
};

// The agent wallet the factory recorded for this account, read from the
// chain, with its money and stop controls and the service registration.
export function AgentWalletScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = useStyles();
  const colors = useColors();
  useWallet();
  const account = currentAccount();
  const context = useDraftContext();
  const agent = useAsync(
    () => (account ? agentWallet(account.address) : Promise.resolve(null)),
    [account?.address],
  );
  const w = agent.data;
  const events = useAsync(
    () => (w ? recentAgentEvents(w.address) : Promise.resolve([])),
    [w?.address],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await createAgentWallet(account.address);
      navigation.navigate("TxDetail", { hash });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const hero = w ? (
    <View style={styles.hero}>
      <MandateMark size={56} />
      <Text style={styles.name} accessibilityRole="header">
        Agent wallet
      </Text>
      <View style={styles.status}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: w.frozen
                ? colors.bad
                : w.paused
                  ? colors.warn
                  : colors.good,
            },
          ]}
        />
        <Text style={styles.statusText}>
          {w.frozen ? "Frozen" : w.paused ? "Paused" : "Active"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy the agent wallet address"
        onPress={() => void Clipboard.setStringAsync(w.address)}
        style={({ pressed }) => [styles.address, pressed && styles.pressed]}
      >
        <Text style={styles.addressText}>{shortAddress(w.address)}</Text>
        <Icon name="content-copy" size={14} color={colors.ink2} />
      </Pressable>
      <Text style={styles.balance}>
        {formatAmount(w.balances[0]!, TOKENS[0]!.decimals)}
        <Text style={styles.unit}> DUSD</Text>
      </Text>
    </View>
  ) : undefined;

  return (
    <Screen
      title="Agent wallet"
      header={hero}
      onBack={() => navigation.goBack()}
    >
      {agent.error ? (
        <Banner
          icon="cloud-off-outline"
          title="Could not read the chain"
          body={agent.error}
        />
      ) : null}
      {error ? (
        <Banner icon="alert-outline" title="Not done" body={error} />
      ) : null}
      {agent.loading && !w ? <Voice>Checking the chain…</Voice> : null}
      {!agent.loading && !w && !agent.error ? (
        <>
          <Voice>No agent wallet for this account.</Voice>
          <Note>
            An agent wallet is a separate contract you own. Creating it costs a
            small network fee in ETH. Register with the Mandate service below to
            run tasks.
          </Note>
          <PrimaryButton
            label={busy ? "Creating…" : "Create agent wallet"}
            disabled={busy}
            onPress={create}
          />
        </>
      ) : null}
      {w ? (
        <>
          <View style={styles.tiles}>
            <ActionTile
              icon="arrow-down"
              label="Fund"
              onPress={() => {
                updateDraft(context, {
                  recipient: w.address,
                  asset: "DemoUSD",
                });
                navigation.navigate("Send");
              }}
            />
            <ActionTile
              icon="arrow-up"
              label="Move out"
              onPress={() =>
                navigation.navigate("OwnerMoveOut", { wallet: w.address })
              }
            />
            <ActionTile
              icon="tune-variant"
              label="Limits"
              onPress={() =>
                navigation.navigate("WalletLimits", { wallet: w.address })
              }
            />
            <ActionTile
              icon="check-decagram-outline"
              label="Approvals"
              onPress={() =>
                navigation.navigate("Approvals", { wallet: w.address })
              }
            />
          </View>

          <SectionHeading>Tokens</SectionHeading>
          <Group>
            {TOKENS.map((t, i) => (
              <IconRow
                key={t.name}
                icon={
                  t.symbol === "ETH"
                    ? "ethereum"
                    : t.symbol === "USDC"
                      ? "currency-usd"
                      : "alpha-m-circle-outline"
                }
                tint="plain"
                title={t.name}
                detail={t.symbol}
                value={formatAmount(w.balances[i]!, t.decimals)}
              />
            ))}
          </Group>

          <SectionHeading>Safety</SectionHeading>
          <Group>
            <IconRow
              icon={w.paused ? "play-circle-outline" : "pause-circle-outline"}
              tint="warn"
              title={w.paused ? "Resume agents" : "Pause all agents"}
              detail={
                w.paused
                  ? "Old approvals stay ended."
                  : "Nothing new is paid. Resuming needs new approvals."
              }
              onPress={() =>
                navigation.navigate("AgentControl", {
                  command: w.paused ? "UNPAUSE" : "PAUSE",
                  wallet: w.address,
                })
              }
            />
            <IconRow
              icon="snowflake"
              tint="bad"
              title={w.frozen ? "Unfreeze the wallet" : "Freeze the wallet"}
              detail={
                w.frozen
                  ? "Agents can pay again within their approvals."
                  : "Blocks every agent payment until you unfreeze it."
              }
              onPress={() =>
                navigation.navigate("AgentControl", {
                  command: w.frozen ? "UNFREEZE" : "FREEZE",
                  wallet: w.address,
                })
              }
            />
          </Group>

          <SectionHeading>Activity</SectionHeading>
          {events.loading ? (
            <Note>Reading recent events…</Note>
          ) : events.error ? (
            <Note>{events.error}</Note>
          ) : (events.data ?? []).length === 0 ? (
            <Note>Nothing happened in this wallet in about the last hour.</Note>
          ) : (
            <Group>
              {events.data!.map((e) => (
                <IconRow
                  key={`${e.hash}${e.name}`}
                  icon={EVENT_ICONS[e.name] ?? "history"}
                  title={EVENT_LABELS[e.name] ?? e.name}
                  detail={`Block ${e.block.toString()}`}
                  onPress={() =>
                    navigation.navigate("TxDetail", {
                      hash: e.hash,
                      origin: "service",
                    })
                  }
                />
              ))}
            </Group>
          )}
        </>
      ) : null}
      <ServiceAgent />
      <TextLink
        label="Refresh"
        onPress={() => {
          agent.reload();
          events.reload();
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.tile,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...type.label, color: colors.ink },
  address: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 32,
  },
  addressText: { ...type.small, fontFamily: fonts.mono, color: colors.ink2 },
  name: { ...type.heading, color: colors.ink },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  balance: { ...type.display, color: colors.ink },
  unit: { ...type.heading, color: colors.ink2, marginLeft: space.xs },
  tiles: { flexDirection: "row", gap: space.sm },
  pressed: { opacity: 0.7 },
}));
