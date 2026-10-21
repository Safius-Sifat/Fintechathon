// Turns a typed request and the service's task state into the agent thread.
// Nothing here invents agent output: the request is read by fixed rules and
// shown back for confirmation, and every status line comes from the task view.
import type { StepItem } from "../components/blocks";
import type { Provider } from "../wallet/api";
import type { TaskView } from "../wallet/service-dto/api";
import { formatAmount } from "../wallet/format";
import { formatUnitsExact, taskProgress } from "../wallet/service-validation";
import {
  browserInput,
  type BrowserCheck,
  type BrowserForm,
  type TermsForm,
} from "./taskModels";

const CHECK_WORDS: Record<BrowserCheck, string> = {
  pageLoad: "the page loads",
  title: "the title shows",
  formSubmit: "the form submits",
};

// Reads a plain request as a browser check. The page check runbook is the only
// one the service runs today, so anything else is refused rather than guessed.
export function readRequest(
  text: string,
  now = Math.floor(Date.now() / 1000),
): BrowserForm {
  const t = text.toLowerCase();
  if (!/\b(check|test|verify|load|page|checkout|site|form)\b/.test(t))
    throw new Error(
      "I can only run page checks for now. Try “Check that the checkout page loads”.",
    );
  const checks: BrowserCheck[] = ["pageLoad", "title"];
  if (/\b(form|submit|checkout flow|pay)\b/.test(t)) checks.push("formSubmit");
  return browserInput(
    {
      targetId: /\b(broken|failing|fail|bug)\b/.test(t)
        ? "checkout-broken"
        : "checkout-healthy",
      checks,
      maxPaidAttempts: 3,
      maxSteps: 8,
      taskDeadline: String(now + 3600),
    },
    now,
  );
}

export function describeRequest(form: BrowserForm) {
  const page =
    form.targetId === "checkout-broken"
      ? "the broken checkout page"
      : "the checkout page";
  return `Check ${page}: ${form.checks.map((c) => CHECK_WORDS[c]).join(", ")}.`;
}

// Fills the limits from the providers the service publishes for these checks.
// The service still refuses any recipient not bound to the task.
export function defaultTerms(
  providers: Provider[],
  input: Record<string, unknown> | undefined,
  now = Math.floor(Date.now() / 1000),
): { form: TermsForm; providers: Provider[] } | null {
  const checks = Array.isArray(input?.checks) ? input.checks.map(String) : [];
  const fit = providers.filter(
    (p) =>
      p.available &&
      p.recipient &&
      checks.length > 0 &&
      checks.every((c) => p.capabilities.includes(c)),
  );
  if (!fit.length) return null;
  const top = fit.reduce(
    (m, p) => (BigInt(p.price) > m ? BigInt(p.price) : m),
    0n,
  );
  const attempts = BigInt(Number(input?.maxPaidAttempts) || 1);
  const cap = top * attempts > 2_000_000n ? 2_000_000n : top * attempts;
  const deadline =
    typeof input?.taskDeadline === "string" ? input.taskDeadline : "";
  return {
    providers: fit,
    form: {
      recipients: fit.map((p) => p.recipient).join(", "),
      maxPayment: formatUnitsExact(top.toString(), 6),
      spendCap: formatUnitsExact(cap.toString(), 6),
      liquidFloor: "3",
      reviewThreshold: formatUnitsExact(top.toString(), 6),
      // A minute ahead, so the start is never before the service's issue time.
      startsAt: String(now + 60),
      expiresAt: deadline || String(now + 3600),
      maxActions: Number(input?.maxSteps) || 8,
      maxPayments: Number(input?.maxPaidAttempts) || 1,
    },
  };
}

const stopped = ["REVOKED", "EXPIRED", "INVALIDATED", "FROZEN"];

// Tasks whose permission was signed on this phone in this session. The service
// keeps such a task in AWAITING_OWNER until the chain receipt arrives.
export const signedTasks = new Set<string>();

