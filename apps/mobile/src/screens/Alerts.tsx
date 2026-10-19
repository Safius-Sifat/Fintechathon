import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import { SAMPLE_ALERT } from "../config/approvalSamples";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Risk alerts (plan S9.11, P3-A01). When the service's risk rules trigger,
// it holds new agent signing off chain and alerts the owner. That hold is
// not a freeze: only the owner can freeze on chain. Alerts come from the
// Mandate service, which this build does not connect to.

type Props = NativeStackScreenProps<RootStackParamList, "Alerts">;

export function AlertsScreen({ navigation }: Props) {
  return (
    <Screen
      title="Alerts"
      subtitle="Warnings about how your agents are spending."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <StateView
          icon="cloud-off-outline"
          tone="amber"
          title="Alerts unavailable"
          tag={<StatusTag state="unavailable" />}
          body="This is not an empty list. Alerts come from the Mandate service, which this build does not connect to."
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>What an alert does</Text>
        <Text style={styles.body}>
          When spending looks unusual, the Mandate service holds new agent
          payments and alerts you. This hold is kept by the service, not on
          chain.
        </Text>
        <Text style={styles.caption}>
          Only you can clear the hold, after signing in again. To stop agents on
          chain, freeze the agent wallet.
        </Text>
      </Card>

      <NavRow
        icon="shield-lock-outline"
        tone="blue"
        label="Agent controls"
        value="Freeze, pause, revoke, log out"
        accessibilityHint="Opens agent controls"
        onPress={() => navigation.navigate("AgentControls")}
      />

      {__DEV__ ? (
        <>
          <SectionTitle>Development sample</SectionTitle>
          <Text style={styles.caption}>
            Development builds only. A placeholder alert to review this layout.
            It is not an alert and never appears in a release build.
          </Text>
          <Card>
            <View style={styles.head}>
              <IconTile icon="speedometer" tone="red" />
              <View style={styles.headText}>
                <Text style={styles.cardTitle}>{SAMPLE_ALERT.title}</Text>
                <StatusTag state="unavailable" label="Development sample" />
              </View>
            </View>
            <Text style={styles.body}>{SAMPLE_ALERT.detail}</Text>
            <DetailRow label="Wallet" value="Agent wallet (no account yet)" />
            <DetailRow
              label="Network"
              value={`${network.name} · Chain ${network.chainId}`}
            />
            <DetailRow label="Rule" value={SAMPLE_ALERT.rule} />
            <DetailRow label="Detected" value={SAMPLE_ALERT.detected} />
            <DetailRow label="Service hold" value={SAMPLE_ALERT.hold} />
            <DetailRow label="Frozen on chain" value="Unavailable" muted />
            <View style={styles.actions}>
              <OutlineButton
                label="Freeze agent wallet"
                icon="snowflake"
                disabled
                accessibilityHint="Unavailable. Freezing needs the owner key and the native confirmation screen."
              />
              <OutlineButton
                label="Clear hold"
                icon="lock-open-outline"
                disabled
                accessibilityHint="Unavailable. Clearing the hold needs a recent sign-in with the Mandate service."
              />
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  caption: { ...type.small, color: colors.textMuted },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1, gap: space.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
