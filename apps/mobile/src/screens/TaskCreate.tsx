import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton, TextButton } from "../components/Button";
import { Card, DetailRow } from "../components/Card";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { ToggleRow } from "../components/ToggleRow";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  CHECKS,
  PROVIDERS,
  clearTaskDraft,
  isBrowserDraftComplete,
  toggleCheck,
  toggleProvider,
  updateBrowserDraft,
} from "../state/taskDraft";
import { currentDraftContext } from "../state/useSendDraft";
import { useTaskDrafts } from "../state/useTaskDrafts";
import { colors, radius, space, type } from "../theme";
import {
  AGENT_ASSET_OPTIONS,
  CHECK_LABELS,
  PROVIDER_LABELS,
} from "../config/taskLabels";

// Browser check form preview (runbook "browser-check"). The fields work
// locally so the layout can be reviewed. Nothing is checked or sent: there
// is no task service, no quote, no amount validation and no signing.
// Leaving the form discards its draft.

type Props = NativeStackScreenProps<RootStackParamList, "TaskCreate">;

export function TaskCreateScreen({ navigation }: Props) {
  const context = currentDraftContext;
  const draft = useTaskDrafts(context).browser;
  const set = updateBrowserDraft.bind(null, context);
  const canReview = isBrowserDraftComplete(draft);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", () =>
        clearTaskDraft(context, "browser"),
      ),
    [navigation, context],
  );

  return (
    <Screen
      title="Browser check"
      subtitle="New agent task. Say what to check and set the limits."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <Text style={styles.fieldLabel} nativeID="goal-label">
          Goal
        </Text>
        <TextInput
          accessibilityLabelledBy="goal-label"
          value={draft.goal}
          onChangeText={(text) => set({ goal: text })}
          placeholder="e.g. Check that the staging checkout loads and shows the right title"
          placeholderTextColor={colors.textSubtle}
          multiline
          style={[styles.input, styles.multiline]}
        />
        <Text style={styles.caption}>
          Your words are kept as a note. The agent is bound by the terms you
          approve, not by this text.
        </Text>
      </Card>

      <Card>
        <Segmented
          label="Page to check"
          options={[
            { key: "checkout-healthy", label: "Healthy checkout" },
            { key: "checkout-broken", label: "Broken checkout" },
          ]}
          selected={draft.targetId}
          onSelect={(key) => set({ targetId: key })}
        />
        <Text style={styles.caption}>
          Test pages listed in the trusted deployment manifest. Their addresses
          are not loaded in this build.
        </Text>
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>Checks</Text>
        {CHECKS.map((check) => (
          <ToggleRow
            key={check}
            label={CHECK_LABELS[check].label}
            detail={CHECK_LABELS[check].detail}
            checked={draft.checks.includes(check)}
            onToggle={() => toggleCheck(context, check)}
          />
        ))}
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>Providers the agent may pay</Text>
        {PROVIDERS.map((provider) => (
          <ToggleRow
            key={provider}
            label={PROVIDER_LABELS[provider]}
            detail="Price: quote unavailable"
            checked={draft.providerIds.includes(provider)}
            onToggle={() => toggleProvider(context, provider)}
          />
        ))}
        <Text style={styles.caption}>
          Prices come from each provider's quote. What each provider can check
          comes from the trusted manifest. Neither is available yet.
        </Text>
      </Card>

      <Card>
        <Segmented
          label="Pay with"
          options={AGENT_ASSET_OPTIONS}
          selected={draft.asset}
          onSelect={(key) => set({ asset: key })}
        />
        <Text style={styles.fieldLabel} nativeID="cap-label">
          Spend cap for this task
        </Text>
        <TextInput
          accessibilityLabelledBy="cap-label"
          value={draft.spendCap}
          onChangeText={(text) => set({ spendCap: text })}
          placeholder={`0.00 ${draft.asset}`}
          placeholderTextColor={colors.textSubtle}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <Segmented
          label="Paid attempts"
          compact
          options={[
            { key: "1", label: "1" },
            { key: "2", label: "2" },
            { key: "3", label: "3" },
          ]}
          selected={String(draft.maxPaidAttempts) as "1" | "2" | "3"}
          onSelect={(key) => set({ maxPaidAttempts: Number(key) as 1 | 2 | 3 })}
        />
        <Text style={styles.caption}>
          If a provider is paid but does not deliver, the agent can pay another
          allowed provider, up to this many paid attempts. Every attempt counts
          toward the spend cap.
        </Text>
        <DetailRow label="Time limit" value="10 minutes after start" />
        <Text style={styles.caption}>
          Amounts are not checked yet. The spendable agent balance is
          unavailable.
        </Text>
      </Card>

      <PrimaryButton
        label="Review"
        disabled={!canReview}
        accessibilityHint={
          canReview
            ? "Shows what you would approve. Nothing is created."
            : "Enter a goal, a check, a provider and a spend cap first."
        }
        onPress={() => navigation.navigate("Approval", { kind: "browser" })}
      />
      <TextButton
        label="Discard draft"
        accessibilityHint="Clears this form"
        onPress={() => clearTaskDraft(context, "browser")}
      />

      <Banner
        icon="information-outline"
        title="Not available in this build"
        body="Creating tasks needs the Mandate service. Nothing typed here is checked or sent."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...type.heading, color: colors.ink },
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
});
