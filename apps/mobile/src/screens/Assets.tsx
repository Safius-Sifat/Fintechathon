import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Assets preview. Personal holdings and agent-wallet holdings are separate
// and never added together. No balance can be read yet, and the reviewed
// token registry (from the trusted deployment manifest) is not loaded, so no
// token is presented as verified.

type Props = NativeStackScreenProps<RootStackParamList, "Assets">;

export function AssetsScreen({ navigation }: Props) {
  const [source, setSource] = useState<"personal" | "agent">("personal");
  const open = (token: "ETH" | "DemoUSD" | "sample") =>
    navigation.navigate("TokenDetails", { token });

  return (
    <Screen
      title="Assets"
      subtitle="What each wallet holds. Personal and agent funds are never added together."
      onBack={() => navigation.goBack()}
    >
      <Segmented
        label="Wallet"
        options={[
          { key: "personal", label: "Personal account" },
          { key: "agent", label: "Agent wallet", detail: "Not connected" },
        ]}
        selected={source}
        onSelect={setSource}
      />

      {source === "personal" ? (
        <>
          <NavRow
            icon="ethereum"
            tone="blue"
            label="ETH · Native coin"
            value="Balance unavailable"
            accessibilityHint="Opens token details"
            onPress={() => open("ETH")}
          />
          <NavRow
            icon="cash"
            tone="green"
            label="DemoUSD · Test token"
            value="Balance unavailable"
            footer={
              <StatusTag state="unavailable" label="Registry not loaded" />
            }
            accessibilityHint="Opens token details"
            onPress={() => open("DemoUSD")}
          />
          <Card>
            <Text style={styles.cardTitle}>Other tokens</Text>
            <Text style={styles.caption}>
              Imported tokens are watch-only until they are in the reviewed
              registry. Hiding a token never moves or burns it.
            </Text>
            <View style={styles.actions}>
              <OutlineButton
                label="Import token"
                icon="plus"
                disabled
                accessibilityHint="Unavailable. Token import is not built yet."
              />
              <OutlineButton
                label="Hidden tokens"
                icon="eye-off-outline"
                disabled
                accessibilityHint="Unavailable. There are no tokens yet."
              />
            </View>
          </Card>
          {__DEV__ ? (
            <>
              <SectionTitle>Development sample</SectionTitle>
              <NavRow
                icon="flask-outline"
                tone="violet"
                label="SAMPLE · Development sample"
                value="Preview of a watch-only token"
                footer={
                  <StatusTag state="unavailable" label="Not a real token" />
                }
                accessibilityHint="Opens the sample token layout"
                onPress={() => open("sample")}
              />
            </>
          ) : null}
        </>
      ) : (
        <Card>
          <Text style={styles.cardTitle}>Agent wallet</Text>
          <StatusTag state="notConnected" />
          <DetailRow label="DemoUSD" value="Unavailable" muted />
          <DetailRow label="Test USDC" value="Unavailable" muted />
          <DetailRow label="Vault position" value="Unavailable" muted />
          <DetailRow label="Kept liquid (floor)" value="Unavailable" muted />
          <DetailRow label="Reserved for tasks" value="Unavailable" muted />
          <Text style={styles.caption}>
            The agent wallet needs the Mandate service. No yield or APY is shown
            or promised.
          </Text>
        </Card>
      )}

      <Banner
        icon="information-outline"
        title="Not available in this build"
        body="Balances, token import and the reviewed token registry are not built yet."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
