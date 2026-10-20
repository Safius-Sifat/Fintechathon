import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import { GhostButton, Note, Row, Rows } from "../components/blocks";
import { Frame } from "../components/Page";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { clearDraft } from "../state/sendDraft";
import { useDraftContext, useSendDraft } from "../state/useSendDraft";
import { fonts, makeStyles, space, type } from "../theme";
import { prepareSend, send } from "../wallet/chain";
import { checkAddress, checkAmount } from "../wallet/core";
import { formatAmount, shortAddress, tokenByName } from "../wallet/format";
import { readContacts } from "../wallet/local";
import { currentAccount } from "../wallet/session";
import { errorText, useAsync } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "TransferReview">;

// Shows exactly what will be signed: amount, recipient, network and the fee
// quote. Confirming asks for Face ID or the passcode, then signs and sends.
export function TransferReviewScreen({ navigation }: Props) {
  const styles = useStyles();
  const context = useDraftContext();
  const draft = useSendDraft(context);
  const token = tokenByName(draft.asset);
  const account = currentAccount();
  const to = checkAddress(draft.recipient);
  const amount = checkAmount(draft.amount, token.decimals);
  const quote = useAsync(async () => {
    if (!account || !to.ok || !amount.ok)
      throw new Error("The form is incomplete.");
    const [prepared, contacts] = await Promise.all([
      prepareSend(token, account.address, to.value, amount.value),
      readContacts(),
    ]);
    const contact = contacts.find(
      (c) => c.address.toLowerCase() === to.value.toLowerCase(),
    );
    return { prepared, contact };
  }, [account?.address, draft.recipient, draft.amount, token.name]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!quote.data) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await send(quote.data.prepared, draft.amount.trim());
      clearDraft(context);
      navigation.reset({
        index: 1,
        routes: [{ name: "Tabs" }, { name: "TxDetail", params: { hash } }],
      });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Frame
      title="Review"
      onBack={() => navigation.goBack()}
      footer={
        <View style={styles.pair}>
          <View style={styles.half}>
            <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
          </View>
          <View style={styles.half}>
            <PrimaryButton
              label={busy ? "Sending…" : "Confirm and send"}
              disabled={!quote.data || busy}
              onPress={confirm}
            />
          </View>
        </View>
      }
    >
      <View style={styles.sendBlock}>
        <Text style={styles.label}>You send</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amount}>{draft.amount.trim()}</Text>
          <Text style={styles.unit}>{token.symbol}</Text>
        </View>
      </View>
      <Rows>
        <Row
          label="To"
          value={to.ok ? shortAddress(to.value) : draft.recipient}
          detail={
            quote.data?.contact
              ? quote.data.contact.name
              : "Not in your contacts"
          }
          mono
        />
        <Row label="From" value={account?.label ?? ""} />
        <Row label="Network" value={network.name} />
        <Row
          label="Network fee"
          value={
            quote.data
              ? `${formatAmount(quote.data.prepared.fee, 18)} ETH`
              : quote.loading
                ? "Quoting…"
                : "Unavailable"
          }
          detail="At most. Paid from your ETH balance."
        />
      </Rows>
      {quote.error ? (
        <Banner icon="alert-outline" title="Cannot send" body={quote.error} />
      ) : null}
      {error ? (
        <Banner icon="alert-outline" title="Not sent" body={error} />
      ) : null}
      <Note>
        {token.address
          ? `The ${token.name} amount and the ETH fee are different assets, so they are never added together.`
          : "The total is the amount plus the network fee, both in ETH."}
      </Note>
      <Note>Transfers on a blockchain cannot be undone.</Note>
    </Frame>
  );
}

const useStyles = makeStyles((colors) => ({
  sendBlock: { gap: space.xs },
  label: { ...type.body, color: colors.ink2 },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  amount: { ...type.display, fontFamily: fonts.serifBold, color: colors.ink },
  unit: { ...type.heading, fontSize: 22, color: colors.ink2 },
  pair: { flexDirection: "row", gap: space.md },
  half: { flex: 1 },
}));
