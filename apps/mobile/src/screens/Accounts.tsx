import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PrimaryButton } from "../components/Button";
import { SectionHeading, Note, Row, Rows, Voice } from "../components/blocks";
import { Frame } from "../components/Page";
import { statusLabel } from "../components/StatusTag";
import type { Capability } from "../config/capabilities";
import type { RootStackParamList } from "../navigation/RootNavigator";

// Account switcher preview. Accounts are derived from the wallet's recovery
// phrase, and no wallet exists on this phone yet, so the list is empty and
// adding or renaming is not available. Nothing here invents an account.

type Props = NativeStackScreenProps<RootStackParamList, "Accounts">;

const HOW_ACCOUNTS_WORK = [
  "One recovery phrase gives you up to 20 accounts, each with its own address.",
  "Each account has its own agent wallet and its own sign-in. Agents never move between accounts.",
  "Switching accounts clears everything the previous account was showing.",
  "Account names are stored only on this phone. Restoring from your phrase does not bring them back.",
  "After a restore you see your first 5 accounts and can reveal more. An empty account does not prove that later ones are empty.",
] as const;

const ACCOUNT_ACTIONS: readonly Capability[] = [
  {
    id: "add-account",
    title: "Add account",
    detail: "Adds the next account from your recovery phrase.",
    icon: "account-plus-outline",
    tone: "blue",
    state: "notBuilt",
  },
  {
    id: "rename-account",
    title: "Rename account",
    detail: "Gives an account a name only you see.",
    icon: "pencil-outline",
    tone: "violet",
    state: "notBuilt",
  },
];

export function AccountsScreen({ navigation }: Props) {
  return (
    <Frame
      title="Accounts"
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton
          label="Set up a wallet"
          accessibilityHint="Shows the wallet setup options"
          onPress={() => navigation.navigate("Setup")}
        />
      }
    >
      <Voice>No accounts on this phone.</Voice>
      <Note>
        Accounts appear after you create or restore a wallet. Neither is
        available in this build.
      </Note>
      <SectionHeading>How accounts work</SectionHeading>
      <Rows>
        {HOW_ACCOUNTS_WORK.map((text) => (
          <Row key={text} label={text} />
        ))}
      </Rows>
      <SectionHeading>Account actions</SectionHeading>
      <Rows>
        {ACCOUNT_ACTIONS.map((a) => (
          <Row
            key={a.id}
            label={a.title}
            detail={a.detail}
            value={statusLabel(a.state)}
          />
        ))}
      </Rows>
    </Frame>
  );
}
