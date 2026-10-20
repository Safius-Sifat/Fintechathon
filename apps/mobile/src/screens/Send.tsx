import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { Text, TextInput, View } from "react-native";
import { PrimaryButton } from "../components/Button";
import { Chips, Keypad, Note } from "../components/blocks";
import { Frame, RoundButton } from "../components/Page";
import type { TransferAsset } from "../config/transfer";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { clearDraft, updateDraft, type SendDraft } from "../state/sendDraft";
import { useDraftContext, useSendDraft } from "../state/useSendDraft";
import { fonts, makeStyles, space, type, useColors } from "../theme";
import { balanceOf } from "../wallet/chain";
import { checkAddress, checkAmount } from "../wallet/core";
import { formatAmount, tokenByName } from "../wallet/format";
import { currentAccount } from "../wallet/session";
import { useAsync } from "../wallet/useAsync";
import { formatUnits } from "viem";

type Props = NativeStackScreenProps<RootStackParamList, "Send">;

// Send form. The recipient and amount are checked as they are typed; the
// review screen quotes the fee and the owner confirms before anything is
// signed. Leaving Send discards the draft.
export function SendScreen({ navigation }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const context = useDraftContext();
  const draft = useSendDraft(context);
  const set = (patch: Partial<SendDraft>) => updateDraft(context, patch);
  const token = tokenByName(draft.asset);
  const account = currentAccount();
  const available = useAsync(
    () => (account ? balanceOf(token, account.address) : Promise.resolve(0n)),
    [account?.address, token.name],
  );
  const to = checkAddress(draft.recipient);
  const amount = checkAmount(draft.amount, token.decimals);
  const tooMuch =
    amount.ok && available.data !== undefined && amount.value > available.data;
  const canReview = to.ok && amount.ok && !tooMuch;

  useEffect(
    () => navigation.addListener("beforeRemove", () => clearDraft(context)),
    [navigation, context],
  );

  const problem =
    draft.recipient && !to.ok
      ? to.error
      : draft.amount && !amount.ok
        ? amount.error
        : tooMuch
          ? "More than you have."
          : null;

  return (
    <Frame
      title="Send"
      onBack={() => navigation.goBack()}
      right={
        <RoundButton
          icon="account-box-outline"
          label="Choose a contact"
          onPress={() => navigation.navigate("Contacts", { pick: true })}
        />
      }
      footer={
        <PrimaryButton
          label="Review"
          disabled={!canReview}
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
          value={draft.recipient}
          onChangeText={(text) => set({ recipient: text })}
          placeholder="0x… address on Base Sepolia"
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
          accessibilityLabel={`Amount ${draft.amount || "0"} ${token.name}`}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {draft.amount === "" ? "0" : draft.amount}
        </Text>
        <Chips<TransferAsset>
          options={[
            { key: "DemoUSD", label: "DemoUSD" },
            { key: "ETH", label: "ETH" },
            { key: "USDC", label: "USDC" },
          ]}
          selected={draft.asset}
          onSelect={(key) => set({ asset: key })}
        />
        <Text style={styles.available}>
          {available.data !== undefined
            ? `Available ${formatAmount(available.data, token.decimals)} ${token.symbol}`
            : available.error
              ? "Balance unavailable"
              : "Reading balance…"}
          {available.data !== undefined && token.address ? (
            <Text
              style={styles.max}
              onPress={() =>
                set({ amount: formatUnits(available.data!, token.decimals) })
              }
            >
              {"  ·  Max"}
            </Text>
          ) : null}
        </Text>
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      </View>

      <Keypad value={draft.amount} onChange={(next) => set({ amount: next })} />
      <Note>From your personal account. The network fee is paid in ETH.</Note>
    </Frame>
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
  amountBlock: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  amount: {
    fontFamily: fonts.serifBold,
    fontSize: 72,
    lineHeight: 80,
    color: colors.ink,
  },
  available: { ...type.small, color: colors.ink2, textAlign: "center" },
  max: { ...type.bodyStrong, color: colors.ink },
  problem: { ...type.small, color: colors.ink, textAlign: "center" },
}));
