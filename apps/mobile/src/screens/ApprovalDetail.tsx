import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton, PrimaryButton } from "../components/Button";
import { Card, DetailRow, Divider } from "../components/Card";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { findSampleApproval } from "../config/approvalSamples";
import {
  APPROVAL_STATE_DETAIL,
  APPROVAL_STATE_INFO,
  OPERATION_LABELS,
  canDecide,
  expiryLabel,
} from "../config/approvals";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, fonts, radius, space, tones, type } from "../theme";

// Approval request layout (plan P3-A01). No real request exists yet, so this
// screen is only reachable from development samples and always says so.
// The agent's reason is untrusted model text and cannot change what is
// signed. Approving needs the native confirmation screen, which recomputes
// the payment fingerprint from these fields; it is not built, so both
// decisions are unavailable.

type Props = NativeStackScreenProps<RootStackParamList, "ApprovalDetail">;

export function ApprovalDetailScreen({ navigation, route }: Props) {
  const sample = findSampleApproval(route.params.sampleId);
  const back = () => navigation.goBack();
  if (!__DEV__ || !sample) {
    return (
      <Screen title="Payment approval" onBack={back}>
        <Banner
          icon="information-outline"
          title="Not available"
          body="Approval requests need the Mandate service, which this build does not connect to."
        />
      </Screen>
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const open = canDecide(sample.state, sample.expiresAt, now);
  return (
    <Screen
      title="Payment approval"
      subtitle="Development sample"
      onBack={back}
    >
      <Banner
        icon="flask-outline"
        title="Development sample, not a real request"
        body="The provider, address, amount and reason are placeholders for reviewing this layout."
      />

      <Card>
        <View style={styles.tags}>
          <TaskStateChip info={APPROVAL_STATE_INFO[sample.state]} />
          <StatusTag state="unavailable" label="Development sample" />
        </View>
        <Text style={styles.label}>Amount</Text>
        <Text style={styles.amount}>
          {sample.amount} {sample.asset}
        </Text>
        <Text style={styles.caption}>
          {sample.baseUnits} base units ({sample.asset} has 6 decimals)
        </Text>
        <DetailRow
          label="Time left"
          value={expiryLabel(sample.expiresAt, now)}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Payment</Text>
        <DetailRow label="From" value="Agent wallet (no account yet)" />
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
        <DetailRow label="Action" value={OPERATION_LABELS[sample.operation]} />
        <DetailRow label="Provider" value={sample.provider} />
        <View style={styles.field}>
          <Text style={styles.label}>Recipient address (full)</Text>
          <Text style={styles.mono}>{sample.recipient}</Text>
        </View>
        <DetailRow label="Asset" value={sample.asset} />
        <DetailRow label="Task" value={sample.task} />
        <DetailRow
          label="Your review threshold"
          value={sample.reviewThreshold}
        />
      </Card>

      <Card>
        <View style={styles.untrustedHead}>
          <Icon
            name="robot-confused-outline"
            size={20}
            color={tones.amber.fg}
          />
          <Text style={styles.untrustedTitle}>Agent's reason</Text>
          <StatusTag state="unavailable" label="Untrusted model text" />
        </View>
        <Text style={styles.quote}>“{sample.rationale}”</Text>
        <Text style={styles.caption}>
          Written by the agent. It is not checked and cannot change what you
          sign. Decide from the payment details above.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Before you sign</Text>
        <DetailRow
          label="Payment check on this phone"
          value="Not built"
          muted
        />
        <Text style={styles.caption}>
          The protected confirmation screen recomputes this payment's
          fingerprint from the details above and refuses to sign if anything
          differs. It is not built in this build.
        </Text>
      </Card>

      {open ? (
        <>
          <PrimaryButton
            label="Approve on this phone"
            icon="fingerprint"
            disabled
            accessibilityHint="Unavailable. Approval needs the Mandate service and the native confirmation screen."
          />
          <View style={styles.actions}>
            <OutlineButton
              label="Reject"
              icon="close"
              disabled
              accessibilityHint="Unavailable. Rejecting needs the Mandate service."
            />
          </View>
          <Text style={styles.footnote}>
            Rejecting sends no signature and releases the reserved budget.
          </Text>
        </>
      ) : (
        <Banner
          icon="timer-off-outline"
          title="This request can no longer be decided"
          body={APPROVAL_STATE_DETAIL[sample.state]}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  label: { ...type.small, color: colors.textMuted },
  amount: { ...type.hero, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  footnote: { ...type.small, color: colors.textMuted, textAlign: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  field: { gap: 2 },
  mono: { ...type.bodyStrong, fontFamily: fonts.mono, color: colors.ink },
  untrustedHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  untrustedTitle: { ...type.heading, color: colors.ink },
  quote: {
    ...type.body,
    color: colors.text,
    fontStyle: "italic",
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: tones.amber.bg,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
