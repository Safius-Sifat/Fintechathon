import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton, TextButton } from "../components/Button";
import { Card, DetailRow, Divider, SectionTitle } from "../components/Card";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { AGENT_ASSET_OPTIONS, INTERVAL_LABELS } from "../config/taskLabels";
import { SAMPLE_SCHEDULE } from "../config/taskSamples";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  clearTaskDraft,
  isScheduleDraftComplete,
  updateScheduleDraft,
} from "../state/taskDraft";
import { currentDraftContext } from "../state/useSendDraft";
import { useTaskDrafts } from "../state/useTaskDrafts";
import { colors, fonts, radius, space, tones, type } from "../theme";

// Scheduled payment form preview (runbook "scheduled-pay"). Fixed recipient,
// amount and timetable. Nothing typed here is checked, and the total gross
// cap is not calculated because amount checks are not built yet. Period
// status needs chain state, so it is unavailable outside the labelled
// development sample.

type Props = NativeStackScreenProps<RootStackParamList, "Schedule">;

export function ScheduleScreen({ navigation }: Props) {
  const context = currentDraftContext;
  const draft = useTaskDrafts(context).schedule;
  const set = updateScheduleDraft.bind(null, context);
  const canReview = isScheduleDraftComplete(draft);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", () =>
        clearTaskDraft(context, "schedule"),
      ),
    [navigation, context],
  );

  return (
    <Screen
      title="Scheduled payment"
      subtitle="New agent task. A fixed amount to one recipient on a fixed timetable."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <Text style={styles.fieldLabel} nativeID="schedule-recipient-label">
          Pay to
        </Text>
        <TextInput
          accessibilityLabelledBy="schedule-recipient-label"
          value={draft.recipient}
          onChangeText={(text) => set({ recipient: text })}
          placeholder={`0x… address on ${network.name}`}
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          style={[styles.input, styles.mono]}
        />
        <Text style={styles.caption}>
          The recipient is fixed for every payment. Address checks are not built
          yet.
        </Text>
      </Card>

      <Card>
        <Segmented
          label="Pay with"
          options={AGENT_ASSET_OPTIONS}
          selected={draft.asset}
          onSelect={(key) => set({ asset: key })}
        />
        <Text style={styles.fieldLabel} nativeID="schedule-amount-label">
          Amount per payment
        </Text>
        <TextInput
          accessibilityLabelledBy="schedule-amount-label"
          value={draft.amount}
          onChangeText={(text) => set({ amount: text })}
          placeholder={`0.00 ${draft.asset}`}
          placeholderTextColor={colors.textSubtle}
          keyboardType="decimal-pad"
          style={styles.input}
        />
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>Timetable</Text>
        <Segmented
          label="Repeats"
          compact
          options={[
            { key: "daily", label: INTERVAL_LABELS.daily },
            { key: "weekly", label: INTERVAL_LABELS.weekly },
            { key: "demo", label: INTERVAL_LABELS.demo },
          ]}
          selected={draft.interval}
          onSelect={(key) => set({ interval: key })}
        />
        {draft.interval === "demo" ? <DemoTimingNote /> : null}
        <LabelledInput
          id="schedule-start-label"
          label="First payment"
          value={draft.start}
          placeholder="e.g. 21 Oct, 09:00"
          onChange={(text) => set({ start: text })}
        />
        <LabelledInput
          id="schedule-window-label"
          label="Payment window"
          value={draft.window}
          placeholder="e.g. 2 hours"
          onChange={(text) => set({ window: text })}
        />
        <LabelledInput
          id="schedule-periods-label"
          label="Number of payments"
          value={draft.periods}
          placeholder="e.g. 4"
          keyboardType="number-pad"
          onChange={(text) => set({ periods: text })}
        />
        <Text style={styles.caption}>
          Dates and numbers are not checked yet.
        </Text>
      </Card>

      <Card>
        <Text style={styles.fieldLabel}>Total gross cap</Text>
        <DetailRow label="Total" value="Unavailable" muted />
        <Text style={styles.caption}>
          Amount per payment times the number of payments. It is calculated once
          amount checks exist, and you see it before you approve.
        </Text>
        <Divider />
        <View style={styles.rule}>
          <Icon name="debug-step-over" size={20} color={colors.textMuted} />
          <Text style={styles.ruleText}>
            A missed window is skipped. The agent never catches up by paying
            twice.
          </Text>
        </View>
      </Card>

      <Card>
        <StateView
          icon="calendar-remove-outline"
          tone="amber"
          title="Payment status unavailable"
          tag={<StatusTag state="unavailable" />}
          body="Which payments are paid, due or missed comes from the chain. This build cannot read it."
        />
      </Card>

      <PrimaryButton
        label="Review"
        disabled={!canReview}
        accessibilityHint={
          canReview
            ? "Shows what you would approve. Nothing is created."
            : "Fill in every field first."
        }
        onPress={() => navigation.navigate("Approval", { kind: "schedule" })}
      />
      <TextButton
        label="Discard draft"
        accessibilityHint="Clears this form"
        onPress={() => clearTaskDraft(context, "schedule")}
      />

      <Banner
        icon="information-outline"
        title="Not available in this build"
        body="Scheduled payments need the Mandate service. Nothing typed here is checked or sent."
      />

      {__DEV__ ? <SampleSchedule /> : null}
    </Screen>
  );
}

