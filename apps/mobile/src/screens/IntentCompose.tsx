import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AmountField } from "../components/AmountField";
import { OutlineButton, PrimaryButton, TextButton } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { ToggleRow } from "../components/ToggleRow";
import { CEILINGS } from "../config/agentLimits";
import { SAMPLE_INTENT } from "../config/policySamples";
import {
  AGENT_ASSET_OPTIONS,
  ASSET_LABELS,
  PROVIDER_LABELS,
} from "../config/taskLabels";
import { formatAgentAmount } from "../domain/amounts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  TERM_LABELS,
  clearIntentDraft,
  discardCompiledIntent,
  editedTerms,
  loadCompiledIntent,
  setIntentGoal,
  toggleIntentProvider,
  updateIntentTerms,
  validateIntentTerms,
  type CompiledIntent,
  type IntentTerms,
} from "../state/intentDraft";
import { PROVIDERS } from "../state/taskDraft";
import { useIntentDraft } from "../state/useIntentDraft";
import { currentDraftContext } from "../state/useSendDraft";
import { colors, radius, space, type } from "../theme";

// Intent compose preview (plan S9.3, P3-A02). The owner describes a goal;
// the Mandate service would turn it into draft terms, which open here for
// editing. The service is not connected, so drafting is unavailable and the
// task forms are offered instead. Development builds can load a labelled
// sample draft to review the editing layout. Leaving discards the draft.

type Props = NativeStackScreenProps<RootStackParamList, "IntentCompose">;

