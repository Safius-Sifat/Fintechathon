import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Card, Divider, SectionTitle } from "../components/Card";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { network } from "../config/network";
import {
  FUNDING_STEPS,
  NETWORK_STATUS,
  STALE_RULES,
} from "../config/networkStatus";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Network preview (plan S8, P3-W04 Network/Help). Shows the one supported
// chain from the app config. The RPC, manifest, connection, latest block and
// explorer are not configured or checked, and say so.

type Props = NativeStackScreenProps<RootStackParamList, "Network">;

export function NetworkScreen({ navigation }: Props) {
  return (
    <Screen
      title="Network"
      subtitle="Where this wallet reads and sends. Only one network is supported."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <View style={styles.head}>
          <IconTile icon="access-point-network" tone="blue" size={48} />
          <View style={styles.flex}>
            <Text style={styles.title}>{network.name}</Text>
            <Text style={styles.caption}>Chain ID {network.chainId}</Text>
          </View>
        </View>
        {network.isTestnet ? (
          <TaskStateChip
            info={{
              label: "Test network: assets have no value",
              group: "attention",
            }}
            icon="flask-outline"
          />
        ) : null}
      </Card>

      <SectionTitle>Status</SectionTitle>
      <Card>
        {NETWORK_STATUS.map((item, i) => (
          <View key={item.id} style={styles.group}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.row}>
              <Text style={[styles.label, styles.flex]}>{item.label}</Text>
              <Text
                style={
                  item.state === "configured" ? styles.value : styles.valueMuted
                }
              >
                {item.value}
              </Text>
            </View>
            <StatusTag
              state={item.state}
              label={
                item.state === "configured" ? "Set in this build" : undefined
              }
            />
            <Text style={styles.caption}>{item.detail}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>When the network is down or slow</SectionTitle>
      <Card>
        {STALE_RULES.map((rule) => (
          <View key={rule} style={styles.point}>
            <Icon name="circle-small" size={20} color={colors.textMuted} />
            <Text style={[styles.body, styles.flex]}>{rule}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Getting test ETH</SectionTitle>
      <Card>
        {FUNDING_STEPS.map((step, i) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <Text style={[styles.body, styles.flex]}>{step}</Text>
          </View>
        ))}
        <Text style={styles.caption}>
          Test ETH has no value. Never send real funds from another network to
          these addresses.
        </Text>
      </Card>
      <NavRow
        icon="qrcode"
        tone="blue"
        label="Receive"
        value="Your personal account address"
        accessibilityHint="Opens Receive"
        onPress={() => navigation.navigate("Receive")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  caption: { ...type.small, color: colors.textMuted },
  label: { ...type.body, color: colors.textMuted },
  value: { ...type.bodyStrong, color: colors.ink },
  valueMuted: { ...type.bodyStrong, color: colors.textMuted },
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  group: { gap: space.xs },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: space.sm,
  },
  point: { flexDirection: "row", alignItems: "flex-start" },
  step: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  stepNumber: { ...type.bodyStrong, color: colors.textMuted, minWidth: 16 },
});
