import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton, TextButton } from "../components/Button";
import { Card, DetailRow, Divider } from "../components/Card";
import { Icon, type IconName } from "../components/Icon";
import { Screen } from "../components/Screen";
import { network } from "../config/network";
import {
  ASSET_LABELS,
  CHECK_LABELS,
  INTERVAL_LABELS,
  PROVIDER_LABELS,
  TARGET_LABELS,
} from "../config/taskLabels";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { BrowserDraft, ScheduleDraft } from "../state/taskDraft";
import { currentDraftContext } from "../state/useSendDraft";
import { useTaskDrafts } from "../state/useTaskDrafts";
import { colors, space, tones, type } from "../theme";

// Task approval preview. It shows the owner's request next to the terms a
// permission would contain. The terms only exist once the Mandate service
// prepares a draft and the native layer checks it, so every signed term is
// unavailable here. The real approval is a native protected screen that
// shows the exact signed fields; this React Native screen never signs.

type Props = NativeStackScreenProps<RootStackParamList, "Approval">;

const NOT_DRAFTED = "Not drafted yet";

export function ApprovalScreen({ navigation, route }: Props) {
  const drafts = useTaskDrafts(currentDraftContext);
  const isSchedule = route.params.kind === "schedule";
  return (
    <Screen
      title="Review task"
      subtitle="Check what your agent would be allowed to do."
      onBack={() => navigation.goBack()}
    >
      <Banner
        icon="information-outline"
        title="Preview: nothing can be approved"
        body="This build cannot create tasks or sign permissions. Approval happens on a protected screen that shows the exact terms you sign."
      />

      <Card>
        <Text style={styles.cardTitle}>Your request</Text>
        {isSchedule ? (
          <ScheduleRequest draft={drafts.schedule} />
        ) : (
          <BrowserRequest draft={drafts.browser} />
        )}
        <Text style={styles.caption}>
          What you entered. It is not checked, and it is not what you sign.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Terms you would sign</Text>
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
        <DetailRow label="Agent wallet" value="Not created" muted />
        <DetailRow label="Agent signer" value="Not set up" muted />
        <DetailRow label="Task program and version" value="Not loaded" muted />
        <DetailRow
          label="Recipients"
          value="From the trusted manifest (not loaded)"
          muted
        />
        <Divider />
        {isSchedule ? (
          <>
            <DetailRow label="Amount per payment" value={NOT_DRAFTED} muted />
            <DetailRow label="Total gross cap" value={NOT_DRAFTED} muted />
            <DetailRow label="Payment windows" value={NOT_DRAFTED} muted />
          </>
        ) : (
          <>
            <DetailRow label="Most per payment" value={NOT_DRAFTED} muted />
            <DetailRow label="Total spend cap" value={NOT_DRAFTED} muted />
            <DetailRow label="Paid attempts" value={NOT_DRAFTED} muted />
          </>
        )}
        <DetailRow label="Minimum balance kept" value={NOT_DRAFTED} muted />
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

      <Card>
        <Text style={styles.cardTitle}>What the agent can do</Text>
        <Point
          allowed
          text={
            isSchedule
              ? "Pay the fixed amount to the one recipient, once per window"
              : "Pay only the providers you allow, up to the caps"
          }
        />
        <Point
          allowed
          text={
            isSchedule
              ? "Skip a window it misses"
              : "Choose between allowed offers and try another allowed provider"
          }
        />
        <Divider />
        <Text style={styles.cardTitle}>What it cannot do</Text>
        <Point text="Add recipients or raise any amount" />
        <Point text="Sign permissions, policies or owner transfers" />
        <Point text="Spend while the wallet is frozen or paused" />
        {isSchedule ? <Point text="Catch up on a missed payment" /> : null}
        <Text style={styles.caption}>
          After approval the agent works without asking you for each payment.
          Payments above your review threshold wait for your approval.
        </Text>
      </Card>

      <PrimaryButton
        label="Approve on this phone"
        icon="fingerprint"
        disabled
        accessibilityHint="Unavailable. Task approval needs the Mandate service and the native confirmation screen."
      />
      <TextButton
        label="Edit request"
        accessibilityHint="Returns to the form"
        onPress={() => navigation.goBack()}
      />
      <Text style={styles.footnote}>
        Changing anything after review needs a new review and a new approval.
      </Text>
    </Screen>
  );
}

function BrowserRequest({ draft }: { draft: BrowserDraft }) {
  return (
    <>
      <View style={styles.goal}>
        <Text style={styles.caption}>Goal</Text>
        <Text style={styles.body}>{draft.goal.trim() || "None"}</Text>
      </View>
      <DetailRow label="Page" value={TARGET_LABELS[draft.targetId]} />
      <DetailRow
        label="Checks"
        value={
          draft.checks.map((c) => CHECK_LABELS[c].label).join(", ") || "None"
        }
      />
      <DetailRow
        label="Providers"
        value={
          draft.providerIds.map((p) => PROVIDER_LABELS[p]).join(", ") || "None"
        }
      />
      <DetailRow
        label="Spend cap"
        value={`${draft.spendCap.trim() || "None"} ${ASSET_LABELS[draft.asset]}`}
      />
      <DetailRow label="Paid attempts" value={String(draft.maxPaidAttempts)} />
    </>
  );
}

function ScheduleRequest({ draft }: { draft: ScheduleDraft }) {
  return (
    <>
      <DetailRow label="Recipient" value={draft.recipient.trim() || "None"} />
      <DetailRow
        label="Amount per payment"
        value={`${draft.amount.trim() || "None"} ${ASSET_LABELS[draft.asset]}`}
      />
      <DetailRow label="Repeats" value={INTERVAL_LABELS[draft.interval]} />
      <DetailRow label="Starts" value={draft.start.trim() || "None"} />
      <DetailRow label="Window" value={draft.window.trim() || "None"} />
      <DetailRow label="Payments" value={draft.periods.trim() || "None"} />
    </>
  );
}

function Point({ text, allowed }: { text: string; allowed?: boolean }) {
  const icon: IconName = allowed
    ? "check-circle-outline"
    : "close-circle-outline";
  return (
    <View style={styles.point}>
      <Icon
        name={icon}
        size={20}
        color={allowed ? tones.green.fg : tones.red.fg}
      />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  body: { ...type.body, color: colors.ink },
  goal: { gap: 2 },
  footnote: { ...type.small, color: colors.textMuted, textAlign: "center" },
  point: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  pointText: { ...type.body, color: colors.text, flex: 1 },
});
