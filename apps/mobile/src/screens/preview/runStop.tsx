import { PrimaryButton } from "../../components/Button";
import {
  BigAmount,
  GhostButton,
  Heading,
  HoldToSeal,
  Note,
  Row,
  Rows,
  Steps,
  Voice,
  type StepItem,
} from "../../components/blocks";
import { Banner } from "../../components/Banner";
import { Page } from "../../components/Page";
import type { PreviewProps } from "./agentSetup";

// Run and stop screens (design pass 3). Stopping is shown as pending until the
// chain confirms it; signing out is stated to stop nothing.

export function TaskRunning({
  onBack,
  steps,
}: PreviewProps & { steps: readonly StepItem[] }) {
  return (
    <Page
      title="Checking the checkout"
      subtitle="Running. You can close the app."
      onBack={onBack}
      footer={<GhostButton label="Stop agent" />}
    >
      <Steps items={steps} />
      <Row label="Spent or held so far" value="0.40 of 3.00" />
    </Page>
  );
}

export function WhyAgentChose({ onBack }: PreviewProps) {
  return (
    <Page
      title="Why Tessel Checks"
      subtitle="The agent's choice. You cannot change it, only stop the agent."
      onBack={onBack}
    >
      <Heading>Quotes it compared</Heading>
      <Rows>
        <Row
          label="Tessel Checks"
          detail="All 3 checks. 8 of 8 delivered"
          value="0.40"
        />
        <Row
          label="Northgate Probes"
          detail="All 3 checks. 7 of 8 delivered"
          value="0.55"
        />
      </Rows>
      <Heading>Its reason</Heading>
      <Voice>
        Both cover every check you asked for. Tessel is cheaper and has
        delivered every time.
      </Voice>
      <Note>
        Written by the agent. The price and the limits were checked separately,
        by rules the agent cannot change.
      </Note>
    </Page>
  );
}

export function ApprovePayment({ onBack }: PreviewProps) {
  return (
    <Page
      title="Approve a payment"
      subtitle="The agent wants to pay 1.80 to Northgate Probes. That is above your 1.50 approval limit."
      onBack={onBack}
      footer={<GhostButton label="Decline" />}
    >
      <HoldToSeal label="Press and hold to approve" />
      <BigAmount value="1.80" unit="DUSD" />
      <Rows>
        <Row label="To" value="Northgate Probes" />
        <Row label="For" value="Page checks, task 3 of 5" />
        <Row label="Expires" value="in 14:20" />
      </Rows>
      <Note>
        If you do nothing, the payment is not made and the agent is told.
      </Note>
    </Page>
  );
}

export function AgentNeedsYou({ onBack }: PreviewProps) {
  return (
    <Page
      title="The agent needs you"
      subtitle="Checking the checkout, paused"
      onBack={onBack}
      footer={
        <>
          <PrimaryButton label="Review new task" />
          <GhostButton label="End task" />
        </>
      }
    >
      <Voice>
        Both providers now charge more than this task allows. A third try would
        cost 0.60 more.
      </Voice>
      <Heading>What it is asking for</Heading>
      <Rows>
        <Row label="Spending limit" value="3.00 to 3.60 DUSD" />
        <Row label="Paid tries" value="3 to 4" />
      </Rows>
      <Note>
        Nothing changes until you approve a new task. Declining ends this one
        with the result so far.
      </Note>
    </Page>
  );
}

export function TaskDone({ onBack }: PreviewProps) {
  return (
    <Page
      title="Checkout check done"
      subtitle="Healthy checkout."
      onBack={onBack}
      footer={<GhostButton label="Open the proof" />}
    >
      <BigAmount value="All 3 passed" />
      <Heading>Where each part stands</Heading>
      <Rows>
        <Row
          label="Result"
          detail="Signed by Tessel, checked by the app"
          value="Valid"
        />
        <Row
          label="Payment 0.40"
          detail="On the chain, not final yet"
          value="Included"
        />
        <Row
          label="Permission"
          detail="Ends when the close is on the chain"
          value="Closing"
        />
      </Rows>
    </Page>
  );
}

export function AgentHome({
  onBack,
  alert,
  tasks,
}: PreviewProps & {
  alert?: string;
  tasks: readonly { title: string; detail: string }[];
}) {
  return (
    <Page
      title="Agent wallet"
      subtitle="1 task running"
      onBack={onBack}
      footer={<GhostButton label="Stop agents" />}
    >
      {alert ? (
        <Banner icon="alert-outline" title="Risk warning" body={alert} />
      ) : null}
      <Heading>Tasks</Heading>
      <Rows>
        {tasks.map((t) => (
          <Row
            key={t.title}
            label={t.title}
            detail={t.detail}
            onPress={() => {}}
          />
        ))}
      </Rows>
    </Page>
  );
}

