import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/Button";
import { GhostButton, Row, Rows } from "../components/blocks";
import {
  AgentMessage,
  CardLine,
  Composer,
  NowLine,
  ThreadSteps,
  ThreadCard,
  UserBubble,
} from "../components/chat";
import { Icon } from "../components/Icon";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  agentLine,
  canStop,
  nowDoing,
  signedTasks,
  threadSteps,
} from "../state/agentThread";
import { useServicePoll } from "../state/useServicePoll";
import {
  radius,
  shadows,
  space,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../theme";
import {
  getTask,
  getServiceWallet,
  listApprovals,
  runTask,
  serviceTaskReferences,
} from "../wallet/api";
import { TOKENS } from "../wallet/config";
import { shortAddress } from "../wallet/format";
import { formatUnitsExact } from "../wallet/service-validation";
import { errorText } from "../wallet/useAsync";
import { ApproveCard } from "./agent/ApproveCard";

type Props = NativeStackScreenProps<RootStackParamList, "TaskDetail">;

const CHECK_NAMES = { pageLoad: "Page loads", formSubmit: "Form submits" };

// One task as a conversation with the agent: your request, what it is doing
// step by step, and anything it needs from you, with Stop always in reach.
export function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const view = useServicePoll(async () => {
    const task = await getTask(taskId);
    const wallet = await getServiceWallet(task.walletId);
    return { task, wallet };
  }, taskId);
  const refs = useServicePoll(serviceTaskReferences, `refs:${taskId}`, 0);
  const approvals = useServicePoll(listApprovals, `approvals:${taskId}`);
  const [signed, setSigned] = useState(signedTasks.has(taskId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const task = view.data?.task;
  const wallet = view.data?.wallet;
  const pending = (approvals.data ?? []).filter(
    (a) =>
      a.state === "PENDING" &&
      a.taskId === taskId &&
      a.walletId === wallet?.walletId,
  );
  const reference = refs.data?.find((r) => r.taskId === taskId);
  const start = async () => {
    if (inFlight.current || task?.authorityState !== "ACTIVE") return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await runTask(taskId);
      view.reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const stop = () =>
    wallet?.address &&
    navigation.navigate("AgentControl", {
      wallet: wallet.address,
      command: "PAUSE",
    });
  const result = task?.delivery.result;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Icon name="chevron-left" size={28} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Agent
        </Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scroll.current?.scrollToEnd()}
      >
        {reference?.goal ? <UserBubble>{reference.goal}</UserBubble> : null}

        {!task ? (
          <AgentMessage
            text={
              view.error
                ? `I can't read this task right now. ${view.error}`
                : "Loading the task…"
            }
          />
        ) : (
          <>
            <AgentMessage text={agentLine(task, pending.length, signed)}>
              <ThreadSteps items={threadSteps(task, signed)} />
            </AgentMessage>

            {task.outcomeState === "AWAITING_OWNER" && !signed ? (
              <ApproveCard
                continued
                taskId={taskId}
                input={reference?.input}
                onEdit={() => navigation.navigate("TaskTerms", { taskId })}
                onSigned={() => {
                  signedTasks.add(taskId);
                  setSigned(true);
                  view.reload();
                }}
              />
            ) : null}

            {pending.map((a) => {
              const token = TOKENS.find(
                (t) =>
                  t.address?.toLowerCase() === a.invoice?.asset.toLowerCase(),
              );
              return (
                <AgentMessage
                  continued
                  key={a.approvalId}
                  text="This payment is above your limit, so I need your OK."
                >
                  <ThreadCard>
                    <CardLine
                      label="Pay"
                      value={
                        token
                          ? `${formatUnitsExact(a.action.amount, token.decimals)} ${token.symbol}`
                          : `${a.action.amount} base units`
                      }
                    />
                    {a.invoice ? (
                      <CardLine
                        label="To"
                        value={shortAddress(a.invoice.recipient)}
                      />
                    ) : null}
                    <PrimaryButton
                      label="Review and approve"
                      onPress={() =>
                        wallet?.address &&
                        navigation.navigate("Approvals", {
                          wallet: wallet.address,
                          walletId: wallet.walletId,
                          taskId,
                        })
                      }
                    />
                  </ThreadCard>
                </AgentMessage>
              );
            })}

            {task.authorityState === "ACTIVE" &&
            ["READY", "AWAITING_AGENT", "NEEDS_OWNER"].includes(
              task.outcomeState,
            ) ? (
              <AgentMessage continued>
                <PrimaryButton
                  label={busy ? "Starting…" : "Start the check"}
                  disabled={busy || !!view.error}
                  onPress={start}
                />
                <GhostButton
                  label="Run me from a laptop instead"
                  onPress={() => navigation.navigate("AgentToken", { taskId })}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </AgentMessage>
            ) : null}

            {result ? (
              <AgentMessage continued>
                <ThreadCard>
                  {result.checks.pageLoad !== undefined ? (
                    <CheckLine
                      label={CHECK_NAMES.pageLoad}
                      pass={result.checks.pageLoad}
                    />
                  ) : null}
                  {result.checks.title ? (
                    <CheckLine
                      label={`Title “${result.checks.title.actual}”`}
                      pass={result.checks.title.pass}
                    />
                  ) : null}
                  {result.checks.formSubmit !== undefined ? (
                    <CheckLine
                      label={CHECK_NAMES.formSubmit}
                      pass={result.checks.formSubmit}
                    />
                  ) : null}
                  <CardLine
                    label="Spent"
                    value={`${formatUnitsExact(task.grossSpendUnits)} DUSD`}
                  />
                </ThreadCard>
              </AgentMessage>
            ) : null}

            {task.payments.some((p) => p.txHash) ? (
              <Rows>
                {task.payments
                  .filter((p) => p.txHash)
                  .map((p) => (
                    <Row
                      key={p.actionId}
                      label="Payment on chain"
                      detail={shortAddress(p.txHash!)}
                      onPress={() =>
                        navigation.navigate("TxDetail", {
                          hash: p.txHash!,
                          origin: "agent",
                          taskId,
                        })
                      }
                    />
                  ))}
              </Rows>
            ) : null}

            {task.outcomeState === "COMPLETED" ||
            task.outcomeState === "DELIVERY_FAILED" ? (
              <GhostButton
                label="Proof and export"
                onPress={() => navigation.navigate("TaskProof", { taskId })}
              />
            ) : null}
            <Text style={styles.taskId}>Task {task.taskId}</Text>
          </>
        )}
      </ScrollView>
      {task && (canStop(task) || nowDoing(task, signed)) ? (
        <View
          style={[
            styles.composerWrap,
            { paddingBottom: insets.bottom + space.sm },
          ]}
        >
          {nowDoing(task, signed) ? (
            <NowLine text={nowDoing(task, signed)!} />
          ) : null}
          {canStop(task) ? (
            <Composer
              placeholder="Agent can spend within your limits"
              onStop={stop}
            />
          ) : null}
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </View>
  );
}

function CheckLine({ label, pass }: { label: string; pass: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View
      style={styles.check}
      accessible
      accessibilityLabel={`${label}: ${pass ? "passed" : "failed"}`}
    >
      <Icon
        name={pass ? "check-circle" : "close-circle"}
        size={22}
        color={pass ? colors.good : colors.bad}
      />
      <Text style={styles.checkText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.ground },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  back: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...type.heading, color: colors.ink },
  pressed: {
    opacity: 0.7,
    backgroundColor: colors.raised,
    boxShadow: shadows.card,
  },
  scroll: { flex: 1 },
  thread: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  error: { ...type.body, color: colors.bad },
  check: { flexDirection: "row", alignItems: "center", gap: space.sm },
  checkText: { ...type.body, color: colors.ink, flex: 1 },
  taskId: { ...type.small, color: colors.ink3, textAlign: "center" },
  composerWrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopLeftRadius: radius.lg,
  },
}));
