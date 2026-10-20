import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import {
  BigAmount,
  GhostButton,
  Note,
  Row,
  Rows,
  SectionHeading,
  Voice,
} from "../components/blocks";
import { Screen } from "../components/Screen";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { updateDraft } from "../state/sendDraft";
import { useDraftContext } from "../state/useSendDraft";
import {
  agentWallet,
  createAgentWallet,
  recentAgentEvents,
} from "../wallet/chain";
import { TOKENS } from "../wallet/config";
import { formatAmount, shortAddress } from "../wallet/format";
import { currentAccount, useWallet } from "../wallet/session";
import { errorText, useAsync } from "../wallet/useAsync";

const EVENT_LABELS: Record<string, string> = {
  ActionExecuted: "Agent payment",
  OwnerTransferExecuted: "Moved out by you",
  WalletPaused: "Pause changed",
  WalletFrozen: "Freeze changed",
  WalletPolicyUpdated: "Wallet limits signed",
  PermitActivated: "Task approved",
};

// The agent wallet the factory recorded for this account, read from the
// chain. Everything here is signed on this phone and sent from the personal
// account, so it works without the Mandate service.
export function AgentsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

  return (
    <Screen title="Agents">
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
            small network fee in ETH. Running tasks in it also needs the Mandate
            service, which is not connected yet.
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
          <BigAmount
            value={formatAmount(w.balances[0]!, TOKENS[0]!.decimals)}
            unit="DUSD in the agent wallet"
          />
          <Rows>
            <Row label="Address" value={shortAddress(w.address)} mono />
            <Row
              label="State"
              value={w.frozen ? "Frozen" : w.paused ? "Paused" : "Active"}
            />
            {TOKENS.slice(1).map((t, i) => (
              <Row
                key={t.name}
                label={t.name}
                value={formatAmount(w.balances[i + 1]!, t.decimals)}
              />
            ))}
          </Rows>

          <SectionHeading>Money</SectionHeading>
          <Rows>
            <Row
              label="Approvals"
              detail="Payments the agent wants to make above your limit."
              onPress={() =>
                navigation.navigate("Approvals", { wallet: w.address })
              }
            />
            <Row
              label="Fund the agent wallet"
              detail="A normal send from your account. Funding is not spending."
              onPress={() => {
                updateDraft(context, {
                  recipient: w.address,
                  asset: "DemoUSD",
                });
                navigation.navigate("Send");
              }}
            />
            <Row
              label="Move funds out"
              detail="Back to you or another address. This pauses all agents."
              onPress={() =>
                navigation.navigate("OwnerMoveOut", { wallet: w.address })
              }
            />
            <Row
              label="Wallet limits"
              detail="Per payment, each day, each week, and who agents may pay."
              onPress={() =>
                navigation.navigate("WalletLimits", { wallet: w.address })
              }
            />
          </Rows>

          <SectionHeading>Stop</SectionHeading>
          <Rows>
            <Row
              label={w.paused ? "Resume" : "Pause all agents"}
              detail={
                w.paused
                  ? "Lifts the pause. Old approvals stay ended."
                  : "Nothing new is paid. Resuming needs new approvals."
              }
              onPress={() =>
                navigation.navigate("AgentControl", {
                  command: w.paused ? "UNPAUSE" : "PAUSE",
                  wallet: w.address,
                })
              }
            />
            <Row
              label={w.frozen ? "Unfreeze the wallet" : "Freeze the wallet"}
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
          </Rows>

          <SectionHeading>Last hour</SectionHeading>
          {events.loading ? (
            <Note>Reading recent events…</Note>
          ) : events.error ? (
            <Note>{events.error}</Note>
          ) : (events.data ?? []).length === 0 ? (
            <Note>Nothing happened in this wallet in about the last hour.</Note>
          ) : (
            <Rows>
              {events.data!.map((e) => (
                <Row
                  key={`${e.hash}${e.name}`}
                  label={EVENT_LABELS[e.name] ?? e.name}
                  detail={`Block ${e.block.toString()}`}
                  onPress={() =>
                    navigation.navigate("TxDetail", { hash: e.hash })
                  }
                />
              ))}
            </Rows>
          )}
          <Note>
            The public network only answers short history queries, so older
            events need the Mandate history service. Tasks and approvals need
            the Mandate service too.
          </Note>
        </>
      ) : null}
      <GhostButton
        label="Refresh"
        onPress={() => {
          agent.reload();
          events.reload();
        }}
      />
    </Screen>
  );
}