interface LabelledInputProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: "number-pad";
  onChange: (text: string) => void;
}

function LabelledInput({
  id,
  label,
  value,
  placeholder,
  keyboardType,
  onChange,
}: LabelledInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel} nativeID={id}>
        {label}
      </Text>
      <TextInput
        accessibilityLabelledBy={id}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function DemoTimingNote() {
  return (
    <View style={styles.callout}>
      <Icon name="fast-forward-outline" size={22} color={tones.amber.fg} />
      <View style={styles.calloutText}>
        <Text style={styles.calloutTitle}>Accelerated demo schedule</Text>
        <Text style={styles.calloutBody}>
          Payments are minutes apart for a demonstration. This is not a real
          calendar timetable.
        </Text>
      </View>
    </View>
  );
}

function SampleSchedule() {
  return (
    <>
      <SectionTitle>Development sample</SectionTitle>
      <Text style={styles.caption}>
        Development builds only. A placeholder schedule to review the payment
        status layout. It is not a schedule and never appears in a release
        build.
      </Text>
      <Card>
        <View style={styles.tags}>
          <StatusTag state="unavailable" label="Development sample" />
          <TaskStateChip
            info={{ label: "Accelerated demo schedule", group: "attention" }}
            icon="fast-forward-outline"
          />
        </View>
        <DetailRow label="Pay to" value={SAMPLE_SCHEDULE.recipient} />
        <DetailRow label="Amount per payment" value={SAMPLE_SCHEDULE.amount} />
        <DetailRow label="Repeats" value={SAMPLE_SCHEDULE.timing} />
        <DetailRow label="Payments" value={SAMPLE_SCHEDULE.periods} />
        <DetailRow label="Total gross cap" value={SAMPLE_SCHEDULE.totalCap} />
        {SAMPLE_SCHEDULE.rows.map((row) => (
          <View key={row.label} style={styles.period}>
            <Divider />
            <View style={styles.periodHead}>
              <Text style={styles.periodLabel}>{row.label}</Text>
              <TaskStateChip info={row.state} />
            </View>
            <Text style={styles.caption}>{row.detail}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...type.heading, color: colors.ink },
  inputLabel: { ...type.label, color: colors.textMuted },
  caption: { ...type.small, color: colors.textMuted },
  field: { gap: space.xs },
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
  rule: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  ruleText: { ...type.body, color: colors.text, flex: 1 },
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
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  period: { gap: space.sm },
  periodHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  periodLabel: { ...type.bodyStrong, color: colors.ink },
});
