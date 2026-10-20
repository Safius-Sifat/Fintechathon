import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { PrimaryButton, TextButton } from "../components/Button";
import { Card, DetailRow, Divider } from "../components/Card";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { FEE_PAYER, SOURCE_LABELS } from "../config/transfer";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fonts, radius, space, type, makeStyles, useColors } from "../theme";
import { currentDraftContext, useSendDraft } from "../state/useSendDraft";
import { OwnerTransferNote } from "./Send";

// Review preview. Reads the Send draft from the in-memory store and shows its values exactly as typed, marked as not
// checked, with no fee or total. Confirming is disabled: this build cannot
// sign, and nothing here is ever sent.

type Props = NativeStackScreenProps<RootStackParamList, "TransferReview">;

export function TransferReviewScreen({ navigation }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const { source, asset, recipient, amount } =
    useSendDraft(currentDraftContext);
  return (
    <Screen
      title="Review transfer"
      subtitle="Check every detail. Nothing can be sent from this build."
      onBack={() => navigation.goBack()}
    >
      {source === "agent" ? <OwnerTransferNote /> : null}

      <Card>
        <Text style={styles.label}>You send</Text>
        <Text style={styles.amount}>
          {amount.trim()} {asset}
        </Text>
        <StatusTag state="unavailable" label="Amount not checked" />
        <Divider />
        <DetailRow label="From" value={SOURCE_LABELS[source]} />
        <DetailRow
          label="Account"
          value={source === "personal" ? "No account yet" : "Not connected"}
          muted
        />
        <View style={styles.recipient}>
          <Text style={styles.label}>To</Text>
          <Text style={styles.address} selectable>
            {recipient.trim()}
          </Text>
          <StatusTag state="unavailable" label="Address not checked" />
        </View>
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Fees</Text>
        <DetailRow label="Network fee" value="Quote unavailable" muted />
        <DetailRow label="Paid by" value={FEE_PAYER[source]} />
        <DetailRow label="Total" value="Unavailable" muted />
        <Text style={styles.caption}>
          {asset === "ETH"
            ? "The total would be the amount plus the network fee, both in ETH."
            : "The DemoUSD amount and the ETH fee are shown separately and never added together."}
        </Text>
      </Card>

      <View style={styles.notice}>
        <Icon name="lock-outline" size={20} color={colors.ink2} />
        <Text style={styles.noticeText}>
          Signing is not available in this build. Nothing will be sent. When it
          is built, final confirmation happens on a protected screen of its own.
        </Text>
      </View>

      <PrimaryButton
        label="Confirm and send"
        icon="send-outline"
        disabled
        accessibilityHint="Unavailable. Signing is not built yet."
      />
      <TextButton label="Edit" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  cardTitle: { ...type.heading, color: colors.ink },
  label: { ...type.small, color: colors.ink2 },
  amount: { ...type.hero, color: colors.ink },
  recipient: { gap: space.xs },
  address: {
    ...type.body,
    fontFamily: fonts.mono,
    color: colors.ink,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.tile,
  },
  caption: { ...type.small, color: colors.ink2 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.xs,
  },
  noticeText: { ...type.small, color: colors.ink2, flex: 1 },
}));
