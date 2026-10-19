import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, Divider } from "../components/Card";
import { Icon } from "../components/Icon";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { SUMMARY_TEXT, summarizeFindings } from "../config/findings";
import {
  findSampleTask,
  type SamplePayment,
  type SampleTask,
} from "../config/taskSamples";
import {
  ACTION_INFO,
  AUTHORITY_INFO,
  DELIVERY_INFO,
  OUTCOME_INFO,
} from "../config/taskStatus";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, space, tones, type } from "../theme";

// Task detail layout. No real task exists yet, so this screen is only
// reachable from development samples and always says so. Outcome, spending
// authority, each payment and the delivery are separate cards with separate
// states; a finished task is never shown as one "done" badge.

type Props = NativeStackScreenProps<RootStackParamList, "Task">;

export function TaskScreen({ navigation, route }: Props) {
  const task = findSampleTask(route.params.sampleId);
  const back = () => navigation.goBack();
  if (!__DEV__ || !task) {
    return (
      <Screen title="Task" onBack={back}>
        <Banner
          icon="information-outline"
          title="Not available"
          body="Task details need the Mandate service, which this build does not connect to."
        />
      </Screen>
    );
  }
  return (
    <Screen title={task.title} subtitle="Development sample" onBack={back}>
      <Banner
        icon="flask-outline"
        title="Development sample, not a real task"
        body="States, amounts and hashes are placeholders for reviewing this layout."
      />

      <Card>
        <Text style={styles.cardTitle}>Your goal</Text>
        <Text style={styles.body}>{task.goal}</Text>
        <DetailRow label="Page" value={task.target} />
        <Text style={styles.caption}>
          The goal is a note. The agent was bound by the signed terms.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Outcome</Text>
        <TaskStateChip info={OUTCOME_INFO[task.outcome]} />
        <DetailRow label="Current step" value={task.currentStep} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Spending permission</Text>
        <TaskStateChip info={AUTHORITY_INFO[task.authority]} />
        <DetailRow label="Spend cap" value={`${task.spendCap} ${task.asset}`} />
        <DetailRow
          label="Spent (gross)"
          value={`${task.grossSpent} ${task.asset}`}
        />
        {task.grossNote ? (
          <Text style={styles.caption}>{task.grossNote}</Text>
        ) : null}
        <DetailRow label="Remaining" value={task.remaining} />
        <DetailRow label="Paid attempts" value={task.paidAttempts} />
        <Text style={styles.caption}>
          Gross spend counts every paid attempt, including ones that did not
          deliver. It never goes down.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Payments</Text>
        {task.payments.map((payment, index) => (
          <View key={payment.hash} style={styles.payment}>
            {index > 0 ? <Divider /> : null}
            <PaymentRow payment={payment} asset={task.asset} />
          </View>
        ))}
        <Divider />
        <DetailRow
          label="Total paid (gross)"
          value={`${task.grossSpent} ${task.asset}`}
        />
        {task.grossNote ? (
          <Text style={styles.caption}>{task.grossNote}</Text>
        ) : null}
        <Text style={styles.caption}>
          Network fees are paid by the agent signer in ETH. They are not part of
          these amounts.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Delivery</Text>
        <TaskStateChip info={DELIVERY_INFO[task.delivery]} />
        <DetailRow label="Delivered by" value={task.deliveredBy} />
        {task.checks.length > 0 ? (
          <>
            <Divider />
            <Text style={styles.subTitle}>Result</Text>
            {task.checks.map((check) => (
              <View key={check.label} style={styles.check}>
                <Icon
                  name={
                    check.passed
                      ? "check-circle-outline"
                      : "close-circle-outline"
                  }
                  size={20}
                  color={check.passed ? tones.green.fg : colors.textMuted}
                />
                <View style={styles.checkText}>
                  <Text style={styles.checkLabel}>{check.label}</Text>
                  <Text style={styles.caption}>{check.result}</Text>
                </View>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.caption}>No result yet.</Text>
        )}
      </Card>

      <NavRow
        icon="shield-search"
        tone="violet"
        label="Inspection"
        value={SUMMARY_TEXT[summarizeFindings(task.findings)].title}
        footer={<StatusTag state="unavailable" label="Development sample" />}
        accessibilityHint="Opens the six inspection findings"
        onPress={() => navigation.navigate("Inspector", { sampleId: task.id })}
      />

      <View style={styles.actions}>
        <OutlineButton
          label="Stop agent"
          icon="pause-circle-outline"
          disabled
          accessibilityHint="Unavailable. Agent controls are not built yet."
        />
      </View>
    </Screen>
  );
}

function PaymentRow({
  payment,
  asset,
}: {
  payment: SamplePayment;
  asset: SampleTask["asset"];
}) {
  const unknown = payment.state === "UNKNOWN";
  return (
    <>
      <View style={styles.paymentHead}>
        <Text style={styles.subTitle}>{payment.provider}</Text>
        <Text style={styles.amount}>
          {payment.amount} {asset}
        </Text>
      </View>
      <View style={styles.tags}>
        <TaskStateChip
          info={{
            ...ACTION_INFO[payment.state],
            label: `Payment: ${ACTION_INFO[payment.state].label}`,
          }}
        />
        <TaskStateChip
          info={{
            ...DELIVERY_INFO[payment.delivery],
            label: `Delivery: ${DELIVERY_INFO[payment.delivery].label}`,
          }}
        />
      </View>
      <Text style={styles.caption}>{payment.deliveryNote}</Text>
      <DetailRow label="Transaction hash" value={payment.hash} muted />
      {unknown ? (
        <View style={styles.callout}>
          <Icon name="help-circle-outline" size={22} color={tones.amber.fg} />
          <View style={styles.calloutText}>
            <Text style={styles.calloutTitle}>Status unknown</Text>
            <Text style={styles.calloutBody}>
              Its budget stays reserved while this recorded payment is checked
              and reconciled. No new, duplicate payment is created automatically
              in the meantime.
            </Text>
          </View>
        </View>
      ) : null}
      <View style={styles.actions}>
        {unknown ? (
          <OutlineButton
            label="Check status"
            icon="refresh"
            disabled
            accessibilityHint="Unavailable. Samples have no payment to check."
          />
        ) : (
          <OutlineButton
            label="View on explorer"
            icon="open-in-new"
            disabled
            accessibilityHint="Unavailable. Samples have no transaction to open."
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  subTitle: { ...type.bodyStrong, color: colors.ink },
  body: { ...type.body, color: colors.text },
  caption: { ...type.small, color: colors.textMuted },
  amount: { ...type.bodyStrong, color: colors.ink },
  payment: { gap: space.sm },
  paymentHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: space.sm,
  },
  check: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  checkText: { flex: 1, gap: 2 },
  checkLabel: { ...type.bodyStrong, color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
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
