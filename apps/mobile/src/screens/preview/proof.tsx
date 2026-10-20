import { PrimaryButton } from "../../components/Button";
import {
  BigAmount,
  FindingRow,
  GhostButton,
  Heading,
  Note,
  Row,
  Rows,
  Tag,
  Voice,
  type FindingState,
} from "../../components/blocks";
import { Page } from "../../components/Page";
import type { PreviewProps } from "./agentSetup";

// Activity attribution and proof screens (design pass 4). The six findings are
// integrity, authority, policy, settlement, delivery and completion.

export interface FindingView {
  name: string;
  state: FindingState;
  reason: string;
}

export interface ActivityRow {
  title: string;
  detail: string;
  amount: string;
  who: "You" | "Agent";
}

export function ActivityWho({
  onBack,
  today,
}: PreviewProps & { today: readonly ActivityRow[] }) {
  return (
    <Page title="Activity" onBack={onBack}>
      <Rows>
        {today.map((a) => (
          <Row
            key={a.title + a.detail}
            label={a.title}
            detail={`${a.detail} · ${a.who}`}
            value={a.amount}
          />
        ))}
      </Rows>
      <Note>
        Activity is read from the chain. The label says who made each one: you
        or the agent.
      </Note>
    </Page>
  );
}

export function AgentPaymentDetail({ onBack }: PreviewProps) {
  return (
    <Page
      title="Paid by the agent"
      onBack={onBack}
      footer={<GhostButton label="Open the proof" />}
    >
      <BigAmount value="−0.40" unit="DUSD to Tessel Checks" />
      <Rows>
        <Row label="Task" value="Checking the checkout" />
        <Row label="Agent decision" value="Chose the lowest quote" />
        <Row label="Under limit" value="Per payment 2.00" />
        <Row label="Owner approval" value="Not needed, below 1.50" />
        <Row label="Status" value="Included, not final yet" />
        <Row label="Transaction" value="0x9f2c…a41e" mono />
      </Rows>
    </Page>
  );
}

export function OwnerTransferDetail({ onBack }: PreviewProps) {
  return (
    <Page title="Signed by you" onBack={onBack}>
      <BigAmount value="−50.00" unit="DUSD to your agent wallet" />
      <Rows>
        <Row label="Kind" value="Owner transfer" />
        <Row label="Signed" value="On this phone" />
        <Row label="Effect" value="Agents paused until new approvals" />
        <Row label="Status" value="Confirmed" />
        <Row label="Transaction" value="0x31ce…77d0" mono />
      </Rows>
      <Note>An owner transfer is not an agent payment, and has no task.</Note>
    </Page>
  );
}

export function Proof({
  onBack,
  findings,
  source,
  running,
}: PreviewProps & {
  findings: readonly FindingView[];
  source: string;
  running?: boolean;
}) {
  return (
    <Page
      title="Proof"
      subtitle={source}
      onBack={onBack}
      footer={
        running ? undefined : (
          <PrimaryButton label="Export for independent check" />
        )
      }
    >
      <Rows>
        {findings.map((f) => (
          <FindingRow
            key={f.name}
            name={f.name}
            state={f.state}
            reason={f.reason}
            onPress={() => {}}
          />
        ))}
      </Rows>
      <Note>
        {running
          ? "Not yet is not a failure. These update when the task ends."
          : "This is the service's own view. Run the independent check to confirm it without the service."}
      </Note>
    </Page>
  );
}

export function FindingDetail({
  onBack,
  name,
  state,
  statement,
  basis,
  evidence,
  note,
}: PreviewProps & {
  name: string;
  state: string;
  statement: string;
  basis: readonly string[];
  evidence: readonly { label: string; value: string }[];
  note?: string;
}) {
  return (
    <Page title={name} subtitle={state} onBack={onBack}>
      <Voice>{statement}</Voice>
      <Heading>Based on</Heading>
      {basis.map((b) => (
        <Tag key={b} label={b} wax={b === "Service's own record"} />
      ))}
      {evidence.length > 0 ? (
        <Rows>
          {evidence.map((e) => (
            <Row key={e.label} label={e.label} value={e.value} />
          ))}
        </Rows>
      ) : null}
      {note ? <Note>{note}</Note> : null}
    </Page>
  );
}

export function ExportProof({ onBack }: PreviewProps) {
  return (
    <Page
      title="Export proof"
      subtitle="A file you can check without the Mandate service."
      onBack={onBack}
      footer={<PrimaryButton label="Save or share file" />}
    >
      <Heading>What is in it</Heading>
      <Rows>
        <Row label="Event record" value="14 events" />
        <Row label="Signed approvals" value="Task, payments" />
        <Row label="Provider result" value="Tessel, signed" />
        <Row label="Findings" value="The six" />
      </Rows>
      <Heading>What is left out</Heading>
      <Note>
        Recovery phrase, keys, sign-in tokens and agent reasoning text.
      </Note>
      <Note>Nothing is uploaded. You choose where the file goes.</Note>
    </Page>
  );
}

export function IndependentCheck({
  onBack,
  findings,
}: PreviewProps & { findings: readonly FindingView[] }) {
  return (
    <Page
      title="Independent check"
      subtitle="Report from mandate-verify. Not produced by this app."
      onBack={onBack}
    >
      <Rows>
        {findings.map((f) => (
          <FindingRow
            key={f.name}
            name={f.name}
            state={f.state}
            reason={f.reason}
          />
        ))}
      </Rows>
      <Row label="Unexplained outflows" value="None found" />
      <Note>
        Exit code 2: nothing failed, one finding cannot be confirmed
        independently.
      </Note>
    </Page>
  );
}

export function AgentDecisions({ onBack }: PreviewProps) {
  return (
    <Page
      title="Agent decisions"
      subtitle="What the agent chose, as the service recorded it. This is a record, not proof."
      onBack={onBack}
    >
      <Heading>Checking the checkout</Heading>
      <Rows>
        <Row
          label="Chose Tessel Checks"
          detail="Lowest quote with all three checks."
        />
        <Row
          label="Confirmed the result"
          detail="The checks answer the goal."
        />
      </Rows>
      <Heading>Run by</Heading>
      <Rows>
        <Row label="Agent" value="Claude Agent SDK" />
        <Row label="Tools" value="Fixed set 0xa3…19" mono />
      </Rows>
      <Note>
        Whatever the agent decided, spending stayed inside your limits.
      </Note>
    </Page>
  );
}
