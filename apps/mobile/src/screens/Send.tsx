import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton, PrimaryButton } from "../components/Button";
import { Card, DetailRow } from "../components/Card";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import {
  FEE_PAYER,
  SOURCE_LABELS,
  type TransferAsset,
  type TransferSource,
} from "../config/transfer";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, fonts, radius, space, tones, type } from "../theme";

// Send form preview. The fields work locally so the layout can be reviewed,
// but nothing typed here is checked: there is no balance, fee quote, address
// or amount validation, and no signing. The form never sends anything.

type Props = NativeStackScreenProps<RootStackParamList, "Send">;

export function SendScreen({ navigation }: Props) {
  const [source, setSource] = useState<TransferSource>("personal");
  const [asset, setAsset] = useState<TransferAsset>("ETH");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const canReview = recipient.trim() !== "" && amount.trim() !== "";

  return (
    <Screen
      title="Send"
      subtitle={`Send test funds on ${network.name}.`}
      onBack={() => navigation.goBack()}
    >
      <Card>
        <Segmented
          label="From"
          options={[
            { key: "personal", label: SOURCE_LABELS.personal },
            {
              key: "agent",
              label: SOURCE_LABELS.agent,
              detail: "Not connected",
            },
          ]}
          selected={source}
          onSelect={setSource}
        />
        <DetailRow
          label={source === "personal" ? "Account" : "Agent wallet"}
          value={source === "personal" ? "No account yet" : "Not connected"}
          muted
        />
        <DetailRow label="Spendable" value="Unavailable" muted />
        {source === "agent" ? <OwnerTransferNote /> : null}
      </Card>

      <Card>
        <Segmented
          label="Asset"
          options={[
            { key: "ETH", label: "ETH" },
            { key: "DemoUSD", label: "DemoUSD" },
          ]}
          selected={asset}
          onSelect={setAsset}
        />
        <Text style={styles.caption}>
          {asset === "ETH"
            ? "Test ETH on Base Sepolia."
            : "DemoUSD, Mandate's test token. The network fee is still paid in ETH."}
        </Text>
      </Card>

      <Card>
        <Text style={styles.fieldLabel} nativeID="recipient-label">
          To
        </Text>
        <TextInput
          accessibilityLabelledBy="recipient-label"
          value={recipient}
          onChangeText={setRecipient}
          placeholder={`0x… address on ${network.name}`}
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          style={[styles.input, styles.mono]}
        />
        <View style={styles.actions}>
          <OutlineButton
            label="Scan"
            icon="qrcode-scan"
            disabled
            accessibilityHint="Unavailable. Reading payment requests is not built yet."
          />
          <OutlineButton
            label="Contacts"
            icon="account-box-outline"
            disabled
            accessibilityHint="Unavailable. Contacts are not built yet."
          />
        </View>
        <Text style={styles.caption}>
          Address checks are not built yet. What you type here is not checked.
        </Text>
      </Card>

      <Card>
        <Text style={styles.fieldLabel} nativeID="amount-label">
          Amount
        </Text>
        <View style={styles.amountRow}>
          <TextInput
            accessibilityLabelledBy="amount-label"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.0"
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
            style={[styles.input, styles.amountInput]}
          />
          <Text style={styles.assetSuffix}>{asset}</Text>
        </View>
        <View style={styles.actions}>
          <OutlineButton
            label="Max"
            icon="arrow-collapse-up"
            disabled
            accessibilityHint="Unavailable. The spendable balance is unknown."
          />
        </View>
        <Text style={styles.caption}>
          The spendable balance is unavailable, and amounts are not checked yet.
        </Text>
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>Network fee</Text>
        <DetailRow label="Fee" value="Quote unavailable" muted />
        <DetailRow label="Paid by" value={FEE_PAYER[source]} />
      </Card>

      <PrimaryButton
        label="Review"
        disabled={!canReview}
        accessibilityHint={
          canReview
            ? "Shows the transfer details. Nothing is sent."
            : "Enter a recipient and an amount first."
        }
        onPress={() =>
          navigation.navigate("TransferReview", {
            source,
            asset,
            recipient: recipient.trim(),
            amount: amount.trim(),
          })
        }
      />

      <Banner
        icon="information-outline"
        title="Not available in this build"
        body="Balances, fee quotes, address and amount checks, and signing are not built yet. Nothing can be sent."
      />
    </Screen>
  );
}

// Sending from the agent wallet is owner governance, not a normal payment.
export function OwnerTransferNote() {
  return (
    <View style={styles.callout}>
      <Icon name="pause-circle-outline" size={22} color={tones.amber.fg} />
      <View style={styles.calloutText}>
        <Text style={styles.calloutTitle}>This is an owner transfer</Text>
        <Text style={styles.calloutBody}>
          Sending from the agent wallet pauses it and ends every active agent
          permission. Agents need new approvals afterwards.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { ...type.small, color: colors.textMuted },
  fieldLabel: { ...type.heading, color: colors.ink },
  input: {
    ...type.body,
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.14)",
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  mono: { fontFamily: fonts.mono },
  amountRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  amountInput: { flex: 1, fontSize: 22, lineHeight: 28 },
  assetSuffix: { ...type.bodyStrong, color: colors.textMuted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  callout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: tones.amber.bg,
  },
  calloutText: { flex: 1, gap: 2 },
  calloutTitle: { ...type.bodyStrong, color: tones.amber.fg },
  calloutBody: { ...type.small, color: colors.text },
});
