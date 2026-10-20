import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { Text, TextInput, View } from "react-native";
import { PrimaryButton } from "../components/Button";
import { Chips, Keypad } from "../components/blocks";
import { Icon } from "../components/Icon";
import { Frame, RoundButton } from "../components/Page";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  clearDraft,
  isDraftComplete,
  updateDraft,
  type SendDraft,
} from "../state/sendDraft";
import { currentDraftContext, useSendDraft } from "../state/useSendDraft";
import { fonts, makeStyles, radius, space, type, useColors } from "../theme";

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
    <Frame
      title="Send"
      onBack={() => navigation.goBack()}
      right={
        <RoundButton
          icon="qrcode-scan"
          label="Scan a payment request"
          onPress={() => navigation.navigate("Scan")}
        />
      }
      footer={
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
      }
    >
      <View style={styles.toRow}>
        <Text style={styles.toLabel} nativeID="recipient-label">
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
          style={styles.toInput}
        />
      </View>

      <View style={styles.amountBlock}>
        <Text
          style={styles.amount}
          accessibilityLabel={`Amount ${amount === "" ? "0" : amount} ${asset}`}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {amount === "" ? "0" : amount}
        </Text>
        <Chips
          options={[
            { key: "DemoUSD", label: "DemoUSD" },
            { key: "ETH", label: "ETH" },
          ]}
          selected={asset}
          onSelect={(key) => set({ asset: key })}
        />
        <Text style={styles.available}>
          Available: unavailable. Nothing is checked or sent in this build.
        </Text>
      </View>

      <View style={styles.fromRow}>
        <Text style={styles.toLabel}>From</Text>
        <Chips
          options={[
            { key: "personal", label: "Personal account" },
            { key: "agent", label: "Agent wallet" },
          ]}
          selected={source}
          onSelect={(key) => set({ source: key })}
        />
      </View>
      {source === "agent" ? <OwnerTransferNote /> : null}

      <Keypad value={amount} onChange={(next) => set({ amount: next })} />
    </Frame>
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
  toRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    minHeight: 56,
  },
  toLabel: { ...type.body, color: colors.ink2 },
  toInput: {
    ...type.body,
    flex: 1,
    fontFamily: fonts.mono,
    color: colors.ink,
    paddingVertical: space.md,
  },
  fromRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingTop: space.md,
  },
  amountBlock: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  amount: {
    fontFamily: fonts.serifBold,
    fontSize: 72,
    lineHeight: 80,
    color: colors.ink,
  },
  available: { ...type.small, color: colors.ink2, textAlign: "center" },
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
