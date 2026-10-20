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
  fund: {
    group: "Start an agent",
    title: "Fund the agent wallet",
    make: (b) => <A.FundAgent onBack={b} />,
  },
  compose: {
    group: "Start an agent",
    title: "Describe the task",
    make: (b) => <A.ComposeTask onBack={b} />,
  },
  chooser: {
    group: "Start an agent",
    title: "New task",
    make: (b) => <A.ChooseTask onBack={b} />,
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

  why: {
    group: "Run and stop",
    title: "Why the agent chose",
    make: (b) => <R.WhyAgentChose onBack={b} />,
  },
  needsYou: {
    group: "Run and stop",
    title: "The agent needs you",
    make: (b) => <R.AgentNeedsYou onBack={b} />,
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
