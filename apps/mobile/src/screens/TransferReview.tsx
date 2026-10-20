import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { PrimaryButton } from "../components/Button";
import { GhostButton, Note, Row, Rows } from "../components/blocks";
import { Frame } from "../components/Page";
import { FEE_PAYER, SOURCE_LABELS } from "../config/transfer";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { currentDraftContext, useSendDraft } from "../state/useSendDraft";
import { fonts, makeStyles, space, type } from "../theme";
import { OwnerTransferNote } from "./Send";

// Review preview. Reads the Send draft from the in-memory store and shows its
// values exactly as typed, marked as not checked, with no fee or total.
// Confirming is disabled: this build cannot sign, and nothing here is ever
// sent.

type Props = NativeStackScreenProps<RootStackParamList, "TransferReview">;

export function TransferReviewScreen({ navigation }: Props) {
  const styles = useStyles();
  const { source, asset, recipient, amount } =
    useSendDraft(currentDraftContext);
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
            <PrimaryButton label="Confirm and send" disabled />
          </View>
        </View>
      }
    >
      {source === "agent" ? <OwnerTransferNote /> : null}
      <View style={styles.sendBlock}>
        <Text style={styles.label}>You send</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amount}>{amount.trim()}</Text>
          <Text style={styles.unit}>{asset}</Text>
        </View>
        <Text style={styles.label}>Amount not checked</Text>
      </View>
      <Rows>
        <Row
          label="To"
          value={recipient.trim()}
          detail="Address not checked"
          mono
        />
        <Row label="From" value={SOURCE_LABELS[source]} />
        <Row label="Network" value={`${network.name}`} />
        <Row
          label="Network fee"
          value="Unavailable"
          detail={`Quote unavailable. Paid by: ${FEE_PAYER[source]}`}
        />
      </Rows>
      <Note>
        {asset === "ETH"
          ? "The total would be the amount plus the network fee, both in ETH."
          : "The DemoUSD amount and the ETH fee are different assets, so they are never added together."}
      </Note>
      <Note>
        Signing is not available in this build. Nothing will be sent. When it is
        built, final confirmation happens on a protected screen of its own.
      </Note>
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
