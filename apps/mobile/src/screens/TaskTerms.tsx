import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import {
  GhostButton,
  HoldToSeal,
  Note,
  Row,
  Rows,
  SectionHeading,
  Voice,
} from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { taskTerms, type TermsForm } from "../state/taskModels";
import { useServicePoll } from "../state/useServicePoll";
import {
  activatePermit,
  draftPermit,
  listProviders,
  permitContext,
  serviceTaskReferences,
  type OwnerApproval,
  type Terms,
} from "../wallet/api";
import { TOKENS } from "../wallet/config";
import {
  formatUnitsExact,
  validatePermitDraft,
} from "../wallet/service-validation";
import { errorText } from "../wallet/useAsync";
import { TaskField } from "./TaskCreate";

type Props = NativeStackScreenProps<RootStackParamList, "TaskTerms">;
export function TaskTermsScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const context = useServicePoll(
    () => permitContext(taskId),
    `terms:${taskId}`,
  );
  const refs = useServicePoll(serviceTaskReferences, `goal:${taskId}`, 0);
  const [form, setForm] = useState<TermsForm>(() => ({
    recipients: "",
    maxPayment: "",
    spendCap: "",
    liquidFloor: "0",
    reviewThreshold: "0",
    startsAt: String(Math.floor(Date.now() / 1000) + 60),
    expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
    maxActions: 8,
    maxPayments: 3,
  }));
  const [review, setReview] = useState<{
    draft: OwnerApproval;
    terms: Terms;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [holdKey, setHoldKey] = useState(0);
  const inFlight = useRef(false);
  const reference = refs.data?.find((t) => t.taskId === taskId);
  const goal = reference?.goal;
  const loadedLimits = useRef(false);
  useEffect(() => {
    if (loadedLimits.current || !reference?.input) return;
    const input = reference.input;
    if (
      typeof input.taskDeadline !== "string" ||
      !/^\d+$/.test(input.taskDeadline)
    )
      return;
    loadedLimits.current = true;
    setForm((previous) => ({
      ...previous,
      expiresAt: input.taskDeadline as string,
      maxActions: Number(input.maxSteps),
      maxPayments: Number(input.maxPaidAttempts),
    }));
  }, [reference]);
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const loadedProviders = useRef(false);
  useEffect(() => {
    const checks = reference?.input?.checks;
    if (loadedProviders.current || !Array.isArray(checks)) return;
    loadedProviders.current = true;
    listProviders()
      .then((all) => {
        const fit = all.filter(
          (p) =>
            p.available &&
            p.recipient &&
            checks.every((c) => p.capabilities.includes(String(c))),
        );
        if (fit.length === 0)
          return setProviderNote(
            "No published provider supports these checks.",
          );
        const top = fit.reduce(
          (m, p) => (BigInt(p.price) > m ? BigInt(p.price) : m),
          0n,
        );
        const cap =
          top * BigInt(Number(reference?.input?.maxPaidAttempts) || 1);
        const limit = 2_000_000n;
        setForm((f) =>
          f.recipients
            ? f
            : {
                ...f,
                recipients: fit.map((p) => p.recipient).join(", "),
                maxPayment: formatUnitsExact(top.toString(), 6),
                spendCap: formatUnitsExact(
                  (cap > limit ? limit : cap).toString(),
                  6,
                ),
              },
        );
        setProviderNote(
          `Filled in from the service's published providers: ${fit
            .map(
              (p) =>
                `provider ${p.providerId.toUpperCase()} at ${formatUnitsExact(p.price, 6)} DemoUSD`,
            )
            .join(
              ", ",
            )}. The service refuses any recipient not bound to this task.`,
        );
      })
      .catch((e) => setProviderNote(errorText(e)));
  }, [reference]);
  let checked: OwnerApproval | null = null;
  let invalid: string | null = context.error;
  if (review && context.data && !context.error) {
    try {
      checked = validatePermitDraft(review.draft, {
        ...context.data,
        nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
        terms: review.terms,
      });
    } catch (e) {
      invalid = errorText(e);
    }
  }
  const getDraft = async () => {
    if (inFlight.current || !context.data || context.error) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (context.data.task.runbookId !== "browser-check")
        throw new Error("This editor supports browser-check only.");
      const terms = taskTerms(form, TOKENS[0]!.address!);
      const input = reference?.input;
      if (
        input &&
        (BigInt(terms.expiresAt) > BigInt(String(input.taskDeadline)) ||
          terms.maxActions > Number(input.maxSteps) ||
          terms.maxPayments > Number(input.maxPaidAttempts))
      )
        throw new Error(
          "Terms must fit this task's deadline, maximum steps and paid attempts. Check the original request below.",
        );
      const draft = await draftPermit(taskId, terms);
      const fresh = await permitContext(taskId, terms);
      setReview({ draft: validatePermitDraft(draft, fresh), terms });
      context.reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const approve = async () => {
    if (inFlight.current || !checked || !review) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await activatePermit(checked, taskId, review.terms);
      navigation.replace("TaskDetail", { taskId });
    } catch (e) {
      setError(errorText(e));
      setHoldKey((k) => k + 1);
      context.reload();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const p = checked?.typedData.message;
  return (
    <Page
      title={review ? "Check the draft" : "Task limits"}
      onBack={() => navigation.goBack()}
    >
      <SectionHeading>Your goal</SectionHeading>
      <Voice>
        {goal ??
          "Goal unavailable on this phone. Reopen from the account that created the task."}
      </Voice>
      {review && p && checked ? (
        <>
          <SectionHeading>What you would sign</SectionHeading>
          <Rows>
            <Row
              label="Network / signing domain"
              value="Base Sepolia 84532 / MandateWallet 5"
            />
            <Row label="Task" detail={p.taskId} mono />
            <Row
              label="Wallet"
              detail={checked.typedData.domain.verifyingContract}
              mono
            />
            <Row label="Executor" detail={p.executor} mono />
            <Row label="Operation" value="Browser payments (kind 0)" />
            <Row label="Asset" detail={p.asset} mono />
            <Row
              label="Task cap"
              value={`${formatUnitsExact(p.spendCap)} DemoUSD`}
            />
            <Row
              label="Per payment"
              value={`${formatUnitsExact(p.maxPayment)} DemoUSD`}
            />
            <Row
              label="Keep liquid"
              value={`${formatUnitsExact(p.liquidFloor)} DemoUSD`}
            />
            <Row
              label="Ask me above"
              value={`${formatUnitsExact(p.reviewThreshold)} DemoUSD`}
            />
            <Row
              label="Deposit / withdraw caps"
              value={`${formatUnitsExact(p.depositCap)} / ${formatUnitsExact(p.withdrawCap)}`}
            />
            <Row
              label="Period cap / seconds"
              value={`${formatUnitsExact(p.periodCap)} / ${p.periodSeconds}`}
            />
            <Row
              label="Actions / payments"
              value={`${p.maxActions} / ${p.maxPayments}`}
            />
            <Row
              label="Starts"
              detail={`${p.startsAt} · ${new Date(Number(p.startsAt) * 1000).toLocaleString()}`}
            />
            <Row
              label="Expires"
              detail={`${p.expiresAt} · ${new Date(Number(p.expiresAt) * 1000).toLocaleString()}`}
            />
            <Row
              label="Issued / epoch / nonce"
              detail={`${p.issuedAt} / ${p.epoch} / ${p.nonce}`}
            />
            <Row label="Policy version" value={checked.policyVersion} />
          </Rows>
          <SectionHeading>Can pay only</SectionHeading>
          <Rows>
            {checked.recipients.map((recipient) => (
              <Row key={recipient} label="Recipient" detail={recipient} mono />
            ))}
          </Rows>
          <SectionHeading>Committed scope</SectionHeading>
          <Rows>
            {checked.scope.conditions.browser
              ? Object.entries(checked.scope.conditions.browser).map(
                  ([key, value]) => (
                    <Row
                      key={key}
                      label={key}
                      detail={
                        Array.isArray(value) ? value.join(", ") : String(value)
                      }
                    />
                  ),
                )
              : null}
            {checked.scope.providerBindings.map((b) => (
              <Row
                key={b.providerId}
                label={`Provider ID ${b.providerId}`}
                detail={b.recipient}
                mono
              />
            ))}
            <Row
              label="Runbook"
              detail={`${checked.scope.runbookManifest.runbookId} ${checked.scope.runbookManifest.version}`}
            />
            <Row label="Schedule" detail={JSON.stringify(checked.schedule)} />
            <Row
              label="Templates"
              detail={
                checked.templateIds.length
                  ? checked.templateIds.join("\n")
                  : "None"
              }
            />
            <Row label="Permit digest" detail={checked.digest} mono />
          </Rows>
          <Note>
            Check target, checks and provider IDs against your goal. Recipient
            addresses must match the service's configured providers. Authority
            is active only after a chain receipt.
          </Note>
        </>
      ) : review ? (
        <Note>
          The draft cannot be approved until its current wallet and task checks
          pass.
        </Note>
      ) : (
        <>
          <TaskField
            label="Provider recipient addresses (comma or newline separated)"
            value={form.recipients}
            onChange={(v) => setForm({ ...form, recipients: v })}
            multiline
          />
          <Note>
            {providerNote ??
              "Looking up the providers the service publishes for this task…"}
          </Note>
          {(
            [
              ["maxPayment", "Most per payment (max 0.500000)"],
              ["spendCap", "Total task cap (max 2.000000)"],
              ["liquidFloor", "Keep liquid in DemoUSD"],
              [
                "reviewThreshold",
                "Ask me above in DemoUSD (0 asks for every payment)",
              ],
              ["startsAt", "Starts at (Unix seconds)"],
              [
                "expiresAt",
                "Expires at (Unix seconds; no later than task deadline)",
              ],
            ] as const
          ).map(([key, label]) => (
            <TaskField
              key={key}
              label={label}
              value={form[key]}
              onChange={(v) => setForm({ ...form, [key]: v })}
              numeric
            />
          ))}
          <TaskField
            label="Maximum actions (within task's steps, max 8)"
            value={String(form.maxActions)}
            onChange={(v) => setForm({ ...form, maxActions: Number(v) })}
            numeric
          />
          <TaskField
            label="Maximum payments (within task's paid attempts, max 3)"
            value={String(form.maxPayments)}
            onChange={(v) => setForm({ ...form, maxPayments: Number(v) })}
            numeric
          />
          <Note>
            Amounts use six decimal places. The tightest wallet or task limit
            wins.
          </Note>
          {reference?.input ? (
            <>
              <SectionHeading>Original task input</SectionHeading>
              <Note>{JSON.stringify(reference.input, null, 2)}</Note>
            </>
          ) : null}
        </>
      )}
      {invalid || error ? (
        <Banner
          icon="alert-outline"
          title="Not approved"
          body={error ?? invalid!}
        />
      ) : null}
      {review ? (
        <>
          <HoldToSeal
            key={holdKey}
            label={busy ? "Submitting…" : "Press and hold to approve"}
            disabled={!checked || !!invalid || busy || !goal}
            onSealed={approve}
          />
          <GhostButton
            label="Edit terms"
            disabled={busy}
            onPress={() => {
              setReview(null);
              setError(null);
            }}
          />
          <GhostButton
            label="Check task status"
            disabled={busy}
            onPress={() => navigation.replace("TaskDetail", { taskId })}
          />
          <Note>
            If submission failed, check the task before retrying. A retry of
            this draft reuses the signature held in this unlocked session. After
            relaunch, inspect task status before requesting a new draft.
          </Note>
        </>
      ) : (
        <PrimaryButton
          label={busy ? "Checking…" : "Check draft"}
          disabled={
            busy ||
            !context.data ||
            !!context.error ||
            !goal ||
            context.data.task.outcomeState !== "AWAITING_OWNER"
          }
          onPress={getDraft}
        />
      )}
    </Page>
  );
}
