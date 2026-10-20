import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import {
  GhostButton,
  Note,
  Row,
  Rows,
  SectionHeading,
  Steps,
  Voice,
} from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { taskTitle } from "../state/taskModels";
import { useServicePoll } from "../state/useServicePoll";
import {
  getTask,
  getServiceWallet,
  listApprovals,
  runTask,
  serviceTaskReferences,
} from "../wallet/api";
import { formatUnitsExact, taskProgress } from "../wallet/service-validation";
import { errorText } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "TaskDetail">;
export function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const view = useServicePoll(async () => {
    const task = await getTask(taskId);
    const wallet = await getServiceWallet(task.walletId);
    return { task, wallet };
  }, taskId);
  const refs = useServicePoll(serviceTaskReferences, `refs:${taskId}`, 0);
  const approvals = useServicePoll(listApprovals, `approvals:${taskId}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const task = view.data?.task;
  const wallet = view.data?.wallet;
  const pending = (approvals.data ?? []).filter(
    (a) =>
      a.state === "PENDING" &&
      a.taskId === taskId &&
      a.walletId === wallet?.walletId,
  );
  const goal = refs.data?.find((r) => r.taskId === taskId)?.goal;
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
  const progress = task ? taskProgress(task) : null;
  return (
    <Page
      title={task ? taskTitle(task) : "Task"}
      subtitle={goal}
      onBack={() => navigation.goBack()}
    >
      {view.error ? (
        <Banner
          icon="cloud-off-outline"
          title="Task status unavailable"
          body={view.error}
        />
      ) : null}
      {!task ? (
        <Voice>
          {view.loading
            ? "Loading task…"
            : "Sign in to the service in Settings to view this task."}
        </Voice>
      ) : (
        <>
          <Steps
            items={[
              {
                title: "Owner approval",
                detail: task.authorityState,
                state:
                  task.authorityState === "ACTIVE" ||
                  ["CLOSING", "CLOSED"].includes(task.authorityState)
                    ? "done"
                    : "now",
              },
              {
                title: "Agent work",
                detail: task.currentStep || task.outcomeState,
                state:
                  task.outcomeState === "COMPLETED"
                    ? "done"
                    : task.authorityState === "ACTIVE"
                      ? "now"
                      : "todo",
              },
              {
                title: "Payment on chain",
                detail: progress!.payment,
                state:
                  task.payments.length && progress!.payment === "SETTLED"
                    ? "done"
                    : task.payments.length
                      ? "now"
                      : "todo",
              },
            ]}
          />
          <Rows>
            <Row label="Result" value={task.outcomeState} />
            <Row label="Permission" value={task.authorityState} />
            <Row
              label="Payment"
              value={task.payments.length ? progress!.payment : "No payments"}
            />
            <Row label="Delivery" value={task.delivery.state} />
            <Row
              label="Current step"
              detail={task.currentStep || "None reported"}
            />
            <Row
              label="Gross spend"
              value={`${formatUnitsExact(task.grossSpendUnits)} DemoUSD`}
            />
            <Row label="Task ID" detail={task.taskId} mono />
          </Rows>
          {task.authorityState === "PENDING" &&
          task.outcomeState !== "AWAITING_OWNER" ? (
            <Note>
              Waiting for the service's chain receipt. A signature alone does
              not activate permission.
            </Note>
          ) : null}
          {task.outcomeState === "AWAITING_OWNER" ? (
            <PrimaryButton
              label="Set limits and check draft"
              disabled={!!view.error}
              onPress={() => navigation.navigate("TaskTerms", { taskId })}
            />
          ) : null}
          {task.authorityState === "ACTIVE" ? (
            <>
              <GhostButton
                label="Issue laptop agent token"
                onPress={() => navigation.navigate("AgentToken", { taskId })}
              />
              {["READY", "AWAITING_AGENT", "NEEDS_OWNER"].includes(
                task.outcomeState,
              ) ? (
                <PrimaryButton
                  label={busy ? "Requesting run…" : "Start / retry run request"}
                  disabled={busy || !!view.error}
                  onPress={start}
                />
              ) : null}
              <Note>
                Start asks the service to run this task. It does not launch
                Claude on your laptop. The laptop agent is started separately
                with a task token.
              </Note>
            </>
          ) : null}
          {error ? (
            <Banner
              icon="alert-outline"
              title="Run not confirmed"
              body={error}
            />
          ) : null}
          {approvals.error ? (
            <Banner
              icon="alert-outline"
              title="Approval count unavailable"
              body={approvals.error}
            />
          ) : null}
          {wallet?.address ? (
            <GhostButton
              label={`Payment approvals${approvals.error ? "" : ` (${pending.length})`}`}
              onPress={() =>
                navigation.navigate("Approvals", {
                  wallet: wallet.address!,
                  walletId: wallet.walletId,
                  taskId,
                })
              }
            />
          ) : null}
          <SectionHeading>Payments</SectionHeading>
          {!task.payments.length ? (
            <Note>No payment reported.</Note>
          ) : (
            <Rows>
              {task.payments.map((p) => (
                <Row
                  key={p.actionId}
                  label={`${p.providerId ? `Provider ${p.providerId}` : "Provider not reported"} · ${formatUnitsExact(p.amountUnits)} DemoUSD`}
                  detail={`${p.chainState}\n${p.txHash ?? "No transaction hash reported"}`}
                  onPress={
                    p.txHash
                      ? () =>
                          navigation.navigate("TxDetail", {
                            hash: p.txHash!,
                            origin: "agent",
                            taskId,
                          })
                      : undefined
                  }
                />
              ))}
            </Rows>
          )}
          {task.delivery.result ? (
            <>
              <SectionHeading>Provider result (service report)</SectionHeading>
              <Note>{JSON.stringify(task.delivery.result, null, 2)}</Note>
            </>
          ) : null}
          {task.result ? (
            <>
              <SectionHeading>Task result (service report)</SectionHeading>
              <Note>{JSON.stringify(task.result, null, 2)}</Note>
            </>
          ) : null}
          {task.outcomeState === "COMPLETED" &&
          ["PENDING", "PROVISIONAL"].includes(progress!.payment) ? (
            <Note>
              The service reported a result. A payment is pending, unknown, or
              included provisionally. Final settlement is not confirmed.
            </Note>
          ) : null}
          <GhostButton
            label="Proof and export"
            onPress={() => navigation.navigate("TaskProof", { taskId })}
          />
          {wallet?.address ? (
            <GhostButton
              label="Pause all agents"
              onPress={() =>
                navigation.navigate("AgentControl", {
                  wallet: wallet.address!,
                  command: "PAUSE",
                })
              }
            />
          ) : null}
        </>
      )}
      <GhostButton
        label="Refresh"
        onPress={() => {
          view.reload();
          approvals.reload();
          refs.reload();
        }}
      />
    </Page>
  );
}
