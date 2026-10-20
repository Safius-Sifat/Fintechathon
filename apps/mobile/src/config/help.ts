import type { IconName } from "../components/Icon";
import type { Tone } from "../theme";

// Help (plan P3-W04 Network/Help, S8.1, S8.5). Plain-language explanations
// of how the wallet already works. No promise of a feature that is not
// built, and nothing suggests Mandate can recover your words.

export interface HelpTopic {
  id:
    | "wallets"
    | "permissions"
    | "stopping"
    | "recoveryWords"
    | "testNetwork"
    | "fees"
    | "unknown"
    | "support";
  title: string;
  icon: IconName;
  tone: Tone;
  points: readonly string[];
}

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    id: "wallets",
    title: "Your two wallets",
    icon: "wallet-outline",
    tone: "blue",
    points: [
      "Your personal account is yours alone. Its key lives on this phone and only you can spend from it.",
      "Your agent wallet is a separate contract that you own. Agents spend from it only within permissions you approve.",
      "The agent signer is the key agents use to act within those permissions. It is not an address to receive money: never send funds to it.",
      "Their balances are always shown separately and never added together.",
    ],
  },
  {
    id: "permissions",
    title: "Approving agent work",
    icon: "file-sign",
    tone: "violet",
    points: [
      "You approve each task once, with its limits, recipients and end date.",
      "Agents can then work while your phone is off, but never beyond what you approved.",
      "A task's outcome, its payments and its permission are tracked separately.",
    ],
  },
  {
    id: "stopping",
    title: "Stopping agents",
    icon: "pause-circle-outline",
    tone: "amber",
    points: [
      "Freeze stops spending for a while and keeps permissions. Pause ends every permission. Revoke ends one.",
      "Recover, Recover liquid and an owner transfer from the agent wallet also pause agents and end every permission.",
      "Each of these counts only once it is confirmed on chain.",
      "Locking the app, logging out, revoking an agent token or removing the wallet from this phone do not stop agents.",
      "If the Mandate service is down, Owner control lets you pause and recover funds yourself.",
    ],
  },
  {
    id: "recoveryWords",
    title: "Your recovery words",
    icon: "shield-key-outline",
    tone: "red",
    points: [
      "Your recovery words are the only way to restore your owner key. Keeping them safe is your responsibility.",
      "Write them down on paper and store them offline. No screenshots, cloud notes or chats.",
      "Mandate cannot recover your words. There is no server or cloud copy.",
      "Mandate will never ask for your words, passphrase or keys. Anyone who does is trying to take your funds.",
      "If you added a passphrase, you need it too. A different passphrase opens a different wallet, with no error.",
    ],
  },
  {
    id: "testNetwork",
    title: "Test network",
    icon: "flask-outline",
    tone: "slate",
    points: [
      "This wallet runs on Base Sepolia, a test network. Its ETH, DemoUSD and test USDC have no value.",
      "Do not send real funds from another network to these addresses.",
    ],
  },
  {
    id: "fees",
    title: "Network fees",
    icon: "gas-station-outline",
    tone: "green",
    points: [
      "Every transaction pays a small network fee in ETH.",
      "Your personal sends are paid from your personal account. The fee payer is shown before you sign.",
    ],
  },
  {
    id: "unknown",
    title: "When a result is unknown",
    icon: "help-circle-outline",
    tone: "amber",
    points: [
      "Unknown is not failed. The transaction may still go through.",
      "Do not send it again. Wait until the chain shows what happened.",
    ],
  },
  {
    id: "support",
    title: "Getting help",
    icon: "lifebuoy",
    tone: "blue",
    points: [
      "No support contact is set up in this preview build.",
      "Whoever helps you will never need your recovery words, passphrase or keys.",
    ],
  },
];
