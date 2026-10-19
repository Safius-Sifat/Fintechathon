import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, SectionTitle } from "../components/Card";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import {
  SAMPLE_APPROVALS,
  type SampleApproval,
} from "../config/approvalSamples";
import {
  APPROVAL_STATE_DETAIL,
  APPROVAL_STATE_INFO,
  expiryLabel,
  type ApprovalState,
} from "../config/approvals";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Agent payments waiting for the owner's co-signature (plan S9.5). Requests
// come from the Mandate service, which this build does not connect to, so
// the list is unavailable, not empty. Nothing here can approve or reject.

type Props = NativeStackScreenProps<RootStackParamList, "Approvals">;

const STATES: readonly ApprovalState[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
];

export function ApprovalsScreen({ navigation }: Props) {
  const now = Math.floor(Date.now() / 1000);
  return (
    <Screen
      title="Approvals"
      subtitle="Agent payments that wait for your signature."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <StateView
          icon="cloud-off-outline"
          tone="amber"
          title="Approval requests unavailable"
          tag={<StatusTag state="unavailable" />}
          body="This is not an empty list. Requests come from the Mandate service, which this build does not connect to."
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>When a payment waits for you</Text>
        <Text style={styles.body}>
          A payment above your review threshold is held for up to 15 minutes.
          Nothing is paid unless you approve it on the protected confirmation
          screen.
        </Text>
        <Text style={styles.caption}>
          Rejecting, or letting the time run out, makes no signature and
          releases the reserved budget.
        </Text>
      </Card>

      <NavRow
        icon="alert-outline"
        tone="red"
        label="Alerts"
        value="Alerts unavailable"
        accessibilityHint="Opens risk alerts"
        onPress={() => navigation.navigate("Alerts")}
      />

      <SectionTitle>What the states mean</SectionTitle>
      <Card>
        {STATES.map((state) => (
          <View key={state} style={styles.guideRow}>
            <TaskStateChip info={APPROVAL_STATE_INFO[state]} />
            <Text style={styles.caption}>{APPROVAL_STATE_DETAIL[state]}</Text>
          </View>
        ))}
      </Card>

      {__DEV__ ? (
        <>
          <SectionTitle>Development samples</SectionTitle>
          <Text style={styles.caption}>
            Development builds only. Placeholder requests to review the approval
            layout. They are not requests and never appear in a release build.
          </Text>
          <Card>
            {SAMPLE_APPROVALS.map((sample) => (
              <SampleRow
                key={sample.id}
                sample={sample}
                now={now}
                onPress={() =>
                  navigation.navigate("ApprovalDetail", {
                    sampleId: sample.id,
                  })
                }
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function SampleRow({
  sample,
  now,
  onPress,
}: {
  sample: SampleApproval;
  now: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the sample request"
      onPress={onPress}
      style={({ pressed }) => [styles.sampleRow, pressed && styles.pressed]}
    >
      <IconTile icon="account-clock-outline" tone="amber" size={40} />
      <View style={styles.sampleText}>
        <Text style={styles.sampleTitle}>
          {sample.provider} · {sample.amount} {sample.asset}
        </Text>
        <Text style={styles.caption}>
          {sample.state === "PENDING"
            ? expiryLabel(sample.expiresAt, now)
            : sample.task}
        </Text>
        <View style={styles.tags}>
          <TaskStateChip info={APPROVAL_STATE_INFO[sample.state]} />
          <StatusTag state="unavailable" label="Development sample" />
        </View>
      </View>
      <Icon name="chevron-right" size={24} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  caption: { ...type.small, color: colors.textMuted },
  guideRow: { gap: space.xs },
  sampleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xs,
  },
  pressed: { opacity: 0.7 },
  sampleText: { flex: 1, gap: space.xs },
  sampleTitle: { ...type.bodyStrong, color: colors.ink },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
