import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Chips, Note, Row, Rows, Voice } from "../components/blocks";
import { Screen } from "../components/Screen";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { shortAddress } from "../wallet/format";
import { readSent } from "../wallet/local";
import { currentAccount, useWallet } from "../wallet/session";
import { useAsync } from "../wallet/useAsync";

type Filter = "all" | "send" | "admin";

// Transactions this phone signed for the current account. Incoming transfers
// and agent payments need the Mandate history service, which is not
// connected, so they are not listed and the screen says so.
export function ActivityScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useWallet();
  const account = currentAccount();
  const [filter, setFilter] = useState<Filter>("all");
  const sent = useAsync(readSent, []);
  useFocusEffect(useCallback(() => sent.reload(), [sent.reload]));
  const items = (sent.data ?? []).filter(
    (t) =>
      t.from.toLowerCase() === account?.address.toLowerCase() &&
      (filter === "all" || t.kind === filter),
  );
  return (
    <Screen title="Activity">
      <Chips<Filter>
        options={[
          { key: "all", label: "All" },
          { key: "send", label: "Sent" },
          { key: "admin", label: "Agent controls" },
        ]}
        selected={filter}
        onSelect={setFilter}
      />
      {items.length === 0 ? (
        <Voice>Nothing sent from this phone yet.</Voice>
      ) : (
        <Rows>
          {items.map((t) => (
            <Row
              key={t.hash}
              label={t.label}
              detail={`${new Date(t.createdAt).toLocaleString()} · to ${shortAddress(t.to)}`}
              value={t.kind === "send" ? `−${t.amount} ${t.symbol}` : undefined}
              onPress={() => navigation.navigate("TxDetail", { hash: t.hash })}
            />
          ))}
        </Rows>
      )}
      <Note>
        This lists what this phone sent. Incoming transfers and agent payments
        appear when the Mandate history service is connected.
      </Note>
    </Screen>
  );
}
