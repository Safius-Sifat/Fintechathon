import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow } from "../components/Card";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Token detail layout. ETH shows only protocol facts. DemoUSD's metadata
// comes from the trusted deployment manifest, which is not available yet,
// so nothing about it is shown as checked. The sample token exists only in
// development builds.

type Props = NativeStackScreenProps<RootStackParamList, "TokenDetails">;

interface TokenView {
  title: string;
  subtitle: string;
  tag: ReactNode;
  rows: readonly { label: string; value: string; muted?: boolean }[];
  sendStatus: string;
  banner?: ReactNode;
}

const STATUS_HELP =
  "Only a token in the reviewed registry, with a matching code check, can be sent. Others are watch-only. A token's name and logo are not proof that it is genuine.";

function tokenView(token: "ETH" | "DemoUSD" | "sample"): TokenView | null {
  switch (token) {
    case "ETH":
      return {
        title: "ETH",
        subtitle: "Base Sepolia's native coin",
        tag: <StatusTag state="configured" label="Native coin" />,
        rows: [
          { label: "Name", value: "Ether (test)" },
          { label: "Decimals", value: "18" },
          { label: "Contract", value: "None (native coin)" },
          { label: "Balance", value: "Unavailable", muted: true },
        ],
        sendStatus: "Sendable once the account and signing exist",
      };
    case "DemoUSD":
      return {
        title: "DemoUSD",
        subtitle: "Mandate's test token",
        tag: <StatusTag state="unavailable" label="Registry not loaded" />,
        rows: [
          { label: "Name", value: "Not loaded", muted: true },
          { label: "Decimals", value: "Not loaded", muted: true },
          { label: "Contract", value: "Not loaded", muted: true },
          { label: "Code check", value: "Not checked", muted: true },
          { label: "Balance", value: "Unavailable", muted: true },
        ],
        sendStatus: "Unknown until the registry is loaded",
      };
    case "sample":
      if (!__DEV__) return null;
      return {
        title: "SAMPLE",
        subtitle: "Development sample, not a real token",
        tag: <StatusTag state="unavailable" label="Watch-only (sample)" />,
        rows: [
          { label: "Name", value: "Sample imported token" },
          { label: "Decimals", value: "Sample value" },
          { label: "Contract", value: "Sample contract address" },
          { label: "Code check", value: "Not in the reviewed registry" },
          { label: "Balance", value: "Sample balance", muted: true },
        ],
        sendStatus: "Watch-only: cannot be sent",
        banner: (
          <Banner
            icon="flask-outline"
            title="Development sample"
            body="Placeholder values for reviewing the watch-only layout. Not a real token."
          />
        ),
      };
  }
}

export function TokenDetailsScreen({ navigation, route }: Props) {
  const view = tokenView(route.params.token);
  const back = () => navigation.goBack();
  if (!view) {
    return (
      <Screen title="Token" onBack={back}>
        <Banner
          icon="information-outline"
          title="Not available"
          body="This token cannot be shown."
        />
      </Screen>
    );
  }
  return (
    <Screen title={view.title} subtitle={view.subtitle} onBack={back}>
      {view.banner}
      <Card>
        {view.tag}
        {view.rows.map((row) => (
          <DetailRow key={row.label} {...row} />
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Sending</Text>
        <DetailRow label="Status" value={view.sendStatus} />
        <Text style={styles.caption}>{STATUS_HELP}</Text>
      </Card>

      <View style={styles.actions}>
        <OutlineButton
          label="Hide token"
          icon="eye-off-outline"
          disabled
          accessibilityHint="Unavailable. Token management is not built yet."
        />
        <OutlineButton
          label="View on explorer"
          icon="open-in-new"
          disabled
          accessibilityHint="Unavailable in this build."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
