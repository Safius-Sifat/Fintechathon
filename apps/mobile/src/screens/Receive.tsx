import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Text, View } from "react-native";
import { PrimaryButton } from "../components/Button";
import { Chips, GhostButton, Note } from "../components/blocks";
import { Icon } from "../components/Icon";
import { Frame } from "../components/Page";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fonts, makeStyles, radius, space, type, useColors } from "../theme";

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

export function ReceiveScreen({ navigation }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [asset, setAsset] = useState<Asset>("DemoUSD");
  return (
    <Frame
      title="Receive"
      onBack={() => navigation.goBack()}
      footer={
        <View style={styles.pair}>
          <View style={styles.half}>
            <PrimaryButton label="Copy" icon="content-copy" disabled />
          </View>
          <View style={styles.half}>
            <GhostButton label="Share" disabled />
          </View>
        </View>
      }
    >
      <View style={styles.center}>
        <Chips
          options={[
            { key: "DemoUSD", label: "DemoUSD" },
            { key: "ETH", label: "ETH" },
          ]}
          selected={asset}
          onSelect={setAsset}
        />
        <View
          style={styles.qrFrame}
          accessible
          accessibilityLabel="No QR code. This account has no address yet."
        >
          <Icon name="qrcode-remove" size={56} color={colors.ink3} />
          <Text style={styles.qrTitle}>No address yet</Text>
          <Text style={styles.qrText}>
            A QR code appears here once this account has an address.
          </Text>
        </View>
        <Text style={styles.name}>No account yet</Text>
        <Text style={styles.address}>Address not created</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{network.name}</Text>
        </View>
        <Text style={styles.note}>
          Only send test funds on {network.name} to this address. Anything else
          may be lost.
        </Text>
        <Note>{ASSET_NOTES[asset]}</Note>
        <Note>
          Agents sign with a separate key. That key is never a receiving
          address, so Mandate never shows it here.
        </Note>
      </View>
    </Frame>
  );
}

const useStyles = makeStyles((colors) => ({
  center: { alignItems: "center", gap: space.lg },
  qrFrame: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 250,
    padding: space.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.raised,
  },
  qrTitle: { ...type.heading, color: colors.ink2, textAlign: "center" },
  qrText: { ...type.small, color: colors.ink2, textAlign: "center" },
  name: { ...type.title, color: colors.ink, textAlign: "center" },
  address: { ...type.body, fontFamily: fonts.mono, color: colors.ink2 },
  pill: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  pillText: { ...type.body, color: colors.ink },
  note: { ...type.body, color: colors.ink2, textAlign: "center" },
  pair: { flexDirection: "row", gap: space.md },
  half: { flex: 1 },
}));
