import { useState } from "react";
import { PrimaryButton } from "../../components/Button";
import {
  BigAmount,
  Chips,
  GhostButton,
  Heading,
  HoldToSeal,
  Note,
  Row,
  Rows,
  Steps,
  Voice,
} from "../../components/blocks";
import { Page } from "../../components/Page";
import { Segmented } from "../../components/Segmented";

// Agent setup screens (design pass 2). Layout only: they take the data to show
// as props and have no wallet, service or signer behind them.
export interface PreviewProps {
  onBack?: () => void;
}

export function AgentIntro({ onBack }: PreviewProps) {
  return (
    <Page
      title="Create an agent wallet"
      subtitle="A separate wallet an agent can spend from, inside limits you sign."
      onBack={onBack}
      footer={<PrimaryButton label="Create agent wallet" />}
    >
      <Rows>
        <Row label="Funded by you, kept apart from your own account. The two are never added together." />
        <Row label="Its signing key is not yours. Your key stays on this phone and approves every permission." />
        <Row label="You can pause or end it from this phone at any time, even when the Mandate service is offline." />
      </Rows>
      <Note>Base Sepolia test network. Nothing here has value.</Note>
    </Page>
  );
}

export function Provisioning({ onBack }: PreviewProps) {
  return (
    <Page
      title="Setting up"
      subtitle="This takes about two minutes. You can close the app."
      onBack={onBack}
      footer={<GhostButton label="Close and notify me" />}
    >
      <Steps
        items={[
          {
            state: "done",
            title: "Wallet contract deployed",
            detail: "On Base Sepolia",
          },
          {
            state: "now",
            title: "Creating the agent's key",
            detail: "Three servers make it together. About 1 minute",
          },
          {
            state: "todo",
            title: "Checking it matches your account",
            detail: "Owner, token and vault are compared with this app",
          },
        ]}
      />
      <Note>
        The address appears only when step 3 passes. Do not send funds to
        anything shown before then.
      </Note>
    </Page>
  );
}

export interface AgentBalances {
  spendable: string;
  liquid: string;
  floor: string;
  reserved: string;
  asOfBlock: string;
}

export function AgentWallet({
  onBack,
  address,
  balances,
}: PreviewProps & { address: string; balances: AgentBalances | null }) {
  return (
    <Page
      title="Agent wallet"
      subtitle={balances ? undefined : "Ready. Not funded yet."}
      onBack={onBack}
      footer={<PrimaryButton label="Fund agent wallet" />}
    >
      <Rows>
        <Row label="Address, matches your account" value={address} mono />
      </Rows>
      {balances ? (
        <>
          <BigAmount value={balances.spendable} unit="DUSD spendable" />
          <Rows>
            <Row label="Liquid" value={balances.liquid} />
            <Row
              label="Floor"
              detail="Always left in the wallet"
              value={balances.floor}
            />
            <Row
              label="Reserved"
              detail="Held for payments in progress"
              value={balances.reserved}
            />
          </Rows>
          <Note>As of block {balances.asOfBlock}. Base Sepolia.</Note>
        </>
      ) : (
        <Rows>
          <Row label="Spendable" value="0.00" />
          <Row label="Reserved" value="0.00" />
        </Rows>
      )}
    </Page>
  );
}

export function FundAgent({ onBack }: PreviewProps) {
  const [amount, setAmount] = useState("50");
  return (
    <Page
      title="Fund agent wallet"
      onBack={onBack}
      footer={<PrimaryButton label={`Review ${amount}.00 DUSD`} />}
    >
      <BigAmount value={`${amount}.00`} unit="DUSD" />
      <Chips
        options={[
          { key: "10", label: "10" },
          { key: "25", label: "25" },
          { key: "50", label: "50" },
          { key: "100", label: "100" },
        ]}
        selected={amount}
        onSelect={setAmount}
      />
      <Rows>
        <Row label="From" value="Personal account" detail="128.00 DUSD" />
        <Row label="To" value="Agent wallet" detail="Matches your account" />
      </Rows>
      <Note>
        Funding is not spending. Only the agent wallet address can receive;
        never send to its signing key. The network fee is paid from your ETH.
      </Note>
    </Page>
  );
}

export function ComposeTask({ onBack }: PreviewProps) {
  return (
    <Page
      title="Describe the task"
      subtitle="Say what you want done. The agent drafts it; nothing is spent until you sign."
      onBack={onBack}
      footer={<PrimaryButton label="Draft the task" />}
    >
      <Voice>
        Check that the demo shop checkout works: it should load, show the right
        title and accept the form.
      </Voice>
      <Heading>Or start from</Heading>
      <Rows>
        <Row label="Check that the checkout page loads" onPress={() => {}} />
        <Row
          label="Let the agent buy page checks, up to 4.00 a day"
          onPress={() => {}}
        />
        <Row label="Pay Mara 4.00 every week for 4 weeks" onPress={() => {}} />
      </Rows>
      <Note>Drafts can be wrong. You check every term before signing.</Note>
    </Page>
  );
}

