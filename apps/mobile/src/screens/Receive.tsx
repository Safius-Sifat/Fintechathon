import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Share, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { PrimaryButton } from "../components/Button";
import { GhostButton, Note } from "../components/blocks";
import { Frame } from "../components/Page";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fonts, makeStyles, radius, space, type } from "../theme";
import { currentAccount, useWallet } from "../wallet/session";

type Props = NativeStackScreenProps<RootStackParamList, "Receive">;

// The current account's address as a QR code. Agents sign with a separate
// key that is never a receiving address, so it is never shown here.
export function ReceiveScreen({ navigation }: Props) {
  const styles = useStyles();
  useWallet();
  const account = currentAccount();
  const [copied, setCopied] = useState(false);
  if (!account) return null;
  const copy = async () => {
    await Clipboard.setStringAsync(account.address);
    setCopied(true);
  };
  return (
    <Frame
      title="Receive"
      onBack={() => navigation.goBack()}
      footer={
        <View style={styles.pair}>
          <View style={styles.half}>
            <PrimaryButton
              label={copied ? "Copied" : "Copy"}
              icon="content-copy"
              onPress={copy}
            />
          </View>
          <View style={styles.half}>
            <GhostButton
              label="Share"
              onPress={() => Share.share({ message: account.address })}
            />
          </View>
        </View>
      }
    >
      <View style={styles.center}>
        <View
          style={styles.qr}
          accessible
          accessibilityLabel={`QR code for ${account.address}`}
        >
          <QRCode
            value={`ethereum:${account.address}@${network.chainId}`}
            size={240}
          />
        </View>
        <Text style={styles.name}>{account.label}</Text>
        <Text style={styles.address} selectable>
          {account.address}
        </Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{network.name}</Text>
        </View>
        <Text style={styles.note}>
          Only send test funds on {network.name} to this address. Anything else
          may be lost.
        </Text>
        <Note>DemoUSD, USDC and test ETH all arrive at this same address.</Note>
      </View>
    </Frame>
  );
}

const useStyles = makeStyles((colors) => ({
  center: { alignItems: "center", gap: space.lg },
  qr: {
    padding: space.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: "#FFFFFF",
  },
  name: { ...type.title, color: colors.ink, textAlign: "center" },
  address: {
    ...type.body,
    fontFamily: fonts.mono,
    color: colors.ink2,
    textAlign: "center",
  },
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
