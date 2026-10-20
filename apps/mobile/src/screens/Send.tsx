import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { Text, TextInput, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton, PrimaryButton, TextButton } from "../components/Button";
import { Card, DetailRow } from "../components/Card";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { FEE_PAYER, SOURCE_LABELS } from "../config/transfer";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  clearDraft,
  isDraftComplete,
  updateDraft,
  type SendDraft,
} from "../state/sendDraft";
import { currentDraftContext, useSendDraft } from "../state/useSendDraft";
import { fonts, radius, space, type, makeStyles, useColors } from "../theme";

// Send form preview. The fields work locally so the layout can be reviewed,
// but nothing typed here is checked: there is no balance, fee quote, address
// or amount validation, and no signing. The form never sends anything.
// The draft lives in an in-memory store (state/sendDraft.ts) so it survives
// a font-size remount and Review -> Edit; leaving Send discards it.

type Props = NativeStackScreenProps<RootStackParamList, "Send">;

export function SendScreen({ navigation }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const context = currentDraftContext;
  const { source, asset, recipient, amount } = useSendDraft(context);
  const set = (patch: Partial<SendDraft>) => updateDraft(context, patch);
  const canReview = isDraftComplete({ source, asset, recipient, amount });

  // Leaving Send by any route (back button, Android back, gesture) cancels
  // the draft. A font-size remount unmounts without removing the screen, so
  // it keeps the draft.
  useEffect(
    () => navigation.addListener("beforeRemove", () => clearDraft(context)),
    [navigation, context],
  );

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
          onSelect={(key) => set({ source: key })}
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
          onSelect={(key) => set({ asset: key })}
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
          onChangeText={(text) => set({ recipient: text })}
          placeholder={`0x… address on ${network.name}`}
          placeholderTextColor={colors.ink3}
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
            onChangeText={(text) => set({ amount: text })}
            placeholder="0.0"
            placeholderTextColor={colors.ink3}
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
        onPress={() => navigation.navigate("TransferReview")}
      />
      <TextButton
        label="Discard draft"
        accessibilityHint="Clears the recipient, amount and choices"
        onPress={() => clearDraft(context)}
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
// The effect only follows a successful, confirmed transfer.
export function OwnerTransferNote() {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.callout}>
      <Icon name="pause-circle-outline" size={22} color={colors.ink} />
      <View style={styles.calloutText}>
        <Text style={styles.calloutTitle}>This is an owner transfer</Text>
        <Text style={styles.calloutBody}>
          A successful owner transfer pauses agents and invalidates their
          existing permissions. Choosing or reviewing it does not stop anything
          yet.
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  caption: { ...type.small, color: colors.ink2 },
  fieldLabel: { ...type.heading, color: colors.ink },
  input: {
    ...type.body,
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.raised,
    color: colors.ink,
  },
  mono: { fontFamily: fonts.mono },
  amountRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  amountInput: { flex: 1, fontSize: 22, lineHeight: 28 },
  assetSuffix: { ...type.bodyStrong, color: colors.ink2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  callout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.tile,
  },
  calloutText: { flex: 1, gap: 2 },
  calloutTitle: { ...type.bodyStrong, color: colors.ink },
  calloutBody: { ...type.small, color: colors.ink },
}));
