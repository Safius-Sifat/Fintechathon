import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReactElement } from "react";
import { Banner } from "../../components/Banner";
import { Row, Rows } from "../../components/blocks";
import { Page } from "../../components/Page";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import * as A from "./agentSetup";
import * as P from "./proof";
import * as R from "./runStop";
import * as W from "./walletExtras";

// Design preview. Development builds only: every screen here shows labelled
// sample data so the layouts can be reviewed. None of it is wired to a wallet,
// the service or a signer, and the route does not exist in release builds.

const quotes = [
  {
    state: "done",
    title: "Two quotes received",
    detail: "Tessel 0.40, Northgate 0.55",
  },
  {
    state: "done",
    title: "Agent chose Tessel Checks",
    detail: "Lowest price with all three checks",
  },
  {
    state: "now",
    title: "Paying 0.40 DUSD",
    detail: "Sent. Waiting for the chain",
  },
  {
    state: "todo",
    title: "Result from the provider",
    detail: "Signed, then checked by the app",
  },
  { state: "todo", title: "Close the task" },
] as const;

const findings: readonly P.FindingView[] = [
  {
    name: "Integrity",
    state: "PASS",
    reason: "The record is unbroken, 14 events.",
  },
  {
    name: "Authority",
    state: "PASS",
    reason: "You signed this task. The agent key matches.",
  },
  {
    name: "Policy",
    state: "PASS",
    reason: "Every payment was inside your limits.",
  },
  {
    name: "Settlement",
    state: "PASS",
    reason: "0.40 left the wallet once, to Tessel.",
  },
  {
    name: "Delivery",
    state: "PASS",
    reason: "The provider's signed result was checked.",
  },
  {
    name: "Completion",
    state: "UNVERIFIABLE",
    reason: "Only the service says the agent finished.",
  },
];

const pending: readonly P.FindingView[] = findings.map((f, i) =>
  i < 3 ? f : { ...f, state: "PENDING", reason: "Not yet." },
);

type Make = (back: () => void) => ReactElement;

export const previews: Record<
  string,
  { group: string; title: string; make: Make }
