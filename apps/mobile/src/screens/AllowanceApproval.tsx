import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AmountField } from "../components/AmountField";
import { Banner } from "../components/Banner";
import { PrimaryButton, TextButton } from "../components/Button";
import { Card, DetailRow, Divider } from "../components/Card";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { ToggleRow } from "../components/ToggleRow";
import { CEILINGS } from "../config/agentLimits";
import { network } from "../config/network";
import {
  AGENT_ASSET_OPTIONS,
  ASSET_LABELS,
  PROVIDER_LABELS,
} from "../config/taskLabels";
import { formatAgentAmount } from "../domain/amounts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  PROVIDERS,
  allowanceSummary,
  clearTaskDraft,
  toggleAllowanceProvider,
  updateAllowanceDraft,
  validateAllowanceDraft,
} from "../state/taskDraft";
import { currentDraftContext } from "../state/useSendDraft";
import { useTaskDrafts } from "../state/useTaskDrafts";
import { colors, space, tones, type } from "../theme";

// Service allowance preview (plan S9.7, P3-A02; runbook "service-allowance",
// Permit kind ALLOWANCE). The form works locally and states the allowance in
// plain words. Nothing is checked against the wallet policy, drafted or
// signed: that needs the Mandate service and the native confirmation screen.
// Leaving discards the draft.

type Props = NativeStackScreenProps<RootStackParamList, "AllowanceApproval">;

const NOT_DRAFTED = "Not drafted yet";

export function AllowanceApprovalScreen({ navigation }: Props) {
  const context = currentDraftContext;
  const draft = useTaskDrafts(context).allowance;
  const set = updateAllowanceDraft.bind(null, context);
  const check = validateAllowanceDraft(draft);
  const summary = allowanceSummary(draft);
  const label = ASSET_LABELS[draft.asset];
  const daily = draft.period === "daily";
  const periodCeiling = daily ? CEILINGS.walletDay : CEILINGS.walletWeek;

  useEffect(
    () =>
      navigation.addListener("beforeRemove", () =>
        clearTaskDraft(context, "allowance"),
      ),
    [navigation, context],
  );

  return (
    <Screen
      title="Service allowance"
      subtitle="Let your agent buy allowed services when it needs them, up to a cap each day or week."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <Segmented
          label="Pay with"
          options={AGENT_ASSET_OPTIONS}
          selected={draft.asset}
          onSelect={(asset) => set({ asset })}
        />
        <Segmented
          label="Budget period"
          options={[
            { key: "daily", label: "Daily" },
            { key: "weekly", label: "Weekly" },
          ]}
          selected={draft.period}
          onSelect={(period) => set({ period })}
        />
        <AmountField
          label={daily ? "Cap per day" : "Cap per week"}
          value={draft.periodCap}
          onChangeText={(t) => set({ periodCap: t })}
          placeholder={`0.00 ${label}`}
          hint={`Up to ${formatAgentAmount(periodCeiling)} ${label}`}
          error={check.fieldErrors.periodCap}
        />
        <AmountField
          label="Total cap"
          value={draft.spendCap}
          onChangeText={(t) => set({ spendCap: t })}
          placeholder={`0.00 ${label}`}
          hint="The most it can spend over the whole allowance"
          error={check.fieldErrors.spendCap}
        />
        <AmountField
          label="Most per purchase"
          value={draft.maxPayment}
          onChangeText={(t) => set({ maxPayment: t })}
          placeholder={`0.00 ${label}`}
          hint={`Up to ${formatAgentAmount(CEILINGS.perPayment)} ${label}`}
          error={check.fieldErrors.maxPayment}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Providers it may buy from</Text>
        {PROVIDERS.map((p) => (
          <ToggleRow
            key={p}
            label={PROVIDER_LABELS[p]}
            detail="Price: quote unavailable"
            checked={draft.providerIds.includes(p)}
            onToggle={() => toggleAllowanceProvider(context, p)}
          />
        ))}
        <Text style={styles.caption}>
          Addresses and what each provider offers come from the trusted
          manifest, which this build does not load.
        </Text>
      </Card>

      <Card>
        <AmountField
          label="Lasts (days)"
          value={draft.days}
          onChangeText={(t) => set({ days: t })}
          placeholder="1 to 30"
          hint={`At most ${CEILINGS.allowanceDays} days`}
          error={check.fieldErrors.days}
          integer
        />
        <AmountField
          label="Most purchases"
          value={draft.maxPurchases}
          onChangeText={(t) => set({ maxPurchases: t })}
          placeholder={`1 to ${CEILINGS.allowanceActions}`}
          hint={`At most ${CEILINGS.allowanceActions} over the whole allowance`}
          error={check.fieldErrors.maxPurchases}
          integer
        />
        <DetailRow
          label="Minimum balance kept"
          value={`At least ${formatAgentAmount(CEILINGS.liquidFloor)} ${label}`}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>In plain words</Text>
        {summary ? (
          summary.map((line) => (
            <View key={line} style={styles.line}>
              <Icon name="check" size={18} color={tones.amber.fg} />
              <Text style={[styles.body, styles.flex]}>{line}</Text>
            </View>
          ))
        ) : (
          <>
            <Text style={styles.body}>
              Fill in the form to see the allowance in plain words.
            </Text>
            {check.missing.length > 0 ? (
              <Text style={styles.caption}>
                Still needed: {check.missing.join(", ")}
              </Text>
            ) : null}
          </>
        )}
        <Divider />
        <Text style={styles.caption}>
          Your wallet policy also applies and can only make this smaller. It is
          not checked in this build.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Terms you would sign</Text>
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
        <DetailRow label="Agent wallet" value="Not created" muted />
        <DetailRow label="Cap per period" value={NOT_DRAFTED} muted />
        <DetailRow label="Total spend cap" value={NOT_DRAFTED} muted />
        <DetailRow label="Most per purchase" value={NOT_DRAFTED} muted />
        <DetailRow
          label="Recipients"
          value="From the trusted manifest (not loaded)"
          muted
        />
        <DetailRow label="Starts and expires" value={NOT_DRAFTED} muted />
        <DetailRow
          label="Needs your approval above"
          value={NOT_DRAFTED}
          muted
        />
        <Text style={styles.caption}>
          The Mandate service drafts these terms and this phone checks them
          before you sign. No draft exists in this build.
        </Text>
      </Card>

      <PrimaryButton
        label="Approve on this phone"
        icon="fingerprint"
        disabled
        accessibilityHint="Unavailable. An allowance needs the Mandate service and the native confirmation screen."
      />
      <TextButton
        label="Discard draft"
        accessibilityHint="Clears this form"
        onPress={() => clearTaskDraft(context, "allowance")}
      />
      <Banner
        icon="information-outline"
        title="Not available in this build"
        body="An allowance is a signed permission that can last up to 30 days. Nothing typed here is checked against your policy or sent."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  caption: { ...type.small, color: colors.textMuted },
  line: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
});
