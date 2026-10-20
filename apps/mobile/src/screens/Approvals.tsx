import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
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
import { useServicePoll } from "../state/useServicePoll";
import {
  decideApproval,
  getServiceWallet,
  listApprovals,
  registeredServiceWallet,
  useApiSession,
  type PaymentApproval,
} from "../wallet/api";
import { TOKENS } from "../wallet/config";
import { shortAddress } from "../wallet/format";
import { formatUnitsExact } from "../wallet/service-validation";
import { errorText } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "Approvals">;
const amountText = (a: PaymentApproval) => {
  const token = TOKENS.find(
    (t) => t.address?.toLowerCase() === a.invoice?.asset.toLowerCase(),
  );
  return token
    ? `${formatUnitsExact(a.action.amount, token.decimals)} ${token.symbol}`
    : `${a.action.amount} base units`;
};
export function ApprovalsScreen({ navigation, route }: Props) {
  const { wallet, walletId, taskId } = route.params;
  const api = useApiSession();
  const list = useServicePoll(
    async () => {
      const registered = walletId
        ? await getServiceWallet(walletId)
        : await registeredServiceWallet();
      if (
        !registered ||
        registered.address?.toLowerCase() !== wallet.toLowerCase()
      )
        throw new Error(
          "This approval inbox does not belong to the current service wallet.",
        );
      return (await listApprovals()).filter(
        (a) =>
          a.walletId === registered.walletId &&
          (!taskId || a.taskId === taskId),
      );
    },
    `inbox:${wallet}:${walletId ?? ""}:${taskId ?? ""}`,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const pending = (list.data ?? []).filter(
    (a) =>
      a.state === "PENDING" &&
      BigInt(a.expiresAt) > BigInt(Math.floor(Date.now() / 1000)),
  );
  const open = pending.find((a) => a.approvalId === openId);
  useEffect(() => {
    setOpenId(null);
    setError(null);
  }, [api?.sessionId, wallet, taskId]);
  const decide = async (a: PaymentApproval, approve: boolean) => {
    if (inFlight.current || list.error) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await decideApproval(a, wallet, approve);
      setOpenId(null);
      list.reload();
    } catch (e) {
      setError(errorText(e));
      setKey((k) => k + 1);
      list.reload();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  if (open)
    return (
      <Page
        title="Approve a payment"
        subtitle={`The agent wants to pay ${amountText(open)}.`}
        onBack={() => {
          if (!busy) setOpenId(null);
        }}
        footer={
          <GhostButton
            label={busy ? "Submitting…" : "Decline"}
            disabled={busy || !!list.error}
            onPress={() => decide(open, false)}
          />
        }
      >
        <Rows>
          <Row label="Recipient" detail={open.action.target} mono />
          <Row label="Amount" value={amountText(open)} />
          <Row label="Asset" detail={open.invoice!.asset} mono />
          <Row label="Task" detail={open.taskId} mono />
          <Row
            label="Action digest"
            detail={open.typedData.message.actionDigest}
            mono
          />
          <Row
            label="Expires"
            detail={new Date(Number(open.expiresAt) * 1000).toLocaleString()}
          />
        </Rows>
        {open.rationale ? (
          <Note>Agent's reason (written by the agent): {open.rationale}</Note>
        ) : null}
        <Note>
          These recipient and amount fields are bound to the validated Action
          and invoice. If you do nothing, this approval expires and does not
          authorize payment.
        </Note>
        {error || list.error ? (
          <Banner
            icon="alert-outline"
            title="Decision not confirmed"
            body={error ?? list.error!}
          />
        ) : null}
        <HoldToSeal
          key={`${open.approvalId}:${key}`}
          label={busy ? "Submitting…" : "Press and hold to approve"}
          disabled={busy || !!list.error}
          onSealed={() => decide(open, true)}
        />
      </Page>
    );
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
      ) : !pending.length ? (
        <Voice>{list.loading ? "Loading…" : "Nothing waiting for you."}</Voice>
      ) : (
        <Rows>
          {pending.map((a) => (
            <Row
              key={a.approvalId}
              label={`Pay ${amountText(a)}`}
              detail={`To ${shortAddress(a.action.target)}`}
              onPress={() => {
                setError(null);
                setOpenId(a.approvalId);
              }}
            />
          ))}
        </Rows>
      )}
      {openId && !open ? (
        <Note>The selected request is no longer pending or has expired.</Note>
      ) : null}
      {error ? (
        <Banner
          icon="alert-outline"
          title="Decision not confirmed"
          body={error}
        />
      ) : null}
      <GhostButton label="Refresh" onPress={list.reload} />
    </Page>
  );
}
