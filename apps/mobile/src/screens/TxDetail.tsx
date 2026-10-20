import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { Linking } from "react-native";
import { GhostButton, Note, Row, Rows, Steps } from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { explorerTx, receipt, transaction } from "../wallet/chain";
import { formatSmall, shortAddress } from "../wallet/format";
import { useAsync } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "TxDetail">;

// One transaction, read from the chain. Pending until it is in a block.
export function TxDetailScreen({ navigation, route }: Props) {
  const { hash, origin = "phone", taskId } = route.params;
  const tx = useAsync(() => transaction(hash), [hash]);
  const rcpt = useAsync(() => receipt(hash), [hash]);
  const done = rcpt.data != null;
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      rcpt.reload();
      if (!tx.data) tx.reload();
    }, 4000);
    return () => clearInterval(id);
  }, [done, tx.data, rcpt, tx]);
  const status = !done
    ? "Pending"
    : rcpt.data!.status === "success"
      ? "Confirmed"
      : "Failed";
  return (
    <Page
      title={
        status === "Pending"
          ? "Sending"
          : status === "Confirmed"
            ? "Sent"
            : "Failed"
      }
      subtitle={
        status === "Pending"
          ? "Sent to the network. Waiting for a block."
          : status === "Confirmed"
            ? `In block ${rcpt.data!.blockNumber.toString()}.`
            : "The transaction was included but did not succeed. No tokens moved; the fee was paid."
      }
      onBack={() => navigation.goBack()}
      footer={
        <GhostButton
          label="View on block explorer"
          onPress={() => Linking.openURL(explorerTx(hash))}
        />
      }
    >
      <Steps
        items={[
          {
            state: "done",
            title:
              origin === "phone"
                ? "Signed on this phone"
                : origin === "agent"
                  ? "Agent transaction reported by service"
                  : "Transaction reported by service",
          },
          { state: tx.data ? "done" : "now", title: "Sent to the network" },
          {
            state: done ? "done" : "now",
            title: status === "Failed" ? "Failed" : "In a block",
          },
        ]}
      />
      <Rows>
        <Row label="Transaction" value={shortAddress(hash)} mono />
        {tx.data ? (
          <Row label="From" value={shortAddress(tx.data.from)} mono />
        ) : null}
        {tx.data?.to ? (
          <Row
            label="To contract or address"
            value={shortAddress(tx.data.to)}
            mono
          />
        ) : null}
        {rcpt.data ? (
          <Row
            label="Network fee"
            value={`${formatSmall(rcpt.data.gasUsed * rcpt.data.effectiveGasPrice, 18)} ETH`}
          />
        ) : null}
      </Rows>
      {tx.error ? <Note>{tx.error}</Note> : null}
      {taskId ? (
        <GhostButton
          label="View task"
          onPress={() => navigation.navigate("TaskDetail", { taskId })}
        />
      ) : null}
    </Page>
  );
}