export function IntentComposeScreen({ navigation }: Props) {
  const context = currentDraftContext;
  const state = useIntentDraft(context);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => clearIntentDraft(context)),
    [navigation, context],
  );

  const loadSample = () => {
    if (state.goal.trim() === "") setIntentGoal(context, SAMPLE_INTENT.goal);
    loadCompiledIntent(context, SAMPLE_INTENT);
  };

  return (
    <Screen
      title="Describe a goal"
      subtitle="Say what you need in your own words. You check every term before anything is signed."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <Text style={styles.fieldLabel} nativeID="intent-goal-label">
          Your goal
        </Text>
        <TextInput
          accessibilityLabelledBy="intent-goal-label"
          value={state.goal}
          onChangeText={(text) => setIntentGoal(context, text)}
          placeholder="e.g. Check that the staging checkout loads. Spend at most 1 DemoUSD."
          placeholderTextColor={colors.textSubtle}
          multiline
          style={[styles.input, styles.multiline]}
        />
        <Text style={styles.caption}>
          Shown next to the terms when you review. The agent is bound by the
          terms you sign, not by these words.
        </Text>
      </Card>

      {state.compiled && state.terms ? (
        <DraftEditor
          compiled={state.compiled}
          terms={state.terms}
          edited={editedTerms(state).map((k) => TERM_LABELS[k])}
          onReview={() => navigation.navigate("IntentReview")}
          onDiscard={() => discardCompiledIntent(context)}
        />
      ) : (
        <>
          <Card>
            <StateView
              icon="cloud-off-outline"
              tone="amber"
              title="Drafting unavailable"
              tag={<StatusTag state="unavailable" />}
              body="Turning a goal into draft terms needs the Mandate service, which this build does not connect to. Nothing you type is sent."
            />
          </Card>
          <PrimaryButton
            label="Draft terms"
            disabled
            accessibilityHint="Unavailable. Drafting needs the Mandate service."
          />

          <SectionTitle>Use a form instead</SectionTitle>
          <Text style={styles.caption}>
            These forms work as previews. They cannot create a task yet.
          </Text>
          <NavRow
            icon="web-check"
            tone="amber"
            label="Browser check"
            value="Pay providers to check a web page"
            accessibilityHint="Opens the browser check form. Nothing is created."
            onPress={() => navigation.navigate("TaskCreate")}
          />
          <NavRow
            icon="calendar-clock"
            tone="amber"
            label="Scheduled payment"
            value="A fixed amount on a fixed timetable"
            accessibilityHint="Opens the scheduled payment form. Nothing is created."
            onPress={() => navigation.navigate("Schedule")}
          />
          <NavRow
            icon="repeat"
            tone="amber"
            label="Service allowance"
            value="Buy allowed services up to a daily or weekly cap"
            accessibilityHint="Opens the service allowance form. Nothing is created."
            onPress={() => navigation.navigate("AllowanceApproval")}
          />

          {__DEV__ ? (
            <>
              <SectionTitle>Development samples</SectionTitle>
              <Text style={styles.caption}>
                Development builds only. A sample draft to review the editing
                and review layout. It is not a compiler result and never appears
                in a release build.
              </Text>
              <View style={styles.actions}>
                <OutlineButton
                  label="Load sample draft"
                  icon="flask-outline"
                  accessibilityHint="Opens a labelled sample draft for editing"
                  onPress={loadSample}
                />
              </View>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function DraftEditor({
  compiled,
  terms,
  edited,
  onReview,
  onDiscard,
}: {
  compiled: CompiledIntent;
  terms: IntentTerms;
  edited: readonly string[];
  onReview: () => void;
  onDiscard: () => void;
}) {
  const context = currentDraftContext;
  const set = (patch: Partial<IntentTerms>) =>
    updateIntentTerms(context, patch);
  const check = validateIntentTerms(terms);
  const label = ASSET_LABELS[terms.asset];
  return (
    <>
      <Card>
        <Text style={styles.fieldLabel}>Draft terms</Text>
        <StatusTag state="unavailable" label={compiled.label} />
        <Text style={styles.caption}>
          Proposed from your goal. Change anything here; you review the result
          next.
        </Text>
        <Segmented
          label="Pay with"
          options={AGENT_ASSET_OPTIONS}
          selected={terms.asset}
          onSelect={(asset) => set({ asset })}
        />
        <AmountField
          label="Most per payment"
          value={terms.maxPayment}
          onChangeText={(t) => set({ maxPayment: t })}
          placeholder={`0.00 ${label}`}
          hint={`Up to ${formatAgentAmount(CEILINGS.perPayment)} ${label}`}
          error={check.fieldErrors.maxPayment}
        />
        <AmountField
          label="Total spend cap"
          value={terms.spendCap}
          onChangeText={(t) => set({ spendCap: t })}
          placeholder={`0.00 ${label}`}
          hint={`Up to ${formatAgentAmount(CEILINGS.taskSpend)} ${label} for one task`}
          error={check.fieldErrors.spendCap}
        />
        <Segmented
          label="Paid attempts"
          compact
          options={[
            { key: "1", label: "1" },
            { key: "2", label: "2" },
            { key: "3", label: "3" },
          ]}
          selected={terms.maxPayments}
          onSelect={(maxPayments) => set({ maxPayments })}
        />
        <Segmented
          label="Expires"
          compact
          options={[
            { key: "60", label: "1 hour" },
            { key: "480", label: "8 hours" },
            { key: "1440", label: "24 hours" },
          ]}
          selected={terms.lifetimeMinutes}
          onSelect={(lifetimeMinutes) => set({ lifetimeMinutes })}
        />
        <AmountField
          label="Needs your approval above"
          value={terms.reviewThreshold}
          onChangeText={(t) => set({ reviewThreshold: t })}
          placeholder="Empty: never asks you"
          hint="Leave empty to never ask. Your wallet policy can set a lower one."
          error={check.fieldErrors.reviewThreshold}
        />
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>Providers the agent may pay</Text>
        {PROVIDERS.map((p) => (
          <ToggleRow
            key={p}
            label={PROVIDER_LABELS[p]}
            detail="Address from the trusted manifest (not loaded)"
            checked={terms.providerIds.includes(p)}
            onToggle={() => toggleIntentProvider(context, p)}
          />
        ))}
      </Card>

      {edited.length > 0 ? (
        <Card>
          <Text style={styles.fieldLabel}>You changed</Text>
          <View style={styles.chips}>
            {edited.map((name) => (
              <TaskStateChip
                key={name}
                info={{ label: name, group: "active" }}
                icon="pencil-outline"
              />
            ))}
          </View>
          <Text style={styles.caption}>
            Review shows your changed terms, not the original draft.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.fieldLabel}>Note from the drafting model</Text>
        <TaskStateChip
          info={{ label: "Untrusted model text", group: "attention" }}
          icon="robot-outline"
        />
        <Text style={styles.body}>{compiled.explanation}</Text>
        {compiled.warnings.map((w) => (
          <View key={w} style={styles.warning}>
            <Text style={styles.body}>•</Text>
            <Text style={[styles.body, styles.flex]}>{w}</Text>
          </View>
        ))}
        <Text style={styles.caption}>
          Written by a model and can be wrong. Only the terms are signed.
        </Text>
      </Card>

      {check.missing.length > 0 ? (
        <Text style={styles.caption}>
          Still needed: {check.missing.join(", ")}
        </Text>
      ) : null}
      <PrimaryButton
        label="Review draft"
        disabled={!check.complete}
        accessibilityHint={
          check.complete
            ? "Shows your goal next to the terms. Nothing is signed."
            : "Fix the highlighted terms first."
        }
        onPress={onReview}
      />
      <TextButton
        label="Discard draft"
        accessibilityHint="Removes the draft terms and keeps your goal"
        onPress={onDiscard}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  caption: { ...type.small, color: colors.textMuted },
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
  multiline: { minHeight: 96, textAlignVertical: "top" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  warning: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
});
