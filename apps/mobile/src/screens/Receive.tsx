import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { Icon, type IconName } from "../components/Icon";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, space, type } from "../theme";

// Receive preview. A receiving address comes from an account on this phone,
// and none exists yet, so there is no address and no QR code. Mandate never
// draws a code for an address it does not have.

type Props = NativeStackScreenProps<RootStackParamList, "Receive">;

type Asset = "ETH" | "DemoUSD";

const ASSET_NOTES: Record<Asset, string> = {
  ETH: "Test ETH is Base Sepolia's own coin. Your account also needs it to pay network fees.",
  DemoUSD:
    "DemoUSD is Mandate's test token (ERC-20) on Base Sepolia. Agents use it for payments.",
};

const NOTES: readonly { icon: IconName; text: string }[] = [
  {
    icon: "access-point-network",
    text: `Send only on ${network.name} (chain ${network.chainId}). Funds sent on another network can be lost.`,
  },
  {
    icon: "flask-outline",
    text: "Use test funds only. Nothing on this network is real money.",
  },
  {
    icon: "robot-outline",
    text: "Agents sign with a separate key. That key is never a receiving address, so Mandate never shows it here.",
  },
];

export function ReceiveScreen({ navigation }: Props) {
  const [asset, setAsset] = useState<Asset>("ETH");
  return (
    <Screen
      title="Receive"
      subtitle={`Get test funds into an account on ${network.name}.`}
      onBack={() => navigation.goBack()}
    >
      <Card>
        <Text style={styles.cardTitle} accessibilityRole="header">
          Receiving to
        </Text>
        <DetailRow label="Account" value="No account yet" muted />
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
        <Segmented
          label="Wallet"
          options={[
            { key: "personal", label: "Personal account" },
            {
              key: "agent",
              label: "Agent wallet",
              detail: "Not connected",
              disabled: true,
            },
          ]}
          selected="personal"
          onSelect={() => {}}
        />
        <Segmented
          label="Asset"
          options={[
            { key: "ETH", label: "ETH" },
            { key: "DemoUSD", label: "DemoUSD" },
          ]}
          selected={asset}
          onSelect={setAsset}
        />
        <Text style={styles.caption}>{ASSET_NOTES[asset]}</Text>
      </Card>

      <Card>
        <View
          style={styles.qrFrame}
          accessible
          accessibilityLabel="No QR code. This account has no address yet."
        >
          <Icon name="qrcode-remove" size={48} color={colors.textSubtle} />
          <Text style={styles.qrTitle}>No address yet</Text>
          <Text style={styles.qrText}>
            A QR code appears here once this account has an address.
          </Text>
        </View>
        <DetailRow label="Address" value="Not created" muted />
        <View style={styles.actions}>
          <OutlineButton
            label="Copy"
            icon="content-copy"
            disabled
            accessibilityHint="Unavailable. There is no address to copy."
          />
          <OutlineButton
            label="Share"
            icon="share-variant-outline"
            disabled
            accessibilityHint="Unavailable. There is no address to share."
          />
        </View>
      </Card>

      <SectionTitle>Before anyone sends funds</SectionTitle>
      <Card>
        {NOTES.map((note) => (
          <View key={note.icon} style={styles.note}>
            <Icon name={note.icon} size={20} color={colors.textMuted} />
            <Text style={styles.noteText}>{note.text}</Text>
          </View>
        ))}
      </Card>

      <Banner
        icon="information-outline"
        title="Not available in this build"
        body="Receiving needs an account on this phone. Creating and restoring a wallet come in a later milestone."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },

  qrFrame: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 220,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(15, 23, 42, 0.14)",
  },
  qrTitle: { ...type.heading, color: colors.textMuted, textAlign: "center" },
  qrText: { ...type.small, color: colors.textMuted, textAlign: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },

  note: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  noteText: { ...type.body, color: colors.text, flex: 1 },
});
