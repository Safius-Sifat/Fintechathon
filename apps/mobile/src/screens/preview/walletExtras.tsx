import { PrimaryButton } from "../../components/Button";
import {
  BigAmount,
  GhostButton,
  Note,
  Row,
  Rows,
  Voice,
} from "../../components/blocks";
import { Page } from "../../components/Page";
import { Seal } from "../../components/Seal";
import type { PreviewProps } from "./agentSetup";
import { View } from "react-native";

// Wallet screens that never touch a secret (design pass 1). The recovery
// phrase, its quiz and the passphrase live on native secure screens, not here.

export function LockScreen({ onBack }: PreviewProps) {
  return (
    <Page
      title="Mandate is locked"
      subtitle="Unlock with Face ID or your phone's screen lock."
      onBack={onBack}
      footer={<PrimaryButton label="Unlock" />}
    >
      <View style={{ alignItems: "center", paddingVertical: 24 }}>
        <Seal size={180} />
      </View>
      <Note>Locking the app does not stop approved agent work.</Note>
    </Page>
  );
}

export function BackupStatus({
  onBack,
  backedUp,
}: PreviewProps & { backedUp: boolean }) {
  return (
    <Page
      title="Recovery phrase"
      subtitle={backedUp ? "Written down and confirmed." : "Not backed up yet."}
      onBack={onBack}
      footer={<PrimaryButton label="Show on the secure screen" />}
    >
      <Rows>
        <Row label="Backup" value={backedUp ? "Confirmed" : "Not done"} />
        <Row label="Passphrase" value="Not shown here" />
      </Rows>
      <Note>
        The words appear only on a protected native screen that blocks
        screenshots. They are never shown in this app's ordinary screens.
      </Note>
    </Page>
  );
}

export interface Contact {
  name: string;
  address: string;
}

export function Contacts({
  onBack,
  contacts,
}: PreviewProps & { contacts: readonly Contact[] }) {
  return (
    <Page
      title="Contacts"
      subtitle="People you send to. Stored on this phone only."
      onBack={onBack}
      footer={<GhostButton label="Add a contact" />}
    >
      {contacts.length === 0 ? (
        <Voice>No contacts yet.</Voice>
      ) : (
        <Rows>
          {contacts.map((c) => (
            <Row
              key={c.address}
              label={c.name}
              detail={c.address}
              onPress={() => {}}
            />
          ))}
        </Rows>
      )}
    </Page>
  );
}

export function TransactionDetail({ onBack }: PreviewProps) {
  return (
    <Page
      title="Sent"
      onBack={onBack}
      footer={<GhostButton label="View on block explorer" />}
    >
      <BigAmount value="−40.00" unit="DUSD" />
      <Rows>
        <Row label="To" value="0x9f2c…c41a" mono />
        <Row label="Status" value="Pending" />
        <Row label="Network fee" value="0.000021 ETH" />
        <Row label="Network" value="Base Sepolia" />
        <Row label="Transaction" value="0x7a1e…d93c" mono />
      </Rows>
      <Note>
        Pending means it was sent but is not on the chain yet. You can speed it
        up or cancel while it is pending.
      </Note>
    </Page>
  );
}

export function NetworkInfo({ onBack }: PreviewProps) {
  return (
    <Page title="Network" onBack={onBack}>
      <Rows>
        <Row label="Network" value="Base Sepolia" />
        <Row label="Chain ID" value="84532" />
        <Row label="Kind" value="Test network. No real value." />
      </Rows>
    </Page>
  );
}

export function Help({ onBack }: PreviewProps) {
  return (
    <Page title="Help" onBack={onBack}>
      <Rows>
        <Row
          label="Where is my recovery phrase?"
          detail="Only you have it. Mandate cannot recover it."
          onPress={() => {}}
        />
        <Row
          label="Why can't I see a balance?"
          detail="Balances need a wallet on this phone and the Mandate service."
          onPress={() => {}}
        />
        <Row
          label="How do I stop an agent?"
          detail="Agents tab, then Stop agents. It works without the service."
          onPress={() => {}}
        />
      </Rows>
    </Page>
  );
}
