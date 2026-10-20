import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Banner } from "../components/Banner";
import {
  GhostButton,
  HoldToSeal,
  Note,
  Row,
  Rows,
  Voice,
} from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  decideApproval,
  listApprovals,
  useApiSession,
  type PaymentApproval,
} from "../wallet/api";
import { TOKENS } from "../wallet/config";
import { formatAmount, shortAddress } from "../wallet/format";
import { errorText, useAsync } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "Approvals">;

const amountText = (a: PaymentApproval) => {
  const token = TOKENS.find(
    (t) => t.address?.toLowerCase() === a.invoice?.asset.toLowerCase(),
  );
  return token
    ? `${formatAmount(BigInt(a.action.amount), token.decimals)} ${token.symbol}`
    : `${a.action.amount} base units`;
};

// Payments the agent wants to make above your approval limit. Each needs
// your signature on this phone; doing nothing lets it expire unpaid.
export function ApprovalsScreen({ navigation, route }: Props) {
  const { wallet } = route.params;
  const api = useApiSession();
  const list = useAsync(
    () => (api ? listApprovals() : Promise.resolve([])),
    [api?.sessionId],
  );
  const [open, setOpen] = useState<PaymentApproval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  const decide = async (a: PaymentApproval, approve: boolean) => {
    setError(null);
    try {
      await decideApproval(a, wallet, approve);
      setOpen(null);
      list.reload();
    } catch (e) {
      setError(errorText(e));
      setKey((k) => k + 1);
    }
  };

  if (open)
    return (
      <Page
        title="Approve a payment"
        subtitle={`The agent wants to pay ${amountText(open)} to ${shortAddress(open.action.target)}.`}
        onBack={() => setOpen(null)}
        footer={
          <GhostButton label="Decline" onPress={() => decide(open, false)} />
        }
      >
        <Rows>
          <Row label="To" value={shortAddress(open.action.target)} mono />
          <Row label="Amount" value={amountText(open)} />
          <Row
            label="Expires"
            value={new Date(Number(open.expiresAt) * 1000).toLocaleTimeString()}
          />
        </Rows>
        {open.rationale ? (
          <Note>
            Agent's reason (written by the agent, not checked): {open.rationale}
          </Note>
        ) : null}
        <Note>
          If you do nothing, the payment is not made and the agent is told.
        </Note>
        {error ? (
          <Banner icon="alert-outline" title="Not done" body={error} />
        ) : null}
        <HoldToSeal
          key={key}
          label="Press and hold to approve"
          onSealed={() => decide(open, true)}
        />
      </Page>
    );

  const pending = (list.data ?? []).filter((a) => a.state === "PENDING");
  return (
    <Page title="Approvals" onBack={() => navigation.goBack()}>
      {!api ? (
        <Voice>
          Sign in to the Mandate service in Settings to see payment approvals.
        </Voice>
      ) : list.error ? (
        <Banner
          icon="cloud-off-outline"
          title="Could not load approvals"
          body={list.error}
        />
      ) : pending.length === 0 ? (
        <Voice>{list.loading ? "Loading…" : "Nothing waiting for you."}</Voice>
      ) : (
        <Rows>
          {pending.map((a) => (
            <Row
              key={a.approvalId}
              label={`Pay ${amountText(a)}`}
              detail={`To ${shortAddress(a.action.target)}`}
              onPress={() => setOpen(a)}
            />
          ))}
        </Rows>
      )}
      <GhostButton label="Refresh" onPress={list.reload} />
    </Page>
  );
}
