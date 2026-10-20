import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Banner } from "../components/Banner";
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
import { agentWallet } from "../wallet/chain";
import { TOKENS } from "../wallet/config";
import { formatAmount, shortAddress } from "../wallet/format";
import { currentAccount, useWallet } from "../wallet/session";
import { useAsync } from "../wallet/useAsync";

// The agent wallet the factory recorded for this account, read from the
// chain. Pause and freeze are signed on this phone and sent from the personal
// account, so they work without the Mandate service.
export function AgentsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useWallet();
  const account = currentAccount();
  const agent = useAsync(
    () => (account ? agentWallet(account.address) : Promise.resolve(null)),
    [account?.address],
  );
  const w = agent.data;
  return (
    <Screen title="Agents">
      {agent.error ? (
        <Banner
          icon="cloud-off-outline"
          title="Could not read the chain"
          body={agent.error}
        />
      ) : null}
      {agent.loading && !w ? <Voice>Checking the chain…</Voice> : null}
      {!agent.loading && !w && !agent.error ? (
        <>
          <Voice>No agent wallet for this account.</Voice>
          <Note>
            An agent wallet is created by the Mandate service, which is not
            connected in this build. Once one exists, it shows here with its
            balance and the controls to pause or freeze it.
          </Note>
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
          <SectionHeading>Stop</SectionHeading>
          <Rows>
            {!w.paused ? (
              <Row
                label="Pause all agents"
                detail="Nothing new is paid. Resuming needs new approvals."
                onPress={() =>
                  navigation.navigate("AgentControl", {
                    command: "PAUSE",
                    wallet: w.address,
                  })
                }
              />
            ) : (
              <Row
                label="Resume"
                detail="Lifts the pause. Old approvals stay ended."
                onPress={() =>
                  navigation.navigate("AgentControl", {
                    command: "UNPAUSE",
                    wallet: w.address,
                  })
                }
              />
            )}
            {!w.frozen ? (
              <Row
                label="Freeze the wallet"
                detail="Blocks every agent payment until you unfreeze it."
                onPress={() =>
                  navigation.navigate("AgentControl", {
                    command: "FREEZE",
                    wallet: w.address,
                  })
                }
              />
            ) : (
              <Row
                label="Unfreeze the wallet"
                detail="Agents can pay again within their approvals."
                onPress={() =>
                  navigation.navigate("AgentControl", {
                    command: "UNFREEZE",
                    wallet: w.address,
                  })
                }
              />
            )}
          </Rows>
          <Note>
            Signing out of this app stops none of these. Tasks and approvals
            need the Mandate service.
          </Note>
        </>
      ) : null}
      <GhostButton label="Refresh" onPress={agent.reload} />
    </Screen>
  );
}