> = {
  lock: {
    group: "Wallet",
    title: "Lock",
    make: (b) => <W.LockScreen onBack={b} />,
  },
  backup: {
    group: "Wallet",
    title: "Recovery backup",
    make: (b) => <W.BackupStatus onBack={b} backedUp={false} />,
  },
  contacts: {
    group: "Wallet",
    title: "Contacts",
    make: (b) => (
      <W.Contacts
        onBack={b}
        contacts={[
          { name: "Mara Okafor", address: "0xD512…08ac" },
          { name: "Tessel Checks", address: "0xB7d0…3e51" },
        ]}
      />
    ),
  },
  txdetail: {
    group: "Wallet",
    title: "Transaction detail",
    make: (b) => <W.TransactionDetail onBack={b} />,
  },
  network: {
    group: "Wallet",
    title: "Network",
    make: (b) => <W.NetworkInfo onBack={b} />,
  },
  help: { group: "Wallet", title: "Help", make: (b) => <W.Help onBack={b} /> },

  agentIntro: {
    group: "Start an agent",
    title: "Create an agent wallet",
    make: (b) => <A.AgentIntro onBack={b} />,
  },
  provisioning: {
    group: "Start an agent",
    title: "Setting up",
    make: (b) => <A.Provisioning onBack={b} />,
  },
  walletReady: {
    group: "Start an agent",
    title: "Agent wallet, not funded",
    make: (b) => (
      <A.AgentWallet onBack={b} address="0x2Bd9…71aF" balances={null} />
    ),
  },
  fund: {
    group: "Start an agent",
    title: "Fund the agent wallet",
    make: (b) => <A.FundAgent onBack={b} />,
  },
  walletFunded: {
    group: "Start an agent",
    title: "Agent wallet, funded",
    make: (b) => (
      <A.AgentWallet
        onBack={b}
        address="0x2Bd9…71aF"
        balances={{
          spendable: "39.05",
          liquid: "49.05",
          floor: "10.00",
          reserved: "0.40",
          asOfBlock: "48,301,220",
        }}
      />
    ),
  },
  compose: {
    group: "Start an agent",
    title: "Describe the task",
    make: (b) => <A.ComposeTask onBack={b} />,
  },
  review: {
    group: "Start an agent",
    title: "Check the draft",
    make: (b) => (
      <A.IntentReview
        onBack={b}
        goal="Check that the demo shop checkout works: load, title and form."
        warning='The draft added form submit, because you said "accept the form".'
        terms={[
          { label: "Task", value: "Check a web page" },
          { label: "Page", value: "Healthy checkout" },
          { label: "Checks", value: "Page load, title, form" },
          { label: "Providers", value: "Tessel, then Northgate" },
          { label: "Most spent", value: "3.00 DUSD, 1.00 each" },
          { label: "Limits", value: "3 paid tries, 10 minutes" },
        ]}
      />
    ),
  },
  chooser: {
    group: "Start an agent",
    title: "New task",
    make: (b) => <A.ChooseTask onBack={b} />,
  },
  formWeb: {
    group: "Start an agent",
    title: "Form: web page",
    make: (b) => <A.WebPageForm onBack={b} />,
  },
  formVault: {
    group: "Start an agent",
    title: "Form: vault",
    make: (b) => <A.VaultForm onBack={b} />,
  },
  formSchedule: {
    group: "Start an agent",
    title: "Form: schedule",
    make: (b) => <A.ScheduleForm onBack={b} />,
  },
  formAllowance: {
    group: "Start an agent",
    title: "Form: allowance",
    make: (b) => <A.AllowanceForm onBack={b} />,
  },
  allowanceApproval: {
    group: "Start an agent",
    title: "Allowance approval",
    make: (b) => <A.AllowanceApproval onBack={b} />,
  },
  limits: {
    group: "Start an agent",
    title: "Wallet limits",
    make: (b) => <A.WalletLimits onBack={b} />,
  },
  limitsSign: {
    group: "Start an agent",
    title: "Limits, before signing",
    make: (b) => <A.LimitsBeforeSigning onBack={b} />,
  },
  providers: {
    group: "Start an agent",
    title: "Providers",
    make: (b) => (
      <A.Providers
        onBack={b}
        providers={[
          {
            name: "Tessel Checks",
            detail: "Page load, title, form. 0.40 a check",
            record: "8 of 8 delivered",
          },
          {
            name: "Northgate Probes",
            detail: "Page load, title, form. 0.55 a check",
            record: "7 of 8 delivered",
          },
        ]}
      />
    ),
  },
  providerDetail: {
    group: "Start an agent",
    title: "Provider detail",
    make: (b) => <A.ProviderDetail onBack={b} />,
  },

  running: {
    group: "Run and stop",
    title: "Task running",
    make: (b) => <R.TaskRunning onBack={b} steps={quotes} />,
  },
  why: {
    group: "Run and stop",
    title: "Why the agent chose",
    make: (b) => <R.WhyAgentChose onBack={b} />,
  },
  approve: {
    group: "Run and stop",
    title: "Approve a payment",
    make: (b) => <R.ApprovePayment onBack={b} />,
  },
  needsYou: {
    group: "Run and stop",
    title: "The agent needs you",
    make: (b) => <R.AgentNeedsYou onBack={b} />,
  },
  done: {
    group: "Run and stop",
    title: "Task done",
    make: (b) => <R.TaskDone onBack={b} />,
  },
  agentHome: {
    group: "Run and stop",
    title: "Agent home with alert",
    make: (b) => (
      <R.AgentHome
        onBack={b}
        alert="The risk feed shows a warning. Vault moves are on hold. Page checks continue."
        tasks={[
          { title: "Checking the checkout", detail: "Running. 0.40 of 3.00" },
          {
            title: "Standing allowance",
            detail: "Waiting. 4.00 a day, to 26 Oct",
          },
        ]}
      />
    ),
  },
  stopChoose: {
    group: "Run and stop",
    title: "Stop choices",
    make: (b) => <R.StopChoose onBack={b} />,
  },
  pauseReview: {
    group: "Run and stop",
    title: "Pause review",
    make: (b) => <R.PauseReview onBack={b} />,
  },
  stopPending: {
    group: "Run and stop",
    title: "Stop pending",
    make: (b) => <R.StopPending onBack={b} />,
  },
  stopDone: {
    group: "Run and stop",
    title: "Stop confirmed",
    make: (b) => <R.StopConfirmed onBack={b} />,
  },
  freeze: {
    group: "Run and stop",
    title: "Freeze",
    make: (b) => <R.FreezeWallet onBack={b} />,
  },
  stopOffline: {
    group: "Run and stop",
    title: "Stop offline",
    make: (b) => <R.StopOffline onBack={b} />,
  },
  signOut: {
    group: "Run and stop",
    title: "Sign out",
    make: (b) => <R.SignOutSheet onBack={b} />,
  },

  activity: {
    group: "Proof",
    title: "Activity, who",
    make: (b) => (
      <P.ActivityWho
        onBack={b}
        today={[
          {
            title: "Page check, Tessel",
            detail: "Checking the checkout. Included",
            amount: "−0.40",
            who: "Agent",
          },
          {
            title: "Moved to agent wallet",
            detail: "From your account. Confirmed",
            amount: "−50.00",
            who: "You",
          },
        ]}
      />
    ),
  },
  agentPay: {
    group: "Proof",
    title: "Agent payment",
    make: (b) => <P.AgentPaymentDetail onBack={b} />,
  },
  ownerTransfer: {
    group: "Proof",
    title: "Owner transfer",
    make: (b) => <P.OwnerTransferDetail onBack={b} />,
  },
  proof: {
    group: "Proof",
    title: "Proof",
    make: (b) => (
      <P.Proof
        onBack={b}
        findings={findings}
        source="Checking the checkout. From the Mandate service."
      />
    ),
  },
  proofPending: {
    group: "Proof",
    title: "Proof, running",
    make: (b) => (
      <P.Proof
        onBack={b}
        findings={pending}
        source="Task still running."
        running
      />
    ),
  },
  findingPass: {
    group: "Proof",
    title: "Finding: passed",
    make: (b) => (
      <P.FindingDetail
        onBack={b}
        name="Settlement"
        state="Passed"
        statement="0.40 DUSD left the agent wallet once, to Tessel Checks."
        basis={["Chain", "Signature"]}
        evidence={[
          { label: "Payment", value: "0x9f2c…a41e" },
          { label: "Confirmations", value: "3" },
        ]}
      />
    ),
  },
  findingUnv: {
    group: "Proof",
    title: "Finding: not independent",
    make: (b) => (
      <P.FindingDetail
        onBack={b}
        name="Completion"
        state="Cannot be checked independently"
        statement="The service says the agent finished the task. Nothing outside the service confirms it."
        basis={["Service's own record"]}
        evidence={[]}
        note="The other five findings do not depend on it."
      />
    ),
  },
  findingFail: {
    group: "Proof",
    title: "Finding: failed",
    make: (b) => (
      <P.FindingDetail
        onBack={b}
        name="Policy"
        state="Failed"
        statement="A payment of 2.40 went above your limit of 2.00 per payment."
        basis={["Chain"]}
        evidence={[{ label: "Payment", value: "0x4a1d…09b7" }]}
        note="A failed finding is shown as it is. It is not hidden or softened."
      />
    ),
  },
  exportProof: {
    group: "Proof",
    title: "Export proof",
    make: (b) => <P.ExportProof onBack={b} />,
  },
  independent: {
    group: "Proof",
    title: "Independent check",
    make: (b) => <P.IndependentCheck onBack={b} findings={findings} />,
  },
  decisions: {
    group: "Proof",
    title: "Agent decisions",
    make: (b) => <P.AgentDecisions onBack={b} />,
  },
};

type Props = NativeStackScreenProps<RootStackParamList, "PreviewIndex">;

export function PreviewIndex({ navigation }: Props) {
  const groups = [...new Set(Object.values(previews).map((p) => p.group))];
  return (
    <Page
      title="Design preview"
      subtitle="Development builds only."
      onBack={() => navigation.goBack()}
    >
      <Banner
        icon="flask-outline"
        title="Sample data"
        body="Every screen here uses made-up values. Nothing is connected to a wallet, the service or a signer."
      />
      {groups.map((group) => (
        <Rows key={group}>
          <Row label={group} />
          {Object.entries(previews)
            .filter(([, p]) => p.group === group)
            .map(([id, p]) => (
              <Row
                key={id}
                label={p.title}
                onPress={() => navigation.navigate("Preview", { id })}
              />
            ))}
        </Rows>
      ))}
    </Page>
  );
}

export function PreviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Preview">) {
  const entry = previews[route.params.id];
  if (!entry) return null;
  return entry.make(() => navigation.goBack());
}