export interface DraftTerm {
  label: string;
  value: string;
}

export function IntentReview({
  onBack,
  goal,
  terms,
  warning,
}: PreviewProps & {
  goal: string;
  terms: readonly DraftTerm[];
  warning?: string;
}) {
  return (
    <Page
      title="Check the draft"
      onBack={onBack}
      footer={
        <>
          <PrimaryButton label="Approve" />
          <GhostButton label="Edit terms" />
        </>
      }
    >
      <Note>Your goal</Note>
      <Voice>{goal}</Voice>
      <Heading>What you would sign</Heading>
      <Rows>
        {terms.map((t) => (
          <Row key={t.label} label={t.label} value={t.value} />
        ))}
      </Rows>
      {warning ? <Note>Warning. {warning}</Note> : null}
    </Page>
  );
}

export function ChooseTask({ onBack }: PreviewProps) {
  const kinds = [
    [
      "Check a web page",
      "Pay a provider to check that a page loads, has the right title and accepts its form. Up to 10 minutes.",
    ],
    [
      "Move vault funds",
      "Deposit into or redeem from the demo vault. You set the most; the agent picks the amount.",
    ],
    [
      "Scheduled payment",
      "Pay one recipient a fixed amount on a fixed schedule. Missed payments are not caught up.",
    ],
    [
      "Standing allowance",
      "Let the agent buy checks from approved providers, up to a daily or weekly limit, for up to 30 days.",
    ],
  ] as const;
  return (
    <Page
      title="New task"
      subtitle="Pick what the agent may do. You set every limit."
      onBack={onBack}
    >
      <Rows>
        {kinds.map(([label, detail]) => (
          <Row key={label} label={label} detail={detail} onPress={() => {}} />
        ))}
      </Rows>
    </Page>
  );
}

export function WebPageForm({ onBack }: PreviewProps) {
  const [target, setTarget] = useState<"healthy" | "broken">("healthy");
  return (
    <Page
      title="Check a web page"
      onBack={onBack}
      footer={<PrimaryButton label="Review task" />}
    >
      <Segmented
        label="Page"
        options={[
          { key: "healthy", label: "Healthy checkout" },
          { key: "broken", label: "Broken checkout" },
        ]}
        selected={target}
        onSelect={setTarget}
      />
      <Heading>Checks, in this order</Heading>
      <Rows>
        <Row label="Page loads" value="On" />
        <Row label="Title is right" value="On" />
        <Row label="Form submits" value="On" />
      </Rows>
      <Heading>Providers, tried in order</Heading>
      <Rows>
        <Row label="Tessel Checks" detail="0.40 a check" value="On" />
        <Row label="Northgate Probes" detail="0.55 a check" value="On" />
        <Row label="Paid tries" detail="At most 3" value="3" />
      </Rows>
      <Row label="Most this can spend" value="3.00 DUSD" />
    </Page>
  );
}

export function VaultForm({ onBack }: PreviewProps) {
  const [command, setCommand] = useState<"deposit" | "redeem">("deposit");
  return (
    <Page
      title="Move vault funds"
      onBack={onBack}
      footer={<PrimaryButton label="Review task" />}
    >
      <Rows>
        <Row
          label="Vault"
          detail="Demo vault, DemoUSD"
          value="0x8426…435a"
          mono
        />
      </Rows>
      <Segmented
        label="Direction"
        options={[
          { key: "deposit", label: "Deposit" },
          { key: "redeem", label: "Redeem" },
        ]}
        selected={command}
        onSelect={setCommand}
      />
      <BigAmount value="20.00" unit="DUSD, the most the agent may move" />
      <Rows>
        <Row
          label="Price movement limit"
          detail="Fixed by the plan"
          value="0.5%"
        />
        <Row
          label="Price must be fresher than"
          detail="Source: demo risk feed"
          value="60 seconds"
        />
      </Rows>
      <Note>
        Amounts are in DemoUSD, not vault shares. The vault can switch
        redemptions off, so money is not promised back instantly.
      </Note>
    </Page>
  );
}

export function ScheduleForm({ onBack }: PreviewProps) {
  return (
    <Page
      title="Scheduled payment"
      onBack={onBack}
      footer={<PrimaryButton label="Review task" />}
    >
      <Rows>
        <Row label="Pay to" value="Mara Okafor" onPress={() => {}} />
        <Row label="Amount each time" value="4.00 DUSD" onPress={() => {}} />
        <Row label="Starts" value="Fri 23 Oct, 09:00" onPress={() => {}} />
        <Row label="Repeats" value="Every week" onPress={() => {}} />
        <Row label="Number of payments" value="4" />
      </Rows>
      <Row label="Most this can pay" value="16.00 DUSD" />
      <Note>
        4 payments of 4.00. A payment that is missed is skipped, never paid
        later.
      </Note>
    </Page>
  );
}

