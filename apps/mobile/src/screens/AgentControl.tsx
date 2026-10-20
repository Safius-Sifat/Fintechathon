import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Banner } from "../components/Banner";
import { GhostButton, HoldToSeal, Note, Row, Rows } from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { applyAdmin } from "../wallet/relay";
import type { AdminCommandName } from "../wallet/core";
import { shortAddress } from "../wallet/format";
import { currentAccount } from "../wallet/session";
import { errorText } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "AgentControl">;

const TITLES: Record<AdminCommandName, string> = {
  PAUSE: "Pause all agents",
  UNPAUSE: "Resume agents",
  FREEZE: "Freeze the agent wallet",
  UNFREEZE: "Unfreeze the agent wallet",
};

const HOLD: Record<AdminCommandName, string> = {
  PAUSE: "Press and hold to pause",
  UNPAUSE: "Press and hold to resume",
  FREEZE: "Press and hold to freeze",
  UNFREEZE: "Press and hold to unfreeze",
};

const EFFECTS: Record<AdminCommandName, [string, string][]> = {
  PAUSE: [
    ["Applies at", "When on the chain"],
    ["Payments already sent", "May still settle"],
    ["Resume", "New approvals needed"],
  ],
  UNPAUSE: [
    ["Applies at", "When on the chain"],
    ["Old approvals", "Stay ended"],
  ],
  FREEZE: [
    ["Agent payments", "All blocked"],
    ["Your account", "Not affected"],
    ["Lift it", "Only you, from here"],
  ],
  UNFREEZE: [
    ["Agent payments", "Allowed within approvals"],
    ["Applies at", "When on the chain"],
  ],
};

// Signs one owner command (EIP-712 Admin, valid 30 minutes). The Mandate
// service relays it when this wallet is registered; otherwise the personal
// account sends it and pays the fee.
export function AgentControlScreen({ navigation, route }: Props) {
  const { command, wallet } = route.params;
  const account = currentAccount();
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const sign = async () => {
    if (!account) return;
    try {
      const hash = await applyAdmin(wallet, command, account.address);
      navigation.replace("TxDetail", { hash });
    } catch (e) {
      setError(errorText(e));
      setKey((k) => k + 1);
    }
  };
  return (
    <Page
      title={TITLES[command]}
      subtitle="You sign this on your phone. It works without the Mandate service."
      onBack={() => navigation.goBack()}
      footer={
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
      }
    >
      <Rows>
        <Row label="Agent wallet" value={shortAddress(wallet)} mono />
        {EFFECTS[command].map(([k, v]) => (
          <Row key={k} label={k} value={v} />
        ))}
        <Row
          label="Fee"
          value="Relayed by Mandate, or paid from your account"
        />
      </Rows>
      {error ? (
        <Banner icon="alert-outline" title="Not done" body={error} />
      ) : null}
      <HoldToSeal key={key} label={HOLD[command]} onSealed={sign} />
      <Note>The change is real only once it is confirmed on the chain.</Note>
    </Page>
  );
}
