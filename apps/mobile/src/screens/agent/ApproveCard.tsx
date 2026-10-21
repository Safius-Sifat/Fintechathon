import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { PrimaryButton } from "../../components/Button";
import { GhostButton, HoldToSeal } from "../../components/blocks";
import { AgentMessage, CardLine, ThreadCard } from "../../components/chat";
import { defaultTerms } from "../../state/agentThread";
import {
  decimalUnits,
  taskTerms,
  type TermsForm,
} from "../../state/taskModels";
import { type, makeStyles } from "../../theme";
import {
  activatePermit,
  draftPermit,
  listProviders,
  permitContext,
  type OwnerApproval,
  type Provider,
  type Terms,
} from "../../wallet/api";
import { TOKENS } from "../../wallet/config";
import { formatAmount } from "../../wallet/format";
import { validatePermitDraft } from "../../wallet/service-validation";
import { errorText } from "../../wallet/useAsync";

// The agent asks for its spending limits inside the thread. The limits are
// filled from the published providers; the service drafts the permission, this
// phone checks the draft against them, and you sign with the hold seal.
export function ApproveCard({
  taskId,
  input,
  onEdit,
  onSigned,
}: {
  taskId: string;
  input: Record<string, unknown> | undefined;
  onEdit: () => void;
  onSigned: () => void;
}) {
  const styles = useStyles();
  const [plan, setPlan] = useState<{
    form: TermsForm;
    providers: Provider[];
  } | null>(null);
  const [review, setReview] = useState<{
    draft: OwnerApproval;
    terms: Terms;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [holdKey, setHoldKey] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!input || plan) return;
    listProviders()
      .then((all) => {
        const p = defaultTerms(all, input);
        if (p) setPlan(p);
        else setError("No published provider can run these checks.");
      })
      .catch((e) => setError(errorText(e)));
  }, [input, plan]);

  const check = async () => {
    if (inFlight.current || !plan) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const terms = taskTerms(plan.form, TOKENS[0]!.address!);
      const draft = await draftPermit(taskId, terms);
      const context = await permitContext(taskId, terms);
      setReview({ draft: validatePermitDraft(draft, context), terms });
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const approve = async () => {
    if (inFlight.current || !review) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const context = await permitContext(taskId, review.terms);
      const checked = validatePermitDraft(review.draft, context);
      await activatePermit(checked, taskId, review.terms);
      onSigned();
    } catch (e) {
      setError(errorText(e));
      setHoldKey((k) => k + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const f = plan?.form;
  const dusd = (v: string) =>
    `${formatAmount(BigInt(decimalUnits(v)), 6)} DUSD`;
  return (
    <AgentMessage
      text={
        review
          ? "Your wallet checked the service's draft against these limits. Hold to approve."
          : "Here's what I'd like to be allowed to spend."
      }
    >
      {f ? (
        <ThreadCard>
          {plan!.providers.map((p) => (
            <CardLine
              key={p.providerId}
              label={`Provider ${p.providerId.toUpperCase()}`}
              value={`${formatAmount(BigInt(p.price), 6)} DUSD a check`}
            />
          ))}
          <CardLine label="Most per payment" value={dusd(f.maxPayment)} />
          <CardLine label="Most for this task" value={dusd(f.spendCap)} />
          <CardLine label="Keep in the wallet" value={dusd(f.liquidFloor)} />
          <CardLine
            label="Ask me first above"
            value={dusd(f.reviewThreshold)}
          />
          <CardLine label="Paid attempts" value={`Up to ${f.maxPayments}`} />
          {review ? (
            <HoldToSeal
              key={holdKey}
              label={busy ? "Approving…" : "Hold to approve"}
              disabled={busy}
              onSealed={approve}
            />
          ) : (
            <PrimaryButton
              label={busy ? "Checking…" : "Check and approve"}
              disabled={busy}
              onPress={check}
            />
          )}
          <GhostButton label="Change the limits" onPress={onEdit} />
        </ThreadCard>
      ) : !error ? (
        <Text style={styles.muted}>Looking up providers…</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AgentMessage>
  );
}

const useStyles = makeStyles((colors) => ({
  muted: { ...type.body, color: colors.ink2 },
  error: { ...type.body, color: colors.bad },
}));