export function StopChoose({ onBack }: PreviewProps) {
  return (
    <Page
      title="Stop the agent"
      onBack={onBack}
      footer={<GhostButton label="Cancel" />}
    >
      <Rows>
        <Row
          label="Pause all agents"
          detail="Nothing new is paid. Resuming needs new approvals."
          onPress={() => {}}
        />
        <Row
          label="End a permission"
          detail="Cancel one task or allowance for good."
          onPress={() => {}}
        />
        <Row
          label="Freeze the wallet"
          detail="Blocks every agent payment until you unfreeze it."
          onPress={() => {}}
        />
      </Rows>
      <Note>
        These are different. Signing out of this app stops none of them.
      </Note>
    </Page>
  );
}

export function PauseReview({ onBack }: PreviewProps) {
  return (
    <Page
      title="Pause all agents"
      subtitle="You sign this on your phone. It does not need the Mandate service."
      onBack={onBack}
      footer={<GhostButton label="Cancel" />}
    >
      <Rows>
        <Row label="Applies at" value="When on the chain" />
        <Row label="Payments already sent" value="May still settle" />
        <Row label="Resume" value="New approvals needed" />
        <Row label="Valid for" value="30 minutes" />
      </Rows>
      <HoldToSeal label="Press and hold to pause" />
      <Note>
        This phone stops showing the agent as active as soon as you sign. The
        pause is real only once it is confirmed.
      </Note>
    </Page>
  );
}

export function StopPending({ onBack }: PreviewProps) {
  return (
    <Page
      title="Stopping the agents"
      subtitle="Not confirmed yet. Do not treat the agents as stopped."
      onBack={onBack}
      footer={<GhostButton label="Back to the wallet" />}
    >
      <Steps
        items={[
          {
            state: "done",
            title: "Signed on this phone",
            detail: "Shown as paused here",
          },
          {
            state: "now",
            title: "Waiting for the chain",
            detail: "Sent from your account",
          },
          {
            state: "todo",
            title: "Confirmed",
            detail: "Old approvals stop working",
          },
        ]}
      />
      <Banner
        icon="alert-outline"
        title="Earlier payments"
        body="A payment sent before this may still settle. It will show in Activity."
      />
    </Page>
  );
}

export function StopConfirmed({ onBack }: PreviewProps) {
  return (
    <Page
      title="Agents paused"
      subtitle="Confirmed on the chain, block 48,301,266"
      onBack={onBack}
      footer={
        <>
          <PrimaryButton label="New task" />
          <GhostButton label="See Activity" />
        </>
      }
    >
      <Heading>What happened</Heading>
      <Rows>
        <Row label="Old approvals" value="Stopped" />
        <Row label="Payments before the pause" value="1 settled, 0.40" />
        <Row label="Task in progress" value="Ended, no result" />
        <Row label="Funds" value="Still in the wallet" />
      </Rows>
      <Note>
        To use the agent again, approve a new task. Old tasks do not restart.
      </Note>
    </Page>
  );
}

export function FreezeWallet({ onBack }: PreviewProps) {
  return (
    <Page
      title="Freeze the agent wallet?"
      onBack={onBack}
      footer={
        <>
          <PrimaryButton label="Sign freeze" />
          <GhostButton label="Cancel" />
        </>
      }
    >
      <Rows>
        <Row
          label="No agent payments"
          detail="Nothing leaves the agent wallet, even inside a limit."
        />
        <Row
          label="Your account is not affected"
          detail="Only the agent wallet is frozen."
        />
        <Row
          label="Funds stay put"
          detail="Approvals are kept, but cannot be used."
        />
        <Row label="Only you can lift it" detail="Unfreeze here at any time." />
      </Rows>
    </Page>
  );
}

export function StopOffline({ onBack }: PreviewProps) {
  return (
    <Page
      title="Stop from this phone"
      onBack={onBack}
      footer={<PrimaryButton label="Review pause" />}
    >
      <Banner
        icon="cloud-off-outline"
        title="Service unreachable"
        body="The Mandate service cannot be reached. Stopping still works."
      />
      <Heading>Read directly from the chain</Heading>
      <Rows>
        <Row label="Wallet" value="0x2Bd9…71aF" mono />
        <Row label="State" value="Active" />
        <Row label="Block" value="48,301,266" />
      </Rows>
      <Note>
        The network fee comes from your own ETH. Nothing is sent to the Mandate
        service.
      </Note>
    </Page>
  );
}

export function SignOutSheet({ onBack }: PreviewProps) {
  return (
    <Page
      title="Sign out of this phone?"
      onBack={onBack}
      footer={
        <>
          <PrimaryButton label="Sign out" />
          <GhostButton label="Stop agents first" />
        </>
      }
    >
      <Rows>
        <Row
          label="Agents may keep working"
          detail="Signing out ends your app session only. Approved tasks continue."
        />
        <Row
          label="Your wallet stays on this phone"
          detail="Your recovery phrase is not erased."
        />
      </Rows>
    </Page>
  );
}