// One plain sentence for where the task stands, from the service's states.
export function agentLine(
  task: TaskView,
  pendingApprovals = 0,
  signed = signedTasks.has(task.taskId),
): string {
  const progress = taskProgress(task);
  if (stopped.includes(task.authorityState))
    return task.authorityState === "FROZEN"
      ? "The wallet is frozen, so I can't pay for anything."
      : "My permission for this task has ended. Nothing more will be paid.";
  if (task.outcomeState === "CANCELLED") return "This task was cancelled.";
  if (task.outcomeState === "AWAITING_OWNER" && !signed)
    return "Before I start, set what I'm allowed to spend and approve it.";
  if (task.authorityState === "PENDING")
    return "Approved on your phone. Waiting for it to land on chain before I start.";
  if (pendingApprovals > 0)
    return "A payment needs your approval before I continue.";
  if (task.outcomeState === "COMPLETED")
    return progress.done
      ? "Done. Here's what the provider found."
      : "The provider sent a result. The payment isn't final on chain yet.";
  if (task.outcomeState === "DELIVERY_FAILED")
    return "I paid, but the provider's result didn't check out.";
  if (task.outcomeState === "NEEDS_OWNER")
    return "I'm stuck and need you to look at this task.";
  if (task.outcomeState === "RUNNING" || task.outcomeState === "AWAITING_AGENT")
    return progress.payment === "FAILED"
      ? "A payment didn't go through. Check the agent wallet holds enough DemoUSD above what I must keep."
      : "Working on it.";
  return "Ready. Start me when you want.";
}

const PAYMENT_DONE = ["INCLUDED", "FINALIZED"];
const PAYMENT_FAILED = ["DENIED", "REJECTED", "REVERTED"];

// The step list under the agent's message, one row per real event.
export function threadSteps(
  task: TaskView,
  signed = signedTasks.has(task.taskId),
): StepItem[] {
  const active = !["PENDING", ...stopped].includes(task.authorityState);
  const steps: StepItem[] = [
    {
      title: active
        ? "Spending approved"
        : signed
          ? "Approval landing on chain"
          : "Waiting for your approval",
      state: active ? "done" : "now",
    },
  ];
  if (!active) return steps;
  const working =
    ["RUNNING", "AWAITING_AGENT"].includes(task.outcomeState) &&
    taskProgress(task).payment !== "FAILED";
  steps.push({
    title: "Checking the page",
    state:
      task.outcomeState === "COMPLETED" ||
      task.outcomeState === "DELIVERY_FAILED"
        ? "done"
        : working
          ? "now"
          : "todo",
  });
  for (const p of task.payments) {
    const who = p.providerId
      ? `provider ${p.providerId.toUpperCase()}`
      : "a provider";
    const amount = `${formatAmount(BigInt(p.amountUnits), 6)} DUSD`;
    steps.push(
      PAYMENT_FAILED.includes(p.chainState)
        ? { title: `Payment of ${amount} to ${who} failed`, state: "failed" }
        : PAYMENT_DONE.includes(p.chainState)
          ? { title: `Paid ${who} ${amount}`, state: "done" }
          : {
              title: `Paying ${who} ${amount}`,
              detail: "Waiting for the chain",
              state: "now",
            },
    );
  }
  if (task.delivery.state !== "NONE")
    steps.push({
      title:
        task.delivery.state === "VALID"
          ? "Result received and verified"
          : task.delivery.state === "PENDING"
            ? "Waiting for the provider's result"
            : "The provider's result failed checks",
      state: task.delivery.state === "PENDING" ? "now" : "done",
    });
  return steps;
}

// What the agent is waiting on right now, or null when nothing is in motion.
export function nowDoing(
  task: TaskView,
  signed = signedTasks.has(task.taskId),
): string | null {
  if (task.authorityState === "PENDING" && signed)
    return "Waiting for your approval to land on chain";
  if (!["RUNNING", "AWAITING_AGENT"].includes(task.outcomeState)) return null;
  const paying = task.payments.find(
    (p) =>
      !PAYMENT_DONE.includes(p.chainState) &&
      !PAYMENT_FAILED.includes(p.chainState),
  );
  if (paying)
    return `Waiting for the payment to ${paying.providerId ? `provider ${paying.providerId.toUpperCase()}` : "the provider"} to confirm`;
  if (task.delivery.state === "PENDING")
    return "Waiting for the provider's result";
  if (taskProgress(task).payment === "FAILED") return null;
  return task.payments.length
    ? "Checking the page"
    : "Asking providers for a quote";
}

// Stop is offered while the agent could still spend.
export const canStop = (task: TaskView) =>
  task.authorityState === "ACTIVE" &&
  !["COMPLETED", "CANCELLED", "DELIVERY_FAILED"].includes(task.outcomeState);
