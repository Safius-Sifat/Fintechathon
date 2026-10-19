import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { Icon, type IconName } from "../components/Icon";
import { Screen } from "../components/Screen";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, space, touchTarget, type } from "../theme";

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
              disabledReason: "Not connected",
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
          onSelect={(key) => setAsset(key as Asset)}
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

interface SegmentOption {
  key: string;
  label: string;
  // Shown under the option, which cannot be selected.
  disabledReason?: string;
}

interface SegmentedProps {
  label: string;
  options: readonly SegmentOption[];
  selected: string;
  onSelect: (key: string) => void;
}

function Segmented({ label, options, selected, onSelect }: SegmentedProps) {
  return (
    <View style={styles.segmentBlock}>
      <Text style={styles.segmentLabel}>{label}</Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {options.map((option) => {
          const isSelected = option.key === selected;
          const disabled = option.disabledReason !== undefined;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityHint={option.disabledReason}
              disabled={disabled}
              onPress={() => onSelect(option.key)}
              style={[styles.segmentItem, isSelected && styles.segmentSelected]}
            >
              <Text
                style={[
                  styles.segmentText,
                  isSelected && styles.segmentTextSelected,
                  disabled && styles.segmentTextDisabled,
                ]}
              >
                {option.label}
              </Text>
              {option.disabledReason ? (
                <Text style={styles.segmentReason}>
                  {option.disabledReason}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },

  segmentBlock: { gap: space.xs },
  segmentLabel: { ...type.label, color: colors.textMuted },
  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  segmentItem: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 120,
    minHeight: touchTarget - space.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    boxShadow: "0px 1px 4px rgba(15, 23, 42, 0.10)",
  },
  segmentText: {
    ...type.bodyStrong,
    color: colors.textMuted,
    textAlign: "center",
  },
  segmentTextSelected: { color: colors.ink },
  segmentTextDisabled: { color: colors.textDisabled },
  segmentReason: {
    ...type.small,
    color: colors.textDisabled,
    textAlign: "center",
  },

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