export function AllowanceForm({ onBack }: PreviewProps) {
  const [period, setPeriod] = useState<"day" | "week">("day");
  return (
    <Page
      title="Standing allowance"
      onBack={onBack}
      footer={<PrimaryButton label="Review allowance" />}
    >
      <Rows>
        <Row
          label="Providers"
          detail="Tessel Checks, Northgate Probes"
          onPress={() => {}}
        />
        <Row
          label="Checks allowed"
          detail="Page load, title, form"
          onPress={() => {}}
        />
      </Rows>
      <Segmented
        label="Limit period"
        options={[
          { key: "day", label: "Each day" },
          { key: "week", label: "Each week" },
        ]}
        selected={period}
        onSelect={setPeriod}
      />
      <Rows>
        <Row label={`Limit each ${period}`} value="4.00 DUSD" />
        <Row label="Most per payment" value="1.00 DUSD" />
        <Row label={`Payments each ${period}`} value="At most 20" />
        <Row label="Lasts" value="7 days, to 26 Oct" />
      </Rows>
      <Note>
        An allowance can last up to 30 days. Each purchase is quoted, checked
        and recorded like a one-off task.
      </Note>
    </Page>
  );
}

export function AllowanceApproval({ onBack }: PreviewProps) {
  return (
    <Page
      title="Standing allowance"
      subtitle="The agent may buy page checks from two providers, up to 4.00 a day, until 26 Oct 18:00."
      onBack={onBack}
      footer={<GhostButton label="Decline" />}
    >
      <Rows>
        <Row label="Most per payment" value="1.00 DUSD" />
        <Row label="Can pay" value="Tessel Checks, Northgate Probes" />
        <Row label="Most in total" value="28.00 DUSD" />
      </Rows>
      <Note>
        You can pause it at any time, even when the Mandate service is offline.
      </Note>
      <HoldToSeal label="Press and hold to seal" />
    </Page>
  );
}

export function WalletLimits({ onBack }: PreviewProps) {
  return (
    <Page
      title="Wallet limits"
      subtitle="The tightest rule wins. Each limit must not be below the one before it."
      onBack={onBack}
      footer={<PrimaryButton label="Review changes" />}
    >
      <Heading>DemoUSD</Heading>
      <Rows>
        <Row label="Per payment" value="2.00" onPress={() => {}} />
        <Row label="Each day" value="20.00" onPress={() => {}} />
        <Row
          label="Each week"
          detail="At least each day"
          value="60.00"
          onPress={() => {}}
        />
        <Row
          label="Ask me first above"
          detail="Needs your approval per payment"
          value="1.50"
          onPress={() => {}}
        />
      </Rows>
      <Heading>Allowed recipients</Heading>
      <Rows>
        <Row label="Tessel Checks" detail="0xB7d0…3e51" />
        <Row label="Northgate Probes" detail="0x5C2a…91Fd" />
      </Rows>
      <Row label="Blocked recipients" value="None" onPress={() => {}} />
    </Page>
  );
}

export function LimitsBeforeSigning({ onBack }: PreviewProps) {
  return (
    <Page
      title="Before you sign"
      onBack={onBack}
      footer={
        <>
          <PrimaryButton label="Sign limits" />
          <GhostButton label="Go back" />
        </>
      }
    >
      <Rows>
        <Row
          label="The allowed list is now empty"
          detail="With no allowed recipients, the list stops filtering. Any recipient is allowed unless blocked."
        />
        <Row
          label="1 payment approval ends"
          detail="Tessel Checks 0.40, signed 14:49, not yet settled."
        />
        <Row
          label="Takes effect when it is on the chain"
          detail="Signed at 14:57, valid for 30 minutes."
        />
      </Rows>
    </Page>
  );
}

export interface ProviderSummary {
  name: string;
  detail: string;
  record: string;
}

export function Providers({
  onBack,
  providers,
}: PreviewProps & { providers: readonly ProviderSummary[] }) {
  return (
    <Page
      title="Providers"
      subtitle="Who your agents can pay for page checks. This list comes from the Mandate deployment."
      onBack={onBack}
    >
      <Rows>
        {providers.map((p) => (
          <Row
            key={p.name}
            label={p.name}
            detail={`${p.detail}. ${p.record}`}
            onPress={() => {}}
          />
        ))}
      </Rows>
      <Note>
        More providers appear when they are added to the deployment. Mandate
        does not rank them: the record shows what was delivered.
      </Note>
    </Page>
  );
}

export function ProviderDetail({ onBack }: PreviewProps) {
  return (
    <Page
      title="Tessel Checks"
      onBack={onBack}
      footer={<GhostButton label="Manage in Wallet limits" />}
    >
      <Row label="Address" value="0xB7d0…3e51" mono />
      <Heading>Checks</Heading>
      <Rows>
        <Row label="Page loads" value="0.40" />
        <Row label="Title is right" value="0.40" />
        <Row label="Form submits" value="0.40" />
      </Rows>
      <Heading>Delivered</Heading>
      <Rows>
        <Row
          label="Healthy checkout"
          detail="Today 14:49, all 3 checks passed"
        />
        <Row
          label="Broken checkout"
          detail="Yesterday, form did not submit. A valid result."
        />
      </Rows>
    </Page>
  );
}
