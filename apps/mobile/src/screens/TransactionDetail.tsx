import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, Divider } from "../components/Card";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { TxStatusChip } from "../components/TxStatusChip";
import { findSample } from "../config/devSamples";
import { network } from "../config/network";
import { SOURCE_LABELS } from "../config/transfer";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Transaction detail layout. No real transaction exists yet, so this screen
// is only reachable from development samples and always says so. The token
// amount and the network fee are separate: a fee is never added to a token
// amount.

type Props = NativeStackScreenProps<RootStackParamList, "TransactionDetail">;

export function TransactionDetailScreen({ navigation, route }: Props) {
  const sample = findSample(route.params.sampleId);
  const back = () => navigation.goBack();
  if (!__DEV__ || !sample) {
    return (
      <Screen title="Transaction" onBack={back}>
        <Banner
          icon="information-outline"
          title="Not available"
          body="Transaction details need a real history, which this build cannot read."
        />
      </Screen>
    );
  }
  const sent = sample.direction === "sent";
  return (
    <Screen title={sample.title} subtitle="Development sample" onBack={back}>
      <Banner
        icon="flask-outline"
        title="Development sample, not a real transaction"
        body="Amounts, addresses and the hash are placeholders for reviewing this layout."
      />

      <Card>
        <TxStatusChip state={sample.state} />
        <Text style={styles.label}>
          {sent ? "Amount sent" : "Amount received"}
        </Text>
        <Text style={styles.amount}>
          {sample.amount} {sample.asset}
        </Text>
        <StatusTag state="unavailable" label="Development sample" />
        <Divider />
        <DetailRow label="Wallet" value={SOURCE_LABELS[sample.source]} />
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Network fee</Text>
        <DetailRow label="Fee" value={sample.fee} />
        <DetailRow label="Paid by" value={sample.feePayer} />
        <Text style={styles.caption}>
          {sample.asset === "ETH"
            ? "The fee is paid in ETH on top of the amount."
            : `The fee is paid in ETH. It is not part of the ${sample.asset} amount and is never added to it.`}
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Details</Text>
        <DetailRow label="From" value={sample.from} />
        <DetailRow label="To" value={sample.to} />
        <DetailRow label="Nonce" value={sample.nonce} />
        {sample.replaces ? (
          <DetailRow label="Replacement" value={sample.replaces} />
        ) : null}
        <DetailRow label="Data source" value={sample.dataSource} />
        <DetailRow label="Transaction hash" value="Sample hash" muted />
      </Card>

      <View style={styles.actions}>
        <OutlineButton
          label="View on explorer"
          icon="open-in-new"
          disabled
          accessibilityHint="Unavailable. Samples have no transaction to open."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...type.small, color: colors.textMuted },
  amount: { ...type.hero, color: colors.ink },
  cardTitle: { ...type.heading, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
