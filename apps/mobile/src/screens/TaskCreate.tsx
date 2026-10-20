import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import {
  Chips,
  GhostButton,
  Note,
  Row,
  Rows,
  SectionHeading,
} from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { browserInput, CHECKS, type BrowserForm } from "../state/taskModels";
import { useServicePoll } from "../state/useServicePoll";
import { makeStyles, radius, space, type, useColors } from "../theme";
import { createTask, getServiceWallet } from "../wallet/api";
import {
  readServiceReferences,
  updateServiceReferences,
} from "../wallet/local";
import { CreateTaskRequestSchema } from "../wallet/service-dto/api";
import { currentAccount } from "../wallet/session";
import { errorText } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "TaskCreate">;
export function TaskCreateScreen({ navigation, route }: Props) {
  const wallet = useServicePoll(
    () => getServiceWallet(route.params.walletId),
    route.params.walletId,
  );
  const [goal, setGoal] = useState("");
  const [form, setForm] = useState<BrowserForm>(() => ({
    targetId: "checkout-healthy",
    checks: [...CHECKS],
    maxPaidAttempts: 3,
    maxSteps: 8,
    taskDeadline: String(Math.floor(Date.now() / 1000) + 3600),
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const inFlight = useRef(false);
  const body = useRef<Parameters<typeof createTask>[0] | null>(null);
  const owner = currentAccount()!.address;
  useEffect(() => {
    let live = true;
    readServiceReferences(owner)
      .then((refs) => {
        if (!live || !refs.pendingTask) return;
        if (refs.pendingTask.walletId !== route.params.walletId)
          throw new Error(
            "A pending task request belongs to another service wallet. Reopen that wallet to retry it.",
          );
        body.current = CreateTaskRequestSchema.parse(refs.pendingTask);
        setGoal(body.current.goal);
        setSubmitted(true);
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      })
      .finally(() => {
        if (live) setRestoring(false);
      });
    return () => {
      live = false;
    };
  }, [owner, route.params.walletId]);
  const create = async () => {
    if (
      inFlight.current ||
      wallet.error ||
      wallet.data?.provisioningState !== "READY"
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!body.current) {
        if (!goal.trim()) throw new Error("Describe what you want checked.");
        body.current = {
          walletId: route.params.walletId,
          runbookId: "browser-check",
          goal: goal.trim(),
          input: browserInput(form),
        };
      }
      setSubmitted(true);
      const immutable = body.current;
      await updateServiceReferences(owner, (refs) => ({
        ...refs,
        pendingTask: { ...immutable, runbookId: "browser-check" },
      }));
      const task = await createTask(body.current);
      await updateServiceReferences(owner, (refs) => {
        const { pendingTask: _pending, ...rest } = refs;
        return rest;
      });
      navigation.replace("TaskDetail", { taskId: task.taskId });
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const prepareAnother = () =>
    Alert.alert(
      "Prepare a separate task?",
      "The earlier request may have succeeded. This clears only its local retry form; it does not cancel a server task.",
      [
        { text: "Keep this request", style: "cancel" },
        {
          text: "Prepare another",
          onPress: () => {
            void updateServiceReferences(owner, (refs) => {
              const { pendingTask: _pending, ...rest } = refs;
              return rest;
            })
              .then(() => {
                body.current = null;
                setSubmitted(false);
                setError(null);
                setForm((previous) => ({
                  ...previous,
                  taskDeadline: String(Math.floor(Date.now() / 1000) + 3600),
                }));
              })
              .catch((e) => setError(errorText(e)));
          },
        },
      ],
    );
  return (
    <Page
      title="Check a web page"
      subtitle="A bounded browser check, paid with test DemoUSD."
      onBack={() => navigation.goBack()}
    >
      {submitted ? (
        <>
          <SectionHeading>Request being retried</SectionHeading>
          <Note>{JSON.stringify(body.current, null, 2)}</Note>
        </>
      ) : (
        <>
          <TaskField
            label="Your goal"
            value={goal}
            onChange={setGoal}
            editable={!submitted}
            multiline
          />
          <SectionHeading>Page</SectionHeading>
          <Chips
            options={[
              { key: "checkout-healthy", label: "Healthy checkout" },
              { key: "checkout-broken", label: "Broken checkout" },
            ]}
            selected={form.targetId}
            onSelect={(targetId) => {
              if (!submitted) setForm({ ...form, targetId });
            }}
          />
          <SectionHeading>Checks</SectionHeading>
          <Rows>
            {CHECKS.map((c) => (
              <Row
                key={c}
                label={c}
                value={form.checks.includes(c) ? "Selected" : "Off"}
                onPress={
                  submitted
                    ? undefined
                    : () =>
                        setForm({
                          ...form,
                          checks: CHECKS.filter((v) =>
                            v === c
                              ? !form.checks.includes(v)
                              : form.checks.includes(v),
                          ),
                        })
                }
              />
            ))}
          </Rows>
          <SectionHeading>Paid attempts</SectionHeading>
          <Chips
            options={[1, 2, 3].map((n) => ({
              key: String(n),
              label: String(n),
            }))}
            selected={String(form.maxPaidAttempts)}
            onSelect={(v) => {
              if (!submitted) setForm({ ...form, maxPaidAttempts: Number(v) });
            }}
          />
          <TaskField
            label="Maximum steps (1–8)"
            value={String(form.maxSteps)}
            onChange={(v) => setForm({ ...form, maxSteps: Number(v) })}
            editable={!submitted}
            numeric
          />
          <TaskField
            label="Task deadline (Unix seconds, within 24 hours)"
            value={form.taskDeadline}
            onChange={(v) => setForm({ ...form, taskDeadline: v })}
            editable={!submitted}
            numeric
          />
          <Note>
            {/^\d+$/.test(form.taskDeadline)
              ? new Date(Number(form.taskDeadline) * 1000).toLocaleString()
              : "Enter a deadline."}{" "}
            You choose provider recipients and financial limits before signing.
          </Note>
        </>
      )}
      {wallet.data?.provisioningState !== "READY" ? (
        <Note>The service wallet must be ready before creating a task.</Note>
      ) : null}
      {wallet.error || error ? (
        <Banner
          icon="alert-outline"
          title="Task not confirmed"
          body={error ?? wallet.error!}
        />
      ) : null}
      {submitted ? (
        <Note>
          Retry sends the same task and request ID. Its fields stay fixed until
          the service answers. Reopen known tasks from Agents after a lost
          response.
        </Note>
      ) : null}
      <PrimaryButton
        label={
          busy
            ? "Creating…"
            : restoring
              ? "Recovering request…"
              : submitted
                ? "Retry this task"
                : "Create task"
        }
        disabled={
          busy ||
          restoring ||
          !!wallet.error ||
          wallet.data?.provisioningState !== "READY"
        }
        onPress={create}
      />
      {submitted ? (
        <GhostButton
          label="Prepare a separate task"
          disabled={busy}
          onPress={prepareAnother}
        />
      ) : null}
      <GhostButton label="Back to Agents" onPress={() => navigation.goBack()} />
    </Page>
  );
}

export function TaskField({
  label,
  value,
  onChange,
  editable = true,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  editable?: boolean;
  numeric?: boolean;
  multiline?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={editable}
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        placeholderTextColor={colors.ink3}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}
const useStyles = makeStyles((colors) => ({
  field: { gap: space.sm },
  label: { ...type.small, color: colors.ink2 },
  input: {
    ...type.body,
    minHeight: 52,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.raised,
    color: colors.ink,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
}));
